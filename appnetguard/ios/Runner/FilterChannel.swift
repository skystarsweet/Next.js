import Flutter
import Foundation
import NetworkExtension

/// Bridges the Flutter UI to the system content filter and the shared rule store.
///
/// Dart side: `lib/filter_service.dart`. Every mutating call answers with the full
/// state so the UI never has to reconcile partial updates. Configuration changes made
/// outside the app (Settings, MDM) are pushed to Dart through `stateChanged`.
final class FilterChannel: NSObject {
    static let channelName = "com.skystarsweet.appnetguard/filter"

    private let store = RuleStore()
    private let manager = NEFilterManager.shared()
    private var channel: FlutterMethodChannel?

    func register(with messenger: FlutterBinaryMessenger) {
        let channel = FlutterMethodChannel(name: FilterChannel.channelName, binaryMessenger: messenger)
        channel.setMethodCallHandler { [weak self] call, result in
            self?.handle(call, result: result)
        }
        self.channel = channel

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(configurationDidChange),
            name: .NEFilterConfigurationDidChange,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Dispatch

    private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        let args = call.arguments as? [String: Any] ?? [:]

        switch call.method {
        case "getState":
            loadState(completion: result)

        case "setFilterEnabled":
            guard let enabled = args["enabled"] as? Bool else { return result(FilterChannel.invalidArguments) }
            setFilterEnabled(enabled, completion: result)

        case "addRule":
            guard let identifier = args["bundleIdentifier"] as? String else { return result(FilterChannel.invalidArguments) }
            let name = (args["displayName"] as? String) ?? ""
            let normalized = AppRule.normalize(identifier)
            guard AppRule.isValidIdentifier(normalized) else {
                return result(FlutterError(code: "invalid_identifier",
                                           message: "“\(identifier)” is not a valid bundle identifier.",
                                           details: nil))
            }
            var rules = store.loadRules().filter { $0.bundleIdentifier != normalized }
            rules.append(AppRule(bundleIdentifier: normalized,
                                 displayName: name.isEmpty ? normalized : name,
                                 isBlocked: true))
            store.saveRules(rules)
            loadState(completion: result)

        case "setBlocked":
            guard let identifier = args["bundleIdentifier"] as? String,
                  let blocked = args["blocked"] as? Bool else { return result(FilterChannel.invalidArguments) }
            let normalized = AppRule.normalize(identifier)
            var rules = store.loadRules()
            if let index = rules.firstIndex(where: { $0.bundleIdentifier == normalized }) {
                rules[index].isBlocked = blocked
                rules[index].updatedAt = Date()
                store.saveRules(rules)
            }
            loadState(completion: result)

        case "removeRule":
            guard let identifier = args["bundleIdentifier"] as? String else { return result(FilterChannel.invalidArguments) }
            let normalized = AppRule.normalize(identifier)
            store.saveRules(store.loadRules().filter { $0.bundleIdentifier != normalized })
            loadState(completion: result)

        case "setAllBlocked":
            guard let blocked = args["blocked"] as? Bool else { return result(FilterChannel.invalidArguments) }
            let now = Date()
            store.saveRules(store.loadRules().map { rule in
                var copy = rule
                copy.isBlocked = blocked
                copy.updatedAt = now
                return copy
            })
            loadState(completion: result)

        case "clearSeen":
            store.clearSeen()
            loadState(completion: result)

        default:
            result(FlutterMethodNotImplemented)
        }
    }

    private static let invalidArguments = FlutterError(code: "invalid_arguments",
                                                       message: "Missing or malformed arguments.",
                                                       details: nil)

    // MARK: - Filter configuration

    private func setFilterEnabled(_ enabled: Bool, completion: @escaping FlutterResult) {
        manager.loadFromPreferences { [weak self] loadError in
            guard let self else { return }
            if let loadError {
                return self.reply(completion, with: self.buildState(status: "failed", error: loadError))
            }
            if self.manager.providerConfiguration == nil {
                let configuration = NEFilterProviderConfiguration()
                configuration.filterSockets = true
                configuration.filterPackets = false
                self.manager.providerConfiguration = configuration
            }
            self.manager.localizedDescription = "AppNetGuard"
            self.manager.isEnabled = enabled
            self.manager.saveToPreferences { saveError in
                if let saveError {
                    return self.reply(completion, with: self.buildState(status: "failed", error: saveError))
                }
                self.loadState(completion: completion)
            }
        }
    }

    private func loadState(completion: @escaping FlutterResult) {
        manager.loadFromPreferences { [weak self] error in
            guard let self else { return }
            if let error {
                self.reply(completion, with: self.buildState(status: "failed", error: error))
            } else {
                self.reply(completion, with: self.buildState(status: self.manager.isEnabled ? "enabled" : "disabled", error: nil))
            }
        }
    }

    @objc private func configurationDidChange() {
        loadState { [weak self] state in
            self?.channel?.invokeMethod("stateChanged", arguments: state)
        }
    }

    private func reply(_ completion: @escaping FlutterResult, with state: [String: Any]) {
        if Thread.isMainThread {
            completion(state)
        } else {
            DispatchQueue.main.async { completion(state) }
        }
    }

    // MARK: - Serialization

    private func buildState(status: String, error: Error?) -> [String: Any] {
        var state: [String: Any] = [
            "filterStatus": status,
            "rules": store.loadRules().map { rule -> [String: Any] in
                [
                    "bundleIdentifier": rule.bundleIdentifier,
                    "displayName": rule.displayName,
                    "isBlocked": rule.isBlocked,
                    "updatedAt": Int(rule.updatedAt.timeIntervalSince1970 * 1000),
                ]
            },
            "seen": store.seenIdentifiers(),
        ]
        if let error {
            state["errorMessage"] = FilterChannel.describe(error)
        }
        return state
    }

    private static func describe(_ error: Error) -> String {
        let nsError = error as NSError
        if nsError.domain == NEFilterErrorDomain,
           let code = NEFilterManagerError(rawValue: nsError.code) {
            switch code {
            case .configurationInvalid:
                return "The filter configuration is invalid. Check the extension's entitlements and bundle identifier."
            case .configurationDisabled:
                return "The filter configuration is disabled."
            case .configurationStale:
                return "The filter configuration changed elsewhere. Refresh and try again."
            case .configurationCannotBeRemoved:
                return "The filter configuration cannot be removed."
            case .configurationPermissionDenied:
                return "iOS refused to install the content filter. On iOS, per-app content filters only run on supervised devices (see README)."
            case .configurationInternalError:
                return "Internal Network Extension error. Try again after reinstalling the app."
            @unknown default:
                break
            }
        }
        return nsError.localizedDescription
    }
}

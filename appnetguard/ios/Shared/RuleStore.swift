import Foundation

enum AppGroup {
    /// Must match the App Group in both entitlements files.
    static let identifier = "group.com.skystarsweet.appnetguard"
}

/// Persists rules in the shared App Group container so the main app (writer)
/// and the filter extension (reader) see the same data.
final class RuleStore {
    private enum Key {
        static let rules = "rules.v1"
        static let revision = "rules.revision"
        static let seen = "seen.v1"
    }

    static let maxSeenIdentifiers = 300

    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(suiteName: String = AppGroup.identifier) {
        // Falls back to standard defaults if the App Group is misconfigured, so the
        // app still runs (rules just will not reach the extension).
        defaults = UserDefaults(suiteName: suiteName) ?? .standard
    }

    // MARK: Rules

    /// Monotonic counter bumped on every save. The extension polls this cheaply to
    /// know when to re-decode the rule list.
    var revision: Int {
        defaults.integer(forKey: Key.revision)
    }

    func loadRules() -> [AppRule] {
        guard let data = defaults.data(forKey: Key.rules),
              let rules = try? decoder.decode([AppRule].self, from: data) else {
            return []
        }
        return rules.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    func saveRules(_ rules: [AppRule]) {
        guard let data = try? encoder.encode(rules) else { return }
        defaults.set(data, forKey: Key.rules)
        defaults.set(revision &+ 1, forKey: Key.revision)
    }

    func blockedIdentifiers() -> Set<String> {
        Set(loadRules().filter(\.isBlocked).map(\.bundleIdentifier))
    }

    // MARK: Seen identifiers (written by the extension, read by the app)

    /// App identifiers the filter has observed making connections, most recent first.
    /// Lets the user add an app without knowing its bundle identifier in advance.
    func seenIdentifiers() -> [String] {
        defaults.stringArray(forKey: Key.seen) ?? []
    }

    func recordSeen(_ identifier: String) {
        var seen = seenIdentifiers()
        if let index = seen.firstIndex(of: identifier) {
            guard index != 0 else { return }
            seen.remove(at: index)
        }
        seen.insert(identifier, at: 0)
        if seen.count > RuleStore.maxSeenIdentifiers {
            seen.removeLast(seen.count - RuleStore.maxSeenIdentifiers)
        }
        defaults.set(seen, forKey: Key.seen)
    }

    func clearSeen() {
        defaults.removeObject(forKey: Key.seen)
    }
}

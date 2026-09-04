import NetworkExtension
import os

/// Content filter data provider. iOS hands every new socket flow to `handleNewFlow`;
/// flows from apps the user has blocked are dropped, everything else is allowed.
///
/// Rules live in the App Group container (see `RuleStore`). The provider re-reads them
/// only when the store's revision counter changes, so the per-flow cost is one
/// `UserDefaults` integer read plus a set lookup.
final class FilterDataProvider: NEFilterDataProvider {
    private let store = RuleStore()
    private var matcher = RuleMatcher()
    private var loadedRevision = -1
    private var reportedIdentifiers = Set<String>()
    private let log = Logger(subsystem: "com.skystarsweet.appnetguard", category: "FilterDataProvider")

    override func startFilter(completionHandler: @escaping (Error?) -> Void) {
        reloadRules(force: true)
        log.info("Filter started; \(self.matcher.blockedCount, privacy: .public) app(s) blocked")
        completionHandler(nil)
    }

    override func stopFilter(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        log.info("Filter stopped (reason \(reason.rawValue, privacy: .public))")
        completionHandler()
    }

    override func handleNewFlow(_ flow: NEFilterFlow) -> NEFilterNewFlowVerdict {
        reloadRules(force: false)

        guard let identifier = flow.sourceAppIdentifier, !identifier.isEmpty else {
            // System flows with no attributable app are never touched.
            return .allow()
        }

        recordSeen(identifier)

        if matcher.isBlocked(identifier) {
            log.debug("Dropping flow from \(identifier, privacy: .public)")
            return .drop()
        }
        return .allow()
    }

    // MARK: - Helpers

    private func reloadRules(force: Bool) {
        let revision = store.revision
        guard force || revision != loadedRevision else { return }
        matcher.update(blocked: store.blockedIdentifiers())
        loadedRevision = revision
        log.info("Rules reloaded (revision \(revision, privacy: .public)); \(self.matcher.blockedCount, privacy: .public) blocked")
    }

    /// Persist each distinct app identifier once per extension lifetime so the main app
    /// can offer it in its "recently seen apps" list.
    private func recordSeen(_ identifier: String) {
        guard !reportedIdentifiers.contains(identifier) else { return }
        reportedIdentifiers.insert(identifier)
        store.recordSeen(identifier)
    }
}

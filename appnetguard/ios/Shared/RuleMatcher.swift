import Foundation

/// Decides whether a flow's source app identifier matches a blocked bundle identifier.
///
/// `NEFilterFlow.sourceAppIdentifier` is derived from the app's code-signing identifier.
/// Depending on the platform and signing it can be either the bare bundle identifier
/// (`com.example.app`) or prefixed with the team identifier (`ABCDE12345.com.example.app`),
/// so both shapes are accepted.
struct RuleMatcher {
    private(set) var blocked: Set<String> = []

    var blockedCount: Int { blocked.count }

    init(blocked: Set<String> = []) {
        self.blocked = Set(blocked.map(AppRule.normalize))
    }

    mutating func update(blocked: Set<String>) {
        self.blocked = Set(blocked.map(AppRule.normalize))
    }

    func isBlocked(_ sourceAppIdentifier: String) -> Bool {
        let identifier = AppRule.normalize(sourceAppIdentifier)
        if blocked.contains(identifier) { return true }
        return blocked.contains(RuleMatcher.stripTeamPrefix(identifier))
    }

    /// `abcde12345.com.example.app` -> `com.example.app`. Team IDs are 10 alphanumerics.
    static func stripTeamPrefix(_ identifier: String) -> String {
        guard let dot = identifier.firstIndex(of: ".") else { return identifier }
        let prefix = identifier[..<dot]
        guard prefix.count == 10,
              prefix.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.contains($0) }) else {
            return identifier
        }
        return String(identifier[identifier.index(after: dot)...])
    }
}

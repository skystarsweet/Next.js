import Foundation

/// A single per-app rule. `bundleIdentifier` is the app's code-signing identifier
/// (for example `com.google.ios.youtube`). When `isBlocked` is true every network
/// flow originating from that app is dropped by the content filter extension.
struct AppRule: Codable, Identifiable, Hashable {
    var id: String { bundleIdentifier }

    var bundleIdentifier: String
    var displayName: String
    var isBlocked: Bool
    var updatedAt: Date

    init(bundleIdentifier: String, displayName: String, isBlocked: Bool = true, updatedAt: Date = Date()) {
        self.bundleIdentifier = AppRule.normalize(bundleIdentifier)
        self.displayName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        self.isBlocked = isBlocked
        self.updatedAt = updatedAt
    }

    static func normalize(_ identifier: String) -> String {
        identifier.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    static func isValidIdentifier(_ identifier: String) -> Bool {
        let value = normalize(identifier)
        guard value.count >= 3, value.contains(".") else { return false }
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789.-_")
        return value.unicodeScalars.allSatisfy { allowed.contains($0) }
    }
}

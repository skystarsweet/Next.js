import Foundation

/// A single per-app rule. `bundleIdentifier` is the app's code-signing identifier
/// (for example `com.google.ios.youtube`). When `isBlocked` is true every network
/// flow originating from that app is dropped by the content filter extension.
///
/// Mirrored in Dart by `AppRule` in `lib/models.dart`; the two are hand-kept copies
/// with no compile-time link. `normalize` and `isValidIdentifier` must agree with
/// `AppRule.normalizeIdentifier` and `AppRule.isValidIdentifier` there — the shared
/// table in `test/fixtures/identifier_cases.json` is the contract, and both
/// `ios/RunnerTests/AppRuleValidationTests.swift` and
/// `test/app_rule_validation_test.dart` assert against it. Change validation here
/// and you must update the fixture and the Dart copy in the same commit.
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

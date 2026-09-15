import Foundation
import XCTest

@testable import Runner

/// `AppRule` exists twice — here in Swift and in `lib/models.dart` — with nothing
/// linking the two implementations. `test/app_rule_validation_test.dart` runs this
/// same fixture against the Dart copy, so tightening or loosening one side without
/// the other fails a test instead of shipping a silent mismatch.
final class AppRuleValidationTests: XCTestCase {
    private struct IdentifierCase: Decodable {
        let input: String
        let normalized: String
        let valid: Bool
        let note: String?
    }

    private struct Fixture: Decodable {
        let cases: [IdentifierCase]
    }

    /// `<package root>/test/fixtures/identifier_cases.json`, resolved from this file's
    /// own location so the fixture does not need copying into the test bundle.
    private static var fixtureURL: URL {
        URL(fileURLWithPath: #filePath)   // ios/RunnerTests/AppRuleValidationTests.swift
            .deletingLastPathComponent()  // ios/RunnerTests
            .deletingLastPathComponent()  // ios
            .deletingLastPathComponent()  // package root
            .appendingPathComponent("test/fixtures/identifier_cases.json")
    }

    private func loadCases() throws -> [IdentifierCase] {
        let url = AppRuleValidationTests.fixtureURL
        guard FileManager.default.fileExists(atPath: url.path) else {
            XCTFail("Missing shared fixture at \(url.path)")
            return []
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(Fixture.self, from: data).cases
    }

    func testFixtureCoversBothOutcomes() throws {
        let cases = try loadCases()
        XCTAssertTrue(cases.contains { $0.valid }, "Shared fixture has no valid cases")
        XCTAssertTrue(cases.contains { !$0.valid }, "Shared fixture has no invalid cases")
    }

    func testNormalizeMatchesSharedFixture() throws {
        for testCase in try loadCases() {
            XCTAssertEqual(
                AppRule.normalize(testCase.input),
                testCase.normalized,
                "\(testCase.input.debugDescription): \(testCase.note ?? "")"
            )
        }
    }

    func testIsValidIdentifierMatchesSharedFixture() throws {
        for testCase in try loadCases() {
            XCTAssertEqual(
                AppRule.isValidIdentifier(testCase.input),
                testCase.valid,
                "\(testCase.input.debugDescription): \(testCase.note ?? "")"
            )
        }
    }
}

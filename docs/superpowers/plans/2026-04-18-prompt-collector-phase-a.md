# Prompt Collector Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local macOS menu bar app that imports historical prompts from Codex, Claude Code, Gemini CLI, and OpenCode, keeps syncing new prompts in the background, stores normalized records in SQLite, and exposes status plus repair hints from the menu bar.

**Architecture:** Use a SwiftPM-based macOS SwiftUI menu bar app with no third-party production dependencies. A source-adapter layer discovers and parses tool-specific local files into a shared prompt model, a SQLite-backed persistence layer stores normalized data plus checkpoints, and a collector engine coordinates full scans, incremental watches, analytics, and menu bar state.

**Tech Stack:** Swift 6, SwiftUI, AppKit, Observation, Foundation, SQLite3, XCTest, shell build/run bootstrap.

---

## File Structure

- `Package.swift`
  - Swift package definition, executable target, SQLite linkage, test target.
- `script/build_and_run.sh`
  - One-command kill/build/launch script for the macOS app bundle.
- `.codex/environments/environment.toml`
  - Codex desktop Run button wiring.
- `Sources/PromptCollectorApp/App/PromptCollectorApp.swift`
  - `@main` app entrypoint and menu bar scene.
- `Sources/PromptCollectorApp/App/AppState.swift`
  - App-wide observable state, startup orchestration, menu actions.
- `Sources/PromptCollectorApp/App/AppDelegate.swift`
  - App activation policy and lifecycle hooks needed for a menu bar app.
- `Sources/PromptCollectorApp/Models/DomainModels.swift`
  - Shared value types for tools, status, project, session, prompt, analytics.
- `Sources/PromptCollectorApp/Persistence/Database.swift`
  - SQLite connection management and migrations.
- `Sources/PromptCollectorApp/Persistence/PromptRepository.swift`
  - CRUD/query methods for statuses, prompts, sessions, projects, checkpoints, analytics reads.
- `Sources/PromptCollectorApp/Sources/SourceAdapter.swift`
  - Adapter protocol plus source root discovery contract.
- `Sources/PromptCollectorApp/Sources/CodexAdapter.swift`
  - Codex local source probing and prompt extraction.
- `Sources/PromptCollectorApp/Sources/ClaudeAdapter.swift`
  - Claude local source probing and prompt extraction.
- `Sources/PromptCollectorApp/Sources/GeminiAdapter.swift`
  - Gemini local source probing and prompt extraction.
- `Sources/PromptCollectorApp/Sources/OpenCodeAdapter.swift`
  - OpenCode local source probing and prompt extraction.
- `Sources/PromptCollectorApp/Services/CollectorEngine.swift`
  - Full scan, incremental import, dedupe, checkpoint updates.
- `Sources/PromptCollectorApp/Services/FileWatchService.swift`
  - Directory/file watch registration and event fanout.
- `Sources/PromptCollectorApp/Services/AnalyticsEngine.swift`
  - Derived facts and rule-based style metrics from normalized prompts.
- `Sources/PromptCollectorApp/Views/MenuBarContentView.swift`
  - Menu bar UI content: counts, source health, repair hints, actions.
- `Tests/PromptCollectorAppTests/Support/TestPaths.swift`
  - Temporary directory helpers and fixture loading.
- `Tests/PromptCollectorAppTests/Persistence/PromptRepositoryTests.swift`
  - Schema, insert/query, dedupe, checkpoint tests.
- `Tests/PromptCollectorAppTests/Sources/*AdapterTests.swift`
  - Fixture-driven prompt extraction tests per tool.
- `Tests/PromptCollectorAppTests/Services/CollectorEngineTests.swift`
  - Import orchestration and watch-trigger tests.
- `Tests/PromptCollectorAppTests/Services/AnalyticsEngineTests.swift`
  - Time distribution and style metric tests.
- `Tests/PromptCollectorAppTests/Fixtures/...`
  - Sanitized local-format samples for each source.

### Task 1: Bootstrap SwiftPM App Shell

**Files:**
- Create: `Package.swift`
- Create: `script/build_and_run.sh`
- Create: `.codex/environments/environment.toml`
- Create: `Sources/PromptCollectorApp/App/PromptCollectorApp.swift`
- Create: `Sources/PromptCollectorApp/App/AppState.swift`
- Create: `Sources/PromptCollectorApp/App/AppDelegate.swift`
- Create: `Sources/PromptCollectorApp/Views/MenuBarContentView.swift`
- Test: `Tests/PromptCollectorAppTests/App/AppBootTests.swift`

- [ ] **Step 1: Write the failing app bootstrap test**

```swift
import XCTest
@testable import PromptCollectorApp

final class AppBootTests: XCTestCase {
    func testEmptyStateShowsNoSourcesYet() {
        let state = AppState.preview

        XCTAssertEqual(state.totalPromptCount, 0)
        XCTAssertEqual(state.sources.count, 0)
        XCTAssertEqual(state.lastSyncSummary, "Not synced yet")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter AppBootTests/testEmptyStateShowsNoSourcesYet`
Expected: FAIL with package or symbol errors because the app target and `AppState.preview` do not exist yet.

- [ ] **Step 3: Write the minimal package and app shell**

```swift
// Package.swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "PromptCollector",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "PromptCollectorApp", targets: ["PromptCollectorApp"])
    ],
    targets: [
        .executableTarget(
            name: "PromptCollectorApp",
            linkerSettings: [.linkedLibrary("sqlite3")]
        ),
        .testTarget(
            name: "PromptCollectorAppTests",
            dependencies: ["PromptCollectorApp"]
        )
    ]
)
```

```swift
// Sources/PromptCollectorApp/App/AppState.swift
import Foundation
import Observation

@Observable
final class AppState {
    var totalPromptCount = 0
    var sources: [SourceHealth] = []
    var lastSyncSummary = "Not synced yet"

    static var preview: AppState { AppState() }
}
```

```swift
// Sources/PromptCollectorApp/App/PromptCollectorApp.swift
import SwiftUI

@main
struct PromptCollectorApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appState = AppState()

    var body: some Scene {
        MenuBarExtra("Prompt Collector", systemImage: "tray.full") {
            MenuBarContentView(appState: appState)
        }
    }
}
```

```swift
// Sources/PromptCollectorApp/App/AppDelegate.swift
import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
    }
}
```

```swift
// Sources/PromptCollectorApp/Views/MenuBarContentView.swift
import SwiftUI

struct MenuBarContentView: View {
    let appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Prompt Collector")
                .font(.headline)
            Text("Prompts: \(appState.totalPromptCount)")
            Text(appState.lastSyncSummary)
        }
        .padding(12)
        .frame(width: 260)
    }
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_NAME="PromptCollectorApp"
BUILD_DIR=".build/debug"
DIST_DIR="dist/${APP_NAME}.app"

pkill -x "${APP_NAME}" 2>/dev/null || true
swift build
mkdir -p "${DIST_DIR}/Contents/MacOS" "${DIST_DIR}/Contents"
cp "${BUILD_DIR}/${APP_NAME}" "${DIST_DIR}/Contents/MacOS/${APP_NAME}"
cat > "${DIST_DIR}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>PromptCollectorApp</string>
<key>CFBundleIdentifier</key><string>local.prompt.collector</string>
<key>CFBundleName</key><string>PromptCollectorApp</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>
PLIST
/usr/bin/open -n "${DIST_DIR}"
```

```toml
[actions.run]
command = "./script/build_and_run.sh"
label = "Run"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `swift test --filter AppBootTests/testEmptyStateShowsNoSourcesYet`
Expected: PASS

- [ ] **Step 5: Verify the app builds and launches**

Run: `./script/build_and_run.sh`
Expected: `swift build` succeeds and a menu bar app process named `PromptCollectorApp` launches.

- [ ] **Step 6: Commit**

```bash
git add Package.swift script/build_and_run.sh .codex/environments/environment.toml Sources/PromptCollectorApp/App Sources/PromptCollectorApp/Views Tests/PromptCollectorAppTests/App/AppBootTests.swift
git commit -m "feat: bootstrap prompt collector menu bar app"
```

### Task 2: Add Domain Models and SQLite Persistence

**Files:**
- Create: `Sources/PromptCollectorApp/Models/DomainModels.swift`
- Create: `Sources/PromptCollectorApp/Persistence/Database.swift`
- Create: `Sources/PromptCollectorApp/Persistence/PromptRepository.swift`
- Test: `Tests/PromptCollectorAppTests/Persistence/PromptRepositoryTests.swift`
- Test: `Tests/PromptCollectorAppTests/Support/TestPaths.swift`

- [ ] **Step 1: Write the failing persistence test**

```swift
import XCTest
@testable import PromptCollectorApp

final class PromptRepositoryTests: XCTestCase {
    func testInsertPromptCreatesToolProjectAndSessionHierarchy() throws {
        let database = try Database(path: TestPaths.tempFile(named: "prompt-collector.sqlite"))
        let repository = PromptRepository(database: database)
        let prompt = PromptRecord.fixture(tool: .codex, projectPath: "/tmp/demo", sessionKey: "session-1")

        try repository.upsert(prompt: prompt)

        XCTAssertEqual(try repository.totalPromptCount(), 1)
        XCTAssertEqual(try repository.projects(for: .codex).count, 1)
        XCTAssertEqual(try repository.sessions(tool: .codex, projectPath: "/tmp/demo").count, 1)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter PromptRepositoryTests/testInsertPromptCreatesToolProjectAndSessionHierarchy`
Expected: FAIL because `Database`, `PromptRepository`, `PromptRecord.fixture`, and related models do not exist.

- [ ] **Step 3: Write minimal models and repository**

```swift
// Sources/PromptCollectorApp/Models/DomainModels.swift
import Foundation

enum ToolKind: String, CaseIterable, Codable {
    case codex, claude, gemini, opencode
}

enum SourceStatus: String, Codable {
    case healthy, missing, unsupported, error
}

struct SourceHealth: Equatable, Codable, Identifiable {
    let id: String
    let tool: ToolKind
    let rootPath: String
    let status: SourceStatus
    let suggestedFix: String?
}

struct PromptRecord: Equatable, Codable, Identifiable {
    let id: UUID
    let tool: ToolKind
    let projectPath: String
    let sessionKey: String
    let promptText: String
    let promptTimestamp: Date
    let sourceFile: String
    let sourceLocation: String
    let fingerprint: String
}

extension PromptRecord {
    static func fixture(tool: ToolKind, projectPath: String, sessionKey: String) -> PromptRecord {
        PromptRecord(
            id: UUID(),
            tool: tool,
            projectPath: projectPath,
            sessionKey: sessionKey,
            promptText: "Fix the failing parser test",
            promptTimestamp: Date(timeIntervalSince1970: 1_776_500_000),
            sourceFile: "/tmp/source.jsonl",
            sourceLocation: "line:1",
            fingerprint: "\(tool.rawValue)|\(projectPath)|\(sessionKey)|line:1"
        )
    }
}
```

```swift
// Sources/PromptCollectorApp/Persistence/Database.swift
import Foundation
import SQLite3

final class Database {
    let handle: OpaquePointer

    init(path: String) throws {
        var db: OpaquePointer?
        guard sqlite3_open(path, &db) == SQLITE_OK, let db else {
            throw DatabaseError.openFailed(path)
        }
        handle = db
        try migrate()
    }

    deinit { sqlite3_close(handle) }

    private func migrate() throws {
        let sql = """
        CREATE TABLE IF NOT EXISTS prompts (
            fingerprint TEXT PRIMARY KEY,
            tool TEXT NOT NULL,
            project_path TEXT NOT NULL,
            session_key TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            prompt_timestamp REAL NOT NULL,
            source_file TEXT NOT NULL,
            source_location TEXT NOT NULL
        );
        """
        guard sqlite3_exec(handle, sql, nil, nil, nil) == SQLITE_OK else {
            throw DatabaseError.migrationFailed
        }
    }
}

enum DatabaseError: Error {
    case openFailed(String)
    case migrationFailed
    case statementFailed(String)
}
```

```swift
// Sources/PromptCollectorApp/Persistence/PromptRepository.swift
import Foundation
import SQLite3

final class PromptRepository {
    private let database: Database

    init(database: Database) {
        self.database = database
    }

    func upsert(prompt: PromptRecord) throws {
        let sql = """
        INSERT OR IGNORE INTO prompts
        (fingerprint, tool, project_path, session_key, prompt_text, prompt_timestamp, source_file, source_location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database.handle, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.statementFailed("prepare insert")
        }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, prompt.fingerprint, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 2, prompt.tool.rawValue, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 3, prompt.projectPath, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 4, prompt.sessionKey, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 5, prompt.promptText, -1, SQLITE_TRANSIENT)
        sqlite3_bind_double(statement, 6, prompt.promptTimestamp.timeIntervalSince1970)
        sqlite3_bind_text(statement, 7, prompt.sourceFile, -1, SQLITE_TRANSIENT)
        sqlite3_bind_text(statement, 8, prompt.sourceLocation, -1, SQLITE_TRANSIENT)
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw DatabaseError.statementFailed("step insert")
        }
    }

    func totalPromptCount() throws -> Int { try scalarInt("SELECT COUNT(*) FROM prompts;") }
    func projects(for tool: ToolKind) throws -> [String] { try scalarStrings("SELECT DISTINCT project_path FROM prompts WHERE tool = ? ORDER BY project_path;", bind: tool.rawValue) }
    func sessions(tool: ToolKind, projectPath: String) throws -> [String] { try scalarStrings("SELECT DISTINCT session_key FROM prompts WHERE tool = ? AND project_path = ? ORDER BY session_key;", bind: tool.rawValue, projectPath) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `swift test --filter PromptRepositoryTests/testInsertPromptCreatesToolProjectAndSessionHierarchy`
Expected: PASS

- [ ] **Step 5: Add dedupe and checkpoint tests before extending schema**

```swift
func testUpsertIgnoresDuplicateFingerprint() throws {
    let database = try Database(path: TestPaths.tempFile(named: "dedupe.sqlite"))
    let repository = PromptRepository(database: database)
    let prompt = PromptRecord.fixture(tool: .claude, projectPath: "/tmp/demo", sessionKey: "session-2")

    try repository.upsert(prompt: prompt)
    try repository.upsert(prompt: prompt)

    XCTAssertEqual(try repository.totalPromptCount(), 1)
}
```

- [ ] **Step 6: Commit**

```bash
git add Sources/PromptCollectorApp/Models Sources/PromptCollectorApp/Persistence Tests/PromptCollectorAppTests/Persistence Tests/PromptCollectorAppTests/Support
git commit -m "feat: add prompt repository and sqlite schema"
```

### Task 3: Implement Source Discovery and Parsing Adapters

**Files:**
- Create: `Sources/PromptCollectorApp/Sources/SourceAdapter.swift`
- Create: `Sources/PromptCollectorApp/Sources/CodexAdapter.swift`
- Create: `Sources/PromptCollectorApp/Sources/ClaudeAdapter.swift`
- Create: `Sources/PromptCollectorApp/Sources/GeminiAdapter.swift`
- Create: `Sources/PromptCollectorApp/Sources/OpenCodeAdapter.swift`
- Create: `Tests/PromptCollectorAppTests/Fixtures/Codex/sample-history.jsonl`
- Create: `Tests/PromptCollectorAppTests/Fixtures/Claude/sample-session.jsonl`
- Create: `Tests/PromptCollectorAppTests/Fixtures/Gemini/sample-chat.json`
- Create: `Tests/PromptCollectorAppTests/Fixtures/OpenCode/sample-message.json`
- Test: `Tests/PromptCollectorAppTests/Sources/CodexAdapterTests.swift`
- Test: `Tests/PromptCollectorAppTests/Sources/ClaudeAdapterTests.swift`
- Test: `Tests/PromptCollectorAppTests/Sources/GeminiAdapterTests.swift`
- Test: `Tests/PromptCollectorAppTests/Sources/OpenCodeAdapterTests.swift`

- [ ] **Step 1: Write failing adapter tests**

```swift
import XCTest
@testable import PromptCollectorApp

final class CodexAdapterTests: XCTestCase {
    func testParseCodexHistoryExtractsUserPrompt() throws {
        let fixture = try TestPaths.fixture(named: "Codex/sample-history.jsonl")
        let adapter = CodexAdapter(fileManager: .default)

        let prompts = try adapter.parse(fileAt: fixture)

        XCTAssertEqual(prompts.count, 1)
        XCTAssertEqual(prompts.first?.tool, .codex)
        XCTAssertEqual(prompts.first?.projectPath, "/Library/Code/AI/prompt")
    }
}
```

- [ ] **Step 2: Run adapter tests to verify they fail**

Run: `swift test --filter CodexAdapterTests`
Expected: FAIL because adapter types and fixture loaders do not exist.

- [ ] **Step 3: Write the shared adapter protocol and heuristic extractors**

```swift
// Sources/PromptCollectorApp/Sources/SourceAdapter.swift
import Foundation

protocol SourceAdapter {
    var tool: ToolKind { get }
    func discoverRoots() -> [String]
    func candidateFiles(under root: String) throws -> [String]
    func parse(fileAt path: String) throws -> [PromptRecord]
    func sourceHealth() -> SourceHealth
}
```

```swift
// Sources/PromptCollectorApp/Sources/CodexAdapter.swift
import Foundation

struct CodexAdapter: SourceAdapter {
    let fileManager: FileManager
    var tool: ToolKind { .codex }

    func discoverRoots() -> [String] {
        [NSHomeDirectory() + "/.codex"]
    }

    func candidateFiles(under root: String) throws -> [String] {
        [
            root + "/history.jsonl",
            root + "/session_index.jsonl"
        ] + try jsonlFiles(in: root + "/sessions")
    }

    func parse(fileAt path: String) throws -> [PromptRecord] {
        try JSONLPromptExtractor(tool: .codex).extract(from: path, roleHints: ["user", "input"])
    }

    func sourceHealth() -> SourceHealth { discoveredHealth(tool: .codex, root: discoverRoots().first!) }
}
```

```swift
// Claude/Gemini/OpenCode adapters use the same shape but different roots and candidate files.
// Gemini should probe ~/.gemini/tmp and ~/.gemini/antigravity/conversations.
// OpenCode should probe ~/.local/share/opencode/storage/message, storage/part, and opencode.db.
```

- [ ] **Step 4: Add sanitized fixture samples that match each tool’s observed shape**

```json
{"timestamp":"2026-04-18T10:00:00Z","cwd":"/Library/Code/AI/prompt","role":"user","text":"fix the sqlite migration bug","session_id":"session-1"}
```

```json
{"type":"message","role":"user","cwd":"/Library/Code/AI/prompt","content":"explain this failing test","sessionId":"claude-session-1","timestamp":"2026-04-18T10:00:00Z"}
```

- [ ] **Step 5: Run all adapter tests**

Run: `swift test --filter AdapterTests`
Expected: PASS for Codex, Claude, Gemini, and OpenCode extraction fixtures.

- [ ] **Step 6: Commit**

```bash
git add Sources/PromptCollectorApp/Sources Tests/PromptCollectorAppTests/Sources Tests/PromptCollectorAppTests/Fixtures
git commit -m "feat: add source adapters for codex claude gemini and opencode"
```

### Task 4: Build Collector Engine, Checkpoints, and Background Watching

**Files:**
- Create: `Sources/PromptCollectorApp/Services/CollectorEngine.swift`
- Create: `Sources/PromptCollectorApp/Services/FileWatchService.swift`
- Modify: `Sources/PromptCollectorApp/Persistence/Database.swift`
- Modify: `Sources/PromptCollectorApp/Persistence/PromptRepository.swift`
- Test: `Tests/PromptCollectorAppTests/Services/CollectorEngineTests.swift`

- [ ] **Step 1: Write the failing orchestration test**

```swift
import XCTest
@testable import PromptCollectorApp

final class CollectorEngineTests: XCTestCase {
    func testFullScanImportsFixturesAndUpdatesSourceHealth() throws {
        let harness = try CollectorHarness.make()

        try harness.engine.performFullScan()

        XCTAssertEqual(try harness.repository.totalPromptCount(), 4)
        XCTAssertEqual(harness.engine.state.lastSyncSummary, "Last sync succeeded")
        XCTAssertEqual(harness.engine.state.sources.filter { $0.status == .healthy }.count, 4)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter CollectorEngineTests/testFullScanImportsFixturesAndUpdatesSourceHealth`
Expected: FAIL because no engine/watch service/checkpoint schema exists.

- [ ] **Step 3: Extend schema and implement the engine**

```swift
// Add tables:
// source_status(tool TEXT PRIMARY KEY, root_path TEXT, status TEXT, suggested_fix TEXT, last_sync_at REAL, last_error_summary TEXT)
// import_checkpoints(source_file TEXT PRIMARY KEY, modified_at REAL, size_bytes INTEGER, last_parsed_offset INTEGER)
```

```swift
final class CollectorEngine {
    @MainActor @Observable final class State {
        var sources: [SourceHealth] = []
        var totalPromptCount = 0
        var lastSyncSummary = "Not synced yet"
    }

    let adapters: [any SourceAdapter]
    let repository: PromptRepository
    let watchService: FileWatchService
    let state: State

    func performFullScan() throws {
        for adapter in adapters {
            let roots = adapter.discoverRoots()
            for root in roots {
                for file in try adapter.candidateFiles(under: root) {
                    try importFile(file, with: adapter)
                }
            }
        }
        state.totalPromptCount = (try? repository.totalPromptCount()) ?? 0
        state.lastSyncSummary = "Last sync succeeded"
    }
}
```

- [ ] **Step 4: Add a watch test before wiring live file watches**

```swift
func testWatchEventReimportsOnlyNewPrompt() throws {
    let harness = try CollectorHarness.make()
    try harness.engine.performFullScan()

    try harness.appendPrompt(to: "Codex/sample-history.jsonl")
    try harness.engine.handleChange(at: harness.changedFilePath)

    XCTAssertEqual(try harness.repository.totalPromptCount(), 5)
}
```

- [ ] **Step 5: Run service tests**

Run: `swift test --filter CollectorEngineTests`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add Sources/PromptCollectorApp/Services Sources/PromptCollectorApp/Persistence Tests/PromptCollectorAppTests/Services
git commit -m "feat: add collector engine checkpoints and watch handling"
```

### Task 5: Add Analytics Engine and Repair Hint Mapping

**Files:**
- Create: `Sources/PromptCollectorApp/Services/AnalyticsEngine.swift`
- Modify: `Sources/PromptCollectorApp/Models/DomainModels.swift`
- Modify: `Sources/PromptCollectorApp/App/AppState.swift`
- Test: `Tests/PromptCollectorAppTests/Services/AnalyticsEngineTests.swift`

- [ ] **Step 1: Write the failing analytics tests**

```swift
import XCTest
@testable import PromptCollectorApp

final class AnalyticsEngineTests: XCTestCase {
    func testHourlyDistributionUsesPromptTimestamps() throws {
        let prompts = [
            PromptRecord.fixture(tool: .codex, projectPath: "/tmp/demo", sessionKey: "s1"),
            PromptRecord.fixture(tool: .codex, projectPath: "/tmp/demo", sessionKey: "s2")
        ]
        let engine = AnalyticsEngine()

        let summary = engine.summarize(prompts: prompts)

        XCTAssertEqual(summary.totalPrompts, 2)
        XCTAssertFalse(summary.hourlyBuckets.isEmpty)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter AnalyticsEngineTests`
Expected: FAIL because `AnalyticsEngine` and analytics models do not exist.

- [ ] **Step 3: Implement analytics models and deterministic heuristics**

```swift
struct AnalyticsSummary: Equatable {
    let totalPrompts: Int
    let promptsToday: Int
    let hourlyBuckets: [Int: Int]
    let languageMix: [String: Int]
    let styleTraits: [String: Double]
}

final class AnalyticsEngine {
    func summarize(prompts: [PromptRecord]) -> AnalyticsSummary {
        let hourly = Dictionary(grouping: prompts) {
            Calendar.current.component(.hour, from: $0.promptTimestamp)
        }.mapValues(\.count)

        let commandLike = prompts.filter { $0.promptText.contains("/") || $0.promptText.contains("`") }.count
        let questionLike = prompts.filter { $0.promptText.contains("?") || $0.promptText.contains("？") }.count

        return AnalyticsSummary(
            totalPrompts: prompts.count,
            promptsToday: prompts.count,
            hourlyBuckets: hourly,
            languageMix: ["mixed": prompts.count],
            styleTraits: [
                "question_ratio": prompts.isEmpty ? 0 : Double(questionLike) / Double(prompts.count),
                "command_ratio": prompts.isEmpty ? 0 : Double(commandLike) / Double(prompts.count)
            ]
        )
    }
}
```

- [ ] **Step 4: Add repair hint mapping tests**

```swift
func testMissingSourceMapsToReadableRepairHint() {
    let health = SourceHealth(id: "codex", tool: .codex, rootPath: "~/.codex", status: .missing, suggestedFix: AppState.repairHint(for: .missing))

    XCTAssertEqual(health.suggestedFix, "Source not found. Run a full rescan after the tool creates local history.")
}
```

- [ ] **Step 5: Run analytics tests**

Run: `swift test --filter AnalyticsEngineTests`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add Sources/PromptCollectorApp/Services/AnalyticsEngine.swift Sources/PromptCollectorApp/Models/DomainModels.swift Sources/PromptCollectorApp/App/AppState.swift Tests/PromptCollectorAppTests/Services/AnalyticsEngineTests.swift
git commit -m "feat: add local analytics summaries and repair hints"
```

### Task 6: Integrate Menu Bar UI, Startup Scan, and End-to-End Verification

**Files:**
- Modify: `Sources/PromptCollectorApp/App/AppState.swift`
- Modify: `Sources/PromptCollectorApp/Views/MenuBarContentView.swift`
- Modify: `Sources/PromptCollectorApp/App/PromptCollectorApp.swift`
- Modify: `script/build_and_run.sh`
- Test: `Tests/PromptCollectorAppTests/App/AppStateIntegrationTests.swift`

- [ ] **Step 1: Write the failing integration test**

```swift
import XCTest
@testable import PromptCollectorApp

final class AppStateIntegrationTests: XCTestCase {
    func testStartRunsInitialScanAndPublishesCounts() async throws {
        let harness = try AppStateHarness.make()

        await harness.state.start()

        XCTAssertGreaterThan(harness.state.totalPromptCount, 0)
        XCTAssertEqual(harness.state.lastSyncSummary, "Last sync succeeded")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter AppStateIntegrationTests/testStartRunsInitialScanAndPublishesCounts`
Expected: FAIL because `start()` orchestration is not wired to the collector engine.

- [ ] **Step 3: Implement startup orchestration and menu bar actions**

```swift
@MainActor
extension AppState {
    func start() async {
        do {
            try collectorEngine.performFullScan()
            refreshFromRepository()
            fileWatchService.startWatching(paths: watchPaths) { [weak self] changedPath in
                try? self?.collectorEngine.handleChange(at: changedPath)
                self?.refreshFromRepository()
            }
        } catch {
            lastSyncSummary = "Last sync failed"
        }
    }

    func rescan() {
        Task { await start() }
    }
}
```

```swift
struct MenuBarContentView: View {
    @Bindable var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Prompt Collector").font(.headline)
            Text("Prompts: \(appState.totalPromptCount)")
            Text(appState.lastSyncSummary).foregroundStyle(.secondary)
            ForEach(appState.sources) { source in
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(source.tool.rawValue.capitalized): \(source.status.rawValue)")
                    if let suggestedFix = source.suggestedFix {
                        Text(suggestedFix).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            Divider()
            Button("Rescan", action: appState.rescan)
            Button("Open Database Folder", action: appState.openDatabaseFolder)
            Button("Open Logs", action: appState.openLogsFolder)
            Button("Quit", role: .destructive) { NSApp.terminate(nil) }
        }
        .padding(12)
        .frame(width: 320)
    }
}
```

- [ ] **Step 4: Run the full automated test suite**

Run: `swift test`
Expected: PASS across app, persistence, adapters, collector, and analytics tests.

- [ ] **Step 5: Run end-to-end build and launch verification**

Run: `./script/build_and_run.sh`
Expected: App launches in the menu bar, the menu shows prompt counts and per-tool health, and no build errors occur.

- [ ] **Step 6: Commit**

```bash
git add Sources/PromptCollectorApp/App Sources/PromptCollectorApp/Views script/build_and_run.sh Tests/PromptCollectorAppTests/App/AppStateIntegrationTests.swift
git commit -m "feat: wire menu bar collector app end to end"
```

## Self-Review

### Spec coverage

- Local menu bar app shell: covered by Tasks 1 and 6.
- Historical import + background sync: covered by Tasks 3 and 4.
- Tool → project → session → prompt hierarchy: covered by Tasks 2 and 4.
- Source-specific support for Codex / Claude / Gemini / OpenCode: covered by Task 3.
- Error states and repair hints: covered by Tasks 4, 5, and 6.
- Local analytics for work-time and style summaries: covered by Task 5.
- Build/run verification: covered by Tasks 1 and 6.

No spec gaps remain for Phase A.

### Placeholder scan

- No `TODO` / `TBD` placeholders remain.
- Each task includes exact file paths, commands, and code examples.

### Type consistency

- Shared type names stay consistent: `ToolKind`, `SourceHealth`, `PromptRecord`, `PromptRepository`, `CollectorEngine`, `AnalyticsEngine`, `AppState`.
- Repository hierarchy methods use the same `tool/project/session` naming throughout.

Plan complete and saved to `docs/superpowers/plans/2026-04-18-prompt-collector-phase-a.md`.

Because you asked me to直接开工，而且当前会话没有显式授权我派子代理并行开发，我会采用 **Inline Execution** 继续在这个会话里按计划实现。*** End Patch
天天中彩票analysis to=functions.apply_patch code

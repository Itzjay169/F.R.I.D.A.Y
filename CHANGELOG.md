# CHANGELOG - F.R.I.D.A.Y. The Trading Desk

All notable changes to this project will be documented in this file.

## [7.5.0-sentinel-x-risk] - 2026-10-28
### Completed: Phase 7.5 – SENTINEL-X: Portfolio Risk, Heat, Correlation, and Kill Switch
- **SENTINEL-X Specialist Agent (`agents/sentinel-x/sentinelXAgent.js`, `agents/sentinel-x/index.js`)**:
  - Serves as the Portfolio Risk Officer for the local paper ledger, assessing aggregate portfolio heat, correlation clusters, asset concentration, drawdown, daily loss limits, and scenario stress tests.
  - Implements 13 natural language intents: `portfolio_risk_report`, `portfolio_heat`, `exposure_report`, `correlation_report`, `concentration_report`, `stress_test_portfolio`, `risk_budget_report`, `pretrade_portfolio_check`, `recommend_risk_reduction`, `activate_kill_switch`, `deactivate_kill_switch`, `explain_veto`, and `set_risk_limits`.
  - Cold, conservative persona with strict non-execution invariant (`assertSentinelXCannotExecute`).
- **Portfolio Risk Model & Heat Engine (`services/sentinel-x/portfolioRiskModel.js`)**:
  - Mathematical portfolio heat: $\text{Portfolio Heat} = \sum_{i=1}^n |\text{Entry}_i - \text{Stop}_i| \times \text{Qty}_i$, expressed in both dollars and percentage of equity.
  - Granular breakdown by sector/theme, asset class, direction, and single symbol.
  - Account snapshot continuously calculated from local paper ledger: Starting/current equity, cash, gross/net exposure, long/short exposure, realized/unrealized P&L, daily P&L, peak equity, and drawdown.
- **Rolling Returns Correlation & Cluster Engine (`services/sentinel-x/correlationEngine.js`)**:
  - Rolling Pearson correlation matrix computed strictly from daily percentage returns ($R_t = \frac{P_t - P_{t-1}}{P_{t-1}}$), never raw price series, with transparent handling of missing historical data.
  - Correlated cluster detection aggregating overlapping sector/macro factors and pairs exceeding correlation threshold ($r \ge 0.70$).
  - Concentration monitors checking symbol ($\le 2\%$), sector ($\le 3\%$), and cluster ($\le 4\%$) heat caps.
- **Scenario Stress Testing Engine (`services/sentinel-x/stressTesting.js`)**:
  - 18 predefined market stress scenarios (e.g. Market Down 1/2/5/10%, Tech Down 5%, Semis Down 5%, Crypto Down 10%, VIX Spike 25%, Yields Up 25 bps, Liquidity Shock, Correlation Spike).
  - Stop breach simulation and dollar/percentage equity loss modeling with full model honesty disclosures (`MODEL-ESTIMATED (NOT A PREDICTION)`).
- **Daily & Weekly Risk Budget System (`services/sentinel-x/riskBudget.js`)**:
  - Tracks daily loss budget (3% default) and weekly loss budget (8% default).
  - Five-tier risk state machine: `GREEN` (normal), `YELLOW` (approaching limit), `ORANGE` (budget nearly exhausted), `RED` (daily loss or heat limit breached; new entries blocked), and `BLACK` (kill switch active).
- **Portfolio Kill Switch (`services/sentinel-x/killSwitch.js`)**:
  - Multi-vector activation: Manual voice/HUD or auto-trigger on daily loss limit, max drawdown breach, or heat hard limit.
  - Protective stop/target preservation: Stops and targets remain active while all new trade entries and brackets are strictly blocked.
  - Mandatory human confirmation for deactivation with logged reason and journal audit.
- **Pretrade Portfolio Check & Pipeline Integration (`services/sentinel-x/pretradeCheck.js`, `services/sentinelReview.js`)**:
  - Dual-gated verification: Trade-level Sentinel audit + Portfolio-level Sentinel-X pretrade check before trade plans can reach user confirmation or PILOT execution.
  - Automatically identifies concentration breaches, heat limit violations, and daily budget exhaustion.
- **Risk-Reduction Planner (`services/sentinel-x/riskReductionPlanner.js`)**:
  - Recommends defensive trimming, position closure, or stop-tightening without executing autonomously.
- **Cyber-HUD Portfolio Risk Desk (`app/src/components/PortfolioRiskView.jsx`)**:
  - Full HUD panel with visual gauges for heat, daily budget, weekly budget, drawdown, and risk state.
  - Real-time open position heat table, sector heat bars, correlation matrix, correlated clusters, interactive stress test selector, and emergency kill-switch controls.
- **Verification & Testing (100% Pass Rate)**:
  - **225 / 225 tests passing** across 21 test suites:
    - `tests/contract/portfolio-risk/portfolio-risk-contract.test.js` (10 tests)
    - `tests/unit/sentinel-x/sentinel-x.test.js` (13 tests)
    - `tests/integration/portfolio-risk/portfolio-risk.test.js` (10 tests)
    - `tests/performance/risk-calculations/risk-calculations.test.js` (8 tests)
    - Plus all existing suites (archive, relay alerts, routines, compass, workflow engine, chart router, config).

## [6.5.0-archive-memory] - 2026-10-28
### Completed: Phase 6.5 – ARCHIVE: Research Memory, Playbooks, and Trade Reviews
- **ARCHIVE Specialist Agent (`agents/archive/archiveAgent.js`, `agents/archive/index.js`)**:
  - Acts as the desk's memory and research librarian, saving, indexing, retrieving, linking, and summarizing trader knowledge.
  - Implements 14 natural language intents: `save_research`, `search_research`, `summarize_research`, `create_playbook`, `find_playbook`, `update_playbook`, `archive_trade`, `review_trade`, `find_similar_trades`, `find_trades_by_event`, `find_mistakes`, `generate_weekly_review`, `export_archive`, and `delete_archive_item`.
  - Distinguishes clearly between facts, user opinions, model estimates, and post-trade interpretations with mandatory model-generated labeling.
  - Hardcoded non-execution assertion (`assertArchiveCannotExecute`) preventing trade entry, modification, authorization, or cancellation.
- **SQLite Database with WAL Mode (`services/archive/archivePersistence.js`)**:
  - Full relational schema across 9 tables: `research_items`, `research_links`, `playbooks`, `playbook_trades`, `trade_reviews`, `archive_embeddings`, `archive_tags`, `archive_events`, `archive_exports`.
  - SQLite WAL mode enabled for concurrent reads and durable writes.
  - SQLite FTS5 full-text virtual table (`research_items_fts`) supporting BM25-ranked keyword queries across title, thesis, body, tags, symbol, setup, and regime.
- **Hybrid Retrieval Engine (`services/archive/retrieval.js`)**:
  - Combines exact symbol match, tag match, FTS5 keyword relevance, local vector cosine similarity, and recency decay.
  - Generates transparent match explanations detailing why an item was retrieved.
  - Includes specialized retrieval routines: `findSimilarTrades` (with optional cross-symbol learning), `findTradesByEvent` (macro calendar date windows), `findMistakes` (tagged recurring trading errors), and `getLinkedItems`.
- **Automatic Archiving Engine (`services/archive/autoArchive.js`)**:
  - Auto-archives completed trade-planning workflows, paper trade fills, trade closures, Sentinel vetoes with reasons, breaking news catalysts, and user notes.
  - Auto-drafts pre-populated trade reviews upon paper position exit.
- **Playbook Generation Engine (`services/archive/playbookEngine.js`)**:
  - Automatically synthesizes repeatable playbooks from historical closed trades.
  - Calculates mathematically verified performance: win rate, average R, profit factor, max drawdown, and data range.
  - Extracts common entry rules, invalidation rules, stop placement, targets, and position sizing.
  - Feeds historical expectancy to COMPASS during future trade planning without giving autonomous execution advice.
- **Trade Review & Process Scoring Engine (`services/archive/reviewEngine.js`)**:
  - Computes objective, transparent 10-point Process Score ($0–100$) separating trading discipline from outcome luck.
  - Calculates Discipline Score ($0–100$) tracking execution adherence.
  - Aggregates review statistics, mistake frequency distributions, emotional tags, and learning curve trends.
- **Cyber-HUD Archive Manager Panel (`app/src/components/ArchiveManagerView.jsx`)**:
  - Multi-tab HUD interface: Research, Playbooks, Trade Reviews, and Weekly Reviews.
  - Multi-dimensional filters (Symbol, Kind, Setup, Timeframe, Outcome, Regime, Tags, Date Range).
  - Detailed modal view with source chips, links to trades/workflows/news/filings, and "Use in Current Plan" action.
  - Direct Export controls supporting Markdown, JSON, and CSV.
- **Zero-Cloud Privacy Invariants**:
  - Local-first persistence by default; no cloud upload or telemetry.
  - No unsolicited LLM access to private journal entries.
  - Cascading deletion across items, links, FTS5 rows, and embeddings.
- **Automated Test Suite (100% Pass Rate)**:
  - **184/184 tests passing** across 17 test suites:
    - `tests/unit/archive/archive.test.js` (13 tests)
    - `tests/integration/archive/archive-integration.test.js` (30 tests)
    - `tests/contract/archive/archive-contract.test.js` (13 tests)
    - `tests/integration/archive-search/archive-search.test.js` (17 tests)
    - Plus all existing suites (trade planning, routines, alerts, compass, workflow engine, chart router, config).

## [5.5.0-relay-alerts] - 2026-10-28
### Completed: Phase 5.5 – RELAY: Alerts, Routines, and Proactive Desk Awareness
- **RELAY Specialist Agent (`agents/relay/relayAgent.js`, `agents/relay/index.js`)**:
  - Acts as the desk's vigilant watchtower monitoring prices, indicators, breaking news, SEC filings, calendar events, position risk, and system health.
  - Natural language alert parser converts trader prompts (e.g. *"Alert me if NVDA breaks above 150"*, *"Tell me when TSLA RSI goes above 70 on the daily"*, *"Alert me on any new 8-K from NVDA"*, *"Notify me 30 minutes before CPI"*, *"Warn me if any open position loses more than 2%"*) into structured, validated `AlertSchema` records.
  - Ambiguity detection: Proactively asks concise clarifying questions when requirements are underspecified.
  - Strict security invariants: Hardcoded checks preventing order execution, trade modification, trade authorization, token creation, or risk rule bypass.
- **Alert Evaluation Engine (`services/alerts/evaluator.js`)**:
  - Real-time condition evaluation across Price, Indicator, News, Filing, Calendar, Position-Risk, and Data-Health alerts.
  - True crossing logic: Fires only on genuine threshold crossing ($prev \le threshold \land current > threshold$), preventing phantom triggers when price was already beyond threshold at creation unless explicitly configured.
  - Timezone & active hours awareness: Restricts alerts to specified market sessions in `America/New_York`.
  - Cooldown and one-shot lifecycle management: Automatically transitions one-shot alerts to `triggered` state while recurring alerts enforce per-alert cooldown windows.
  - Stale quote protection: Immediately skips price/indicator alerts when incoming data is stale.
  - Deduplication: In-memory cache preventing duplicate triggers on the same news story or filing accession number.
- **Timezone-Aware Routine Scheduler (`services/alerts/routineScheduler.js`)**:
  - `node-cron` scheduler with explicit `America/New_York` timezone support and overlap prevention.
  - 5 Built-in routines seeded in SQLite: Pre-market briefing (09:00 ET), Market-open checklist (09:30 ET), Midday risk check (13:00 ET), Post-market review (16:15 ET), and Weekly journal review (Friday 17:00 ET).
  - Lifecycle controls: schedule, stop, run now, and inspect running status.
- **SQLite Persistence Layer (`services/alerts/alertPersistence.js`)**:
  - Local database storage across 3 relational tables: `alerts`, `routines`, and `alert_events`.
  - Complete CRUD operations for alerts and routines with audit trail history.
- **Multi-Tier Notification Engine & HUD Components (`AlertManagerView.jsx`, `AlertToast.jsx`)**:
  - Streaming Signal Log integration.
  - Non-blocking HUD toast with severity-coded colors (info, important, critical), auto-dismiss timer, and 1-click symbol chart routing.
  - Web Audio API synthesized chimes with global mute toggle.
  - Opt-in OS desktop notifications respecting `Notification.permission`.
  - Dedicated "ALERTS" desk tab with tabs (Active, Paused, Triggered, Expired), bulk controls, search, type filters, test evaluation runner, and quick alert creation modal.
- **Automated Test Suite (100% Pass Rate)**:
  - **111/111 tests passing** across 13 test suites:
    - `tests/contract/alerts/alertContract.test.js` (5 tests)
    - `tests/unit/relay/relay.test.js` (6 tests)
    - `tests/integration/alerts/alerts.test.js` (13 tests)
    - `tests/integration/routines/routines.test.js` (2 tests)
    - `tests/workflowEngine.test.js` (20 tests)
    - `tests/chartRouter.test.js` (9 tests)
    - `tests/contract/trade-plan/tradePlanContract.test.js` (6 tests)
    - `tests/unit/compass/compass.test.js` (6 tests)
    - `tests/compass.test.js` (25 tests)
    - `tests/integration/trade-planning/tradePlanning.test.js` (3 tests)
    - `tests/unit/workflow/workflowEngine.test.js` (7 tests)
    - `tests/config.test.js` (4 tests)
    - `tests/contract.test.js` (5 tests)

## [2.5.0-compass-workflows] - 2026-10-28
### Completed: Phase 2.5 – COMPASS Trade Planner & Persistent Workflow Engine
- **COMPASS Trade Planner Agent (`agents/compass/compassAgent.js`, `agents/compass/contract.js`)**:
  - Transforms natural language trade requests into rigorous, deterministic, mathematically structured trade plans.
  - Multi-setup support: Swing, Breakout, Pullback-to-level, Catalyst/Earnings, Scalp, and Daytrade.
  - Full trade plan schema: Thesis, market regime, entry trigger, stop-loss, targets (T1/T2), reward:risk ratio (min 1.5R), position size, risk amount ($), invalidation conditions, and known event risks.
  - Strict security boundary: COMPASS is strictly prohibited from executing orders, generating Sentinel approval tokens, or bypassing risk gates.
- **Deterministic Multi-Step Workflow Engine (`master/workflow/workflowEngine.js`, `master/workflow/sqlitePersistence.js`)**:
  - Deterministic state machine coordinating multi-agent pipelines:
    `ATLAS → NEWSROOM → ATHENA → CHARTIST → ORACLE → COMPASS → SENTINEL → USER (Gate) → PILOT (Phase 3)`
  - Full SQLite persistence across 4 relational tables (`workflows`, `workflow_steps`, `workflow_events`, `workflow_artifacts`) with zero external C++ build dependencies via Node 22 native `node:sqlite`.
  - Parallel execution group (`parallelGroup: market_intelligence`) running ATLAS, NEWSROOM, ATHENA, CHARTIST, and ORACLE concurrently with per-step timeouts (8000ms).
  - Out-of-the-box templates: `plan_equity_swing_trade` (10 steps), `plan-breakout-trade` (8 steps), `pre-market-briefing` (5 steps), `earnings-catalyst-play` (9 steps).
  - Mandatory human confirmation safety gate (`waiting_for_user`) before any paper order execution, integration activation, or risk boundary alteration.
  - Complete workflow lifecycle operations: Create, Advance, Confirm, Pause, Resume, Cancel, and HUD summary telemetry.
- **Independent Sentinel Risk Review (`services/sentinelReview.js`)**:
  - Pre-execution validation enforcing mandatory directional stop, $R:R \ge 1.5$, position size $\le 2\%$ portfolio risk limit, and imminent event/earnings conflict detection.
  - Issues `SentinelVerdictSchema` (`approve`, `modify`, `veto`).
  - Immutable veto rule: Vetoed plans cannot be approved by the user, and the UI disables the "Approve & Arm" button.
- **Interactive Workflows View & Cyber-HUD Components (`WorkflowView.jsx`, `WorkflowTimeline.jsx`, `TradePlanCard.jsx`)**:
  - Visual pipeline showing step-by-step agent execution with real-time status badges and elapsed execution timer.
  - High-priority safety gate banner ("Waiting For You") with "Approve & Arm" / "Reject Plan" controls.
  - 1-Click Template Launcher with quick ticker selector (NVDA, SPY, QQQ, AAPL, TSLA).
  - COMPASS Trade Plan card with color-coded R:R ratio, risk brackets, thesis invalidations, source citation chips, and `MODEL-ESTIMATED` badges.
- **API Server & Routing (`vite.config.js`, `services/geminiService.js`, `app/src/services/deskService.js`)**:
  - Live REST endpoints: `/api/workflows`, `/api/workflows/templates`, `/api/workflow/action`, `/api/compass/plan`, `/api/compass/plans`, `/api/compass/health`.
  - Intent classification routing commands like *"Plan a swing trade in AAPL"* or *"Should I buy 100 NVDA?"* directly to COMPASS and workflow pipelines.
- **Architectural & Security Documentation**:
  - Created [`ARCHITECTURE.md`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/ARCHITECTURE.md) documenting agent roster, state machine transitions, SQLite schema, and pipeline flow.
  - Created [`SECURITY.md`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/SECURITY.md) documenting `LIVE_TRADING=false` enforcement, least privilege boundaries, Sentinel veto mechanics, and client renderer isolation.
- **Automated Test Suite (100% Pass Rate)**:
  - **85/85 tests passing** across 9 test suites:
    - `tests/workflowEngine.test.js` (20 tests)
    - `tests/config.test.js` (4 tests)
    - `tests/chartRouter.test.js` (9 tests)
    - `tests/contract/trade-plan/tradePlanContract.test.js` (6 tests)
    - `tests/integration/trade-planning/tradePlanning.test.js` (3 tests)
    - `tests/unit/workflow/workflowEngine.test.js` (7 tests)
    - `tests/unit/compass/compass.test.js` (6 tests)
    - `tests/compass.test.js` (25 tests)
    - `tests/contract.test.js` (5 tests)

## [1.2.0-chart-takeover] - 2026-10-28
### Completed: Step C & Phase 8 – TradingView Full Chart Takeover & Trade Overlay Engine
- **Machine-Readable Capability Map (`services/chart/capabilities.json`)**:
  - Audited all 11 chart capabilities against official TradingView MCP boundaries.
  - Documented honest fallbacks: Priority 1 (TradingView Desktop MCP), Priority 2 (Embedded Advanced Charts), and Priority 3 (Lightweight Limited Mode).
  - Explicit disclosures for Bar Replay (simulated stepper) and Pine Script (code generator only; execution requires Desktop).
- **HUD Health Panel (`HealthModal.jsx`)**:
  - System Health & Capabilities Inspector modal accessible from `TopBar` and `ChartView`.
  - Live status for Symbol Control, Timeframe Control, Chart Type Control, Indicators, Drawings, Layouts, Replay, Alerts, Pine Script, Screenshots, and Paper-Order Mirroring.
- **Chart Command Router (`services/chart/chartRouter.js`)**:
  - Master router handling 20 chart intents with strict agent authority validation.
  - Security gate: Analysis agents (Athena, Chartist, Oracle, Atlas, Scout, Capitol) are strictly prohibited from placing or authorizing paper orders.
  - Oracle honesty rule enforced: Forecast bands automatically labelled `(model-estimated, not a prediction)`.
- **Trade-Aware Chart State Store (`services/chart/chartTradeOverlay.js`)**:
  - Direct mapping between each paper trade and its chart drawings (entry line, stop-loss line, take-profit line, trade label, risk/reward zone).
  - When trades are closed or cancelled, drawings are purged immediately, guaranteeing zero orphaned lines.
- **Natural Voice & Text Command Handlers**:
  - "Pull up NVDA and mark the levels" -> Symbol switch + Key Support/Resistance + Buyside Liquidity + EMA & RSI.
  - "Add VWAP and volume profile to NVDA" -> Chartist indicator injection.
  - "Mark the daily supply zone" -> Athena/Chartist supply/demand rectangular zone.
  - "Draw a Fibonacci retracement from the last swing low to swing high" -> Golden pocket 0.618 level calculation.
  - "Switch to 5-minute Heikin Ashi" -> Timeframe & chart style switcher.
  - "Start replay from yesterday's open" -> Honest replay capability handler with simulated stepper fallback.
  - "Set an alert if NVDA crosses 150" -> Sentinel price cross alert armed.
  - "Show my open trade levels on the chart" -> Active paper trade brackets rendered on canvas.
  - "Clear all F.R.I.D.A.Y. drawings, but keep my manual drawings" -> Purges agent drawings while strictly preserving manual drawings.
- **Unit Test Suite (`tests/chartRouter.test.js`)**:
  - 18/18 tests passing (9 new tests covering router, permissions, trade overlays, orphaned drawing prevention, honesty disclosures, and voice parser).
### Full Real-Time Integration & 100% Free Tier Optimization
- **Zero Demo / Mock Data**: Removed demo layout banner and placeholder badges; all numbers are now backed by live feeds or the local paper engine.
- **Finnhub Live Market Pulse**: Real-time quotes for SPY ($767.01), QQQ ($716.76), NVDA ($217.30), and BTC ($80,242) with auto-refresh every 20s.
- **Real NYSE Session Clock**: Computes active market phase (Market Open, Pre-Market, After-Hours, Closed) and exact minute countdown to close (e.g. "CLOSES IN 5H 28M") using Eastern Time.
- **Google Gemini Flash Orchestration (100% Free Tier)**: Connected user's Gemini key to orchestrate the desk across all 9 specialist agents with high-availability fallback.
- **Removed Unused Paid Provider Configs**: Cleaned out OpenAI and Anthropic dependencies; system is 100% free of charge.
- **Live Newsroom Feed**: Pulling real-time general news wires and SEC EDGAR disclosures via Finnhub.
- **Free Web Speech Synthesis**: Integrated browser voice synthesis so F.R.I.D.A.Y. speaks replies out loud with zero external API fees.

## [1.0.0-phase1] - 2026-10-27
### Completed: Phase 1 – Foundation, Architecture & Pixel-Accurate HUD
- **Master Architecture Blueprint & TradingView MCP Capability Assessment**:
  - Detailed report on TradingView MCP capabilities (navigation, timeframe, study inspections, overlays/drawings) vs boundaries (no order execution API).
  - Designed gated money path: Proposal -> Sentinel signed HMAC approval token -> Pilot SQLite Paper Engine -> Chartist Drawing -> Ledger Journal.
- **Electron + React + Vite Foundation**:
  - Secure Electron shell with `contextIsolation: true`, `nodeIntegration: false`, and strict IPC preload bridge (`app/electron/preload.js`).
  - Pure Vanilla CSS design tokens with futuristic cyber-HUD glassmorphism, scanlines, and glow effects (`app/src/index.css`).
- **HUD Interface (Matching Reference Screenshot)**:
  - Header: Digital clock with real-time seconds, Melbourne/NYSE timezone clocks, desk telemetry counters, and service connectivity indicators (`TopBar.jsx`).
  - Left Panel: `MarketPulse.jsx` (4 circular radial arc meters for SPY, QQQ, NVDA, BTC with live tags), `DeskQueue.jsx` (task status and pending backtest badges), and `SignalLog.jsx` (real-time streaming agent event log).
  - Center Canvas: `CentralOrb.jsx` with glowing radiant sphere, concentric rotating orbital rings, 5 dynamic states (idle, listening, thinking, speaking, focus), and 9 orbiting satellite specialist nodes with wing badges and interactive diagnostics modal.
  - Desk Equity Display: Glowing `$1,604,199 [PAPER]` with key desk stats (In Play: 6, Watching: 231, Signals: 61, Scans: 167, Alerts: 4).
  - Right Panel: `SessionWidget.jsx` (NYSE market open status with countdown timer), `CalendarWidget.jsx` (September 2026 grid with FOMC/OPEX markers), and `AgentLoadWidget.jsx` (9 horizontal load meters matching reference order).
  - Secondary Views: Functional mock tabs for `PortfolioView.jsx`, `NewsView.jsx`, and `JournalView.jsx`.
  - Command Bar: Typed prompt with dispatch, state toggles, push-to-talk mic listener (`Space` key), and mandatory educational disclaimer.
- **Shared Contracts & Test Suite**:
  - `shared/contract.js`: Strict validation for agent request and response envelopes with mandatory "sources" citing.
  - `shared/config.js`: Central configuration with risk boundaries and agent profiles.
  - Unit tests in `tests/contract.test.js` and `tests/config.test.js` passing 100% (9/9 tests).

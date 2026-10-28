# CHANGELOG - F.R.I.D.A.Y. The Trading Desk

All notable changes to this project will be documented in this file.

## [2.5.0-compass-workflows] - 2026-10-28
### Completed: Phase 2.5 – COMPASS Trade Planner & Persistent Workflow Engine
- **COMPASS Trade Planner Agent (`agents/compass/compassAgent.js`, `agents/compass/contract.js`)**:
  - Transforms natural language trade requests into rigorous, deterministic, mathematically structured trade plans.
  - Multi-setup support: Swing, Breakout, Pullback-to-level, Catalyst/Earnings, Scalp, and Daytrade.
  - Full trade plan schema: Thesis, market regime, entry trigger, stop-loss, targets (T1/T2), reward:risk ratio (min 1.5R), position size, risk amount ($), invalidation conditions, and known event risks.
  - Strict security boundary: COMPASS is strictly prohibited from executing orders, generating Sentinel approval tokens, or bypassing risk gates.
- **Persistent Multi-Step Workflow Engine (`services/workflow/workflowEngine.js`)**:
  - Robust multi-agent workflow state machine (ATLAS → SCOUT → ATHENA → CHARTIST → ORACLE → COMPASS → SENTINEL → USER → PILOT → LEDGER).
  - Out-of-the-box templates: `plan-swing-trade` (10 steps), `plan-breakout-trade` (8 steps), `pre-market-briefing` (5 steps), `earnings-catalyst-play` (9 steps).
  - Mandatory user confirmation gates (`awaiting-user`) before any paper order execution, integration activation, risk limit modification, or data deletion.
  - Complete workflow lifecycle operations: Create, Advance, Confirm, Pause, Resume, Cancel, and HUD summary telemetry.
- **Interactive Workflows View & Cyber-HUD Components (`WorkflowView.jsx`, `WorkflowTimeline.jsx`, `TradePlanCard.jsx`)**:
  - Visual pipeline showing step-by-step agent execution with real-time status badges.
  - High-priority pulsing safety gate alert banner with "CONFIRM & PROCEED" / "REJECT" controls.
  - 1-Click Template Launcher with quick ticker selector (NVDA, SPY, QQQ, AAPL, TSLA).
  - COMPASS Trade Plan dossier card with color-coded R:R ratio, risk brackets, thesis, and 1-click Chart Level injection.
- **API Server & Routing (`vite.config.js`, `services/geminiService.js`, `app/src/services/deskService.js`)**:
  - Live REST endpoints: `/api/workflows`, `/api/workflows/templates`, `/api/workflow/action`, `/api/compass/plan`, `/api/compass/plans`, `/api/compass/health`.
  - Intent classification routing commands like "Plan a swing trade in AAPL" or "Plan a breakout trade for TSLA" to COMPASS and launching pipelines.
- **Automated Test Suite**:
  - 63/63 tests passing across 5 suites (`workflowEngine.test.js`, `compass.test.js`, `chartRouter.test.js`, `contract.test.js`, `config.test.js`).

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

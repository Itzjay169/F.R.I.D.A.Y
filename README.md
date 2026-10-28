# F.R.I.D.A.Y. – The Trading Desk

> **Educational Research Co-Pilot & Real-Time Trading Intelligence Desk**  
> *Paper trading only. Not financial advice. No real money or live broker connections.*

---

## Overview
F.R.I.D.A.Y. is a voice-driven AI trading research desk powered by a central orchestrator commanding nine specialist agents. The desk provides real-time market awareness, news analysis, chart telemetry via TradingView MCP, and a cryptographically gated SQLite paper trading engine.

## Agent Roster
1. **F.R.I.D.A.Y. (Master Orchestrator)**: Synthesizes intelligence, coordinates specialist agents in parallel, and speaks the final brief.
2. **ATLAS (Macro Analyst)**: Federal Reserve policy, interest rates, macroeconomic indicators (CPI/Jobs), yields, and DXY.
3. **CAPITOL (Smart Money)**: SEC Form 4 insider transactions, institutional 13F filings, and congressional disclosures.
4. **SCOUT (Recon)**: Real-time volume spikes, top movers, market momentum, and trending watchlist tickers.
5. **NEWSROOM (News Desk)**: Multi-feed news aggregation (Finnhub, SEC 8-K, RSS), deduplication, and breaking alerts.
6. **ATHENA (Fundamental Analyst)**: 10-K/10-Q filing summaries, earnings transcripts, and supply/demand structure.
7. **CHARTIST (Technician)**: Multi-timeframe technical analysis, automated TradingView overlays (entry, stop, target), and fallback lightweight charts.
8. **ORACLE (Quant)**: Statistical probabilistic forecasting and confidence bounds.
9. **COMPASS (Trade Planner)**: Transforms natural language trade requests into structured, risk-defined trade plans with invalidation rules, event-risk checks, and R:R ratios. Strictly prohibited from executing trades.
10. **SENTINEL (Risk Officer)**: Evaluates trade risk, mandates stop-losses, checks daily drawdowns, and holds **VETO** power. Issues cryptographic approval tokens.
11. **PILOT (Execution)**: Fills paper orders in SQLite only upon presentation of a valid Sentinel approval token.
12. **LEDGER (The Book)**: Journals all desk calls, tracks paper P&L, audits performance metrics, and detects execution errors.
13. **RELAY (Alert & Routine Manager)**: The desk's watchtower. Monitors price thresholds, indicators, SEC filings, macro calendar dates, position risk, and data health. Executes scheduled timezone-aware market routines. Strictly prohibited from trading.

---

## 🔔 RELAY Alert & Routine Manager (Phase 5.5)
- **Natural Language Alert Engine**: Evaluates natural language commands into structured alerts:
  - *"Alert me if NVDA breaks above 150."* (Price crosses above)
  - *"Alert me if AAPL drops below 180."* (Price crosses below)
  - *"Tell me when TSLA RSI goes above 70 on the daily."* (Indicator threshold)
  - *"Alert me on any new 8-K from NVDA."* (EDGAR filing alert)
  - *"Notify me 30 minutes before CPI."* (Macro calendar lead-time alert)
  - *"Warn me if any open position loses more than 2%."* (Position-risk alert)
- **Timezone-Aware Routine Scheduler**: Built on `node-cron` with explicit `America/New_York` market session alignment and strict execution overlap prevention.
  - 5 Built-in Routines: Pre-market briefing (09:00 ET), Market-open checklist (09:30 ET), Midday risk check (13:00 ET), Post-market review (16:15 ET), Weekly journal review (Friday 17:00 ET).
- **Multi-Tier Notifications**: Persistent Signal Log entries, non-blocking HUD toasts with auto-dismiss and 1-click symbol chart routing, optional Web Audio synthesized chime alerts, and opt-in OS desktop notifications (`Notification.permission`).
- **SQLite Persistence**: Full local persistence across 3 relational tables (`alerts`, `routines`, `alert_events`).
- **Security Boundary**: RELAY can alert and request Sentinel risk reviews, but is strictly prohibited from executing, modifying, or authorizing paper orders.

---

## 🧭 COMPASS Trade Planner & Workflow Engine (Phase 2.5)
- **Deterministic Trade Planning**: Commands such as *"Plan a swing trade in AAPL"* or *"Create a breakout plan for TSLA"* yield complete structured trade plans (entry trigger, stop-loss, targets T1/T2, reward:risk, position size, and thesis invalidations).
- **Persistent Workflow State Machine (`master/workflow`)**: Executes deterministic pipelines with full SQLite persistence across 4 tables (`workflows`, `workflow_steps`, `workflow_events`, `workflow_artifacts`).
- **Parallel Intelligence Gathering**: Concurrently executes `[ATLAS, NEWSROOM, ATHENA, CHARTIST, ORACLE]` with per-step timeouts (default 8000ms), followed by COMPASS plan synthesis and SENTINEL independent risk review.
- **Mandatory User Confirmation Gates**: Workflows halt automatically at step 9 (`waiting_for_user`) and require explicit human approval before placing paper trades or changing risk boundaries. If Sentinel issues a VETO, the "Approve & Arm" button is permanently disabled.
- **HUD Workflows View**: Multi-agent pipeline visualizer (`WorkflowTimeline`), dynamic step status badges, and COMPASS trade plan card (`TradePlanCard`) with source citations and confidence indicators.

## 🛡️ Architecture & Security Documents
- 📐 **System Architecture**: Detailed in [ARCHITECTURE.md](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/ARCHITECTURE.md) (agent roster, state machine transitions, SQLite relational tables, and parallel execution pipeline).
- 🔒 **Security Policy**: Detailed in [SECURITY.md](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/SECURITY.md) (kernel-level `LIVE_TRADING=false`, analysis agent execution veto, single gated money path, and zero-secrets client isolation).

---

## 📈 Full TradingView Chart Control (Step C / Phase 8)
- **Primary Integration & Fallback Priority**:
  1. `tradingview_desktop_mcp` (Desktop client control when connected on port 8080)
  2. `embedded_advanced_charts` (High-performance embedded Advanced Charts workstation with full drawing tools)
  3. `lightweight_limited_mode` (Emergency fallback)
- **Machine-Readable Capability Map**: Available live at [`services/chart/capabilities.json`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/services/chart/capabilities.json) and inspected in real time via the **HUD Health Panel (`DESK SERVICES · HEALTH AUDIT`)**.
- **Honesty Disclosures**: TradingView official MCP boundaries are explicitly documented: Bar Replay uses an honest historical tick stepper fallback, and Pine Script compilation requires TradingView Desktop.
- **Trade-Aware Chart State**: Paper orders automatically mirror entry, stop-loss, and take-profit lines onto the chart, which are purged when trades close to ensure **zero orphaned drawings**.
- **Natural Chart Commands**:
  - *"Pull up NVDA and mark the levels."* (Key support/resistance + liquidity + EMA/RSI)
  - *"Add VWAP and volume profile to NVDA."*
  - *"Mark the daily supply zone."*
  - *"Draw a Fibonacci retracement from the last swing low to swing high."*
  - *"Switch to 5-minute Heikin Ashi."*
  - *"Set an alert if NVDA crosses 150."*
  - *"Show my open trade levels on the chart."*
  - *"Clear all F.R.I.D.A.Y. drawings, but keep my manual drawings."*

---

## 🚀 Quick Start & Portable Deployment

### 1-Click Launch on ANY Windows Laptop (Zero Software Required!)
If you take this folder to a brand new laptop with **no Node.js or software installed**:
- **Double-click `START_STANDALONE.bat`**: Launches instantly in 1 second using Windows native PowerShell!
- **Double-click `START_FRIDAY.bat`**: Auto-detects environment, downloads portable Node.js from `nodejs.org` if needed, and launches the full development desk!

See [PORTABLE_GUIDE.md](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/PORTABLE_GUIDE.md) for laptop migration and [VOICE_COMMANDS.md](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/VOICE_COMMANDS.md) for the complete voice command directory.

---

### Manual Developer Commands
```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Build production bundle
npm run build

# 4. Start Vite dev server (live at http://localhost:5173/)
npm run dev:vite

# 5. Launch full Electron Desktop App
npm run dev
```

---

## Phase 1 Pass/Fail Checklist
- [x] Master Architectural Blueprint (`friday_master_plan.md`)
- [x] TradingView MCP capability check report
- [x] Electron + React + Vite skeleton with contextIsolation ON & strict IPC
- [x] HUD visual replication matching reference image pixel-accurately
- [x] Animated Central Orb with 5 interactive states (idle, listening, thinking, speaking, focus)
- [x] 9 Satellite specialist agent nodes with status lights and diagnostic modal
- [x] Market Pulse with 4 circular radial gauges
- [x] Desk Queue with 6 open tasks and backtest alerts
- [x] Streaming Signal Log with agent badges and auto-scroll
- [x] Market Session widget with real-time NYSE open status and countdown
- [x] Calendar widget with FOMC & OPEX event markers
- [x] Agent Load widget with horizontal meters in exact reference order
- [x] Secondary views (Portfolio, Newsroom, Journal)
- [x] Command prompt bar with keyboard push-to-talk (`Space`)
- [x] Shared message contract validation with mandatory sources (`tests/contract.test.js`)
- [x] Configuration & safety rule tests (`tests/config.test.js`)


## Phase 2.5 Pass/Fail Checklist (COMPASS & Workflow Engine)
- [x] Specialist agent **COMPASS** in [`agents/compass`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/agents/compass) with `TradePlanSchema` Zod validation
- [x] Persistent workflow state machine in [`master/workflow`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/master/workflow) with SQLite persistence
- [x] 4 SQLite relational tables: `workflows`, `workflow_steps`, `workflow_events`, and `workflow_artifacts`
- [x] Parallel intelligence gathering: concurrent execution of `[ATLAS, NEWSROOM, ATHENA, CHARTIST, ORACLE]` with 8000ms timeouts
- [x] Default 10-step template: `plan_equity_swing_trade` synthesizing macro, news, fundamentals, technicals, and quant outlook
- [x] Independent Sentinel risk review ([`services/sentinelReview.js`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/services/sentinelReview.js)) enforcing mandatory stop, $R:R \ge 1.5$, position size limits, and catalyst conflict checks
- [x] Mandatory Human Confirmation Gate (`waiting_for_user`) with disabled Approve button on Sentinel VETO
- [x] Cyber-HUD visualization: [`WorkflowTimeline.jsx`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/app/src/components/WorkflowTimeline.jsx) and [`TradePlanCard.jsx`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/app/src/components/TradePlanCard.jsx) with source chips and model-estimated tags
- [x] Zero PILOT execution in Phase 2.5: strict pipeline termination prior to live or paper order submission
- [x] 100% test pass rate: **85/85 tests passing** across 9 test suites
- [x] Architectural & Security documentation: [`ARCHITECTURE.md`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/ARCHITECTURE.md) and [`SECURITY.md`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/SECURITY.md)

## Phase 5.5 Pass/Fail Checklist (RELAY Alerts, Routines & Proactive Awareness)
- [x] Specialist agent **RELAY** in [`agents/relay`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/agents/relay) with `AlertSchema` and `RoutineSchema` Zod validation
- [x] Natural language alert parser supporting Price, Indicator, News, Filing, Calendar, Position-Risk, and Data-Health categories
- [x] Alert evaluation engine ([`services/alerts/evaluator.js`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/services/alerts/evaluator.js)) with true threshold crossing, active hours (`America/New_York`), cooldown, deduplication, and stale quote protection
- [x] Routine scheduler ([`services/alerts/routineScheduler.js`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/services/alerts/routineScheduler.js)) with `node-cron`, timezone support, and strict overlap prevention
- [x] 5 Built-in market routines seeded in SQLite: Pre-market briefing, Market-open checklist, Midday risk check, Post-market review, and Weekly journal review
- [x] SQLite persistence layer ([`services/alerts/alertPersistence.js`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/services/alerts/alertPersistence.js)) managing `alerts`, `routines`, and `alert_events`
- [x] Multi-tier notifications: Signal Log streaming, non-blocking HUD toasts ([`AlertToast.jsx`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/app/src/components/AlertToast.jsx)), audio chimes, and opt-in OS desktop notifications
- [x] Cyber-HUD Watchtower panel ([`AlertManagerView.jsx`](file:///c:/Users/jayki/OneDrive/Desktop/FRIDAY/app/src/components/AlertManagerView.jsx)) with tabs, filters, search, quick alert creator, and routine controls
- [x] Strict security boundary: RELAY cannot execute trades, authorize orders, or bypass Sentinel/Pilot
- [x] Full automated test coverage: **111/111 tests passing** across 13 test suites

---

## Disclaimer
*Educational research co-pilot. Not financial advice. Paper trading only. Always do your own research.*

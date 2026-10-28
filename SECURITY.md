# F.R.I.D.A.Y. 2.0 Security & Risk Architecture

> **Security Policy, Isolation Boundaries, and Gated Execution Protocols**  
> *Paper Trading Only · Educational & Research Desk · No Financial Advice*

---

## 1. Core Security Model

F.R.I.D.A.Y. 2.0 is designed from the ground up as a research-first, paper-trading system. The desk enforces multi-tier security boundaries ensuring that under no circumstances can an AI agent, natural language prompt, or workflow automation execute unauthorized trades or connect to live broker capital.

### Non-Negotiable Guarantees

1. **`LIVE_TRADING=false` Enforced at Kernel Level**:
   - The central configuration (`shared/config.js`) hardcodes `LIVE_TRADING=false`.
   - No real-money brokerage APIs (e.g. Interactive Brokers TWS, Alpaca Live, TD Ameritrade live credentials) are configured, accessible, or routed within the codebase.
   - Any attempt to toggle live execution is blocked at runtime.

2. **Paper Trading Isolation**:
   - All simulated orders and fills exist solely within a local SQLite database table.
   - P&L, balance tracking, and execution fills are purely mathematical simulations.

---

## 2. Specialist Agent Authority & Execution Boundaries

Every specialist agent operates under the **Principle of Least Privilege**:

```mermaid
graph LR
    subgraph Read & Analyze Only [No Order Authority]
        ATLAS[ATLAS]
        NEWSROOM[NEWSROOM]
        ATHENA[ATHENA]
        CHARTIST[CHARTIST]
        ORACLE[ORACLE]
        CAPITOL[CAPITOL]
        SCOUT[SCOUT]
        COMPASS[COMPASS]
        RELAY[RELAY]
    end

    subgraph Risk Gate
        SENTINEL[SENTINEL · VETO Authority]
        USER[HUMAN USER · Final Approval Gate]
    end

    subgraph Paper Execution
        PILOT[PILOT · Paper Execution Only]
    end

    COMPASS -->|Draft TradePlan| SENTINEL
    RELAY -->|Request Risk Audit| SENTINEL
    SENTINEL -->|Review: Approve / Veto| USER
    USER -->|Explicit Confirmation| PILOT
```

### Analysis Agent Veto
The analysis and watchtower agents (`COMPASS`, `ATHENA`, `CHARTIST`, `ORACLE`, `ATLAS`, `SCOUT`, `CAPITOL`, `NEWSROOM`, `RELAY`):
- Have **zero** access to execution endpoints or order book functions.
- Cannot place, cancel, or modify simulated orders.
- Cannot sign or forge risk approval tokens.
- Cannot alter account risk settings, max drawdown limits, or position sizes.

### COMPASS Security Invariant
`COMPASS` is a dedicated trade-planning agent. It receives market intelligence and synthesizes a structured `TradePlanSchema`. By design:
- It **never** contacts the paper execution engine.
- It **never** generates execution tokens.
- It always submits its draft output to `SENTINEL` for risk checking.

### RELAY Security Invariant (Phase 5.5)
`RELAY` is the desk's watchtower and routine manager. By hardcoded design:
- It can alert and stream notifications to the Signal Log, HUD toasts, and desktop.
- It can request an independent `SENTINEL` risk audit or trigger a read-only research workflow.
- It **never** places, modifies, fills, cancels, or approves any order or trade.
- It **never** alters risk parameters or drawdown thresholds.
- It cannot generate Sentinel cryptographic execution tokens or authorize PILOT.
- Any attempt to invoke order placement or trade approval through RELAY immediately triggers an immutable `SECURITY VIOLATION` exception.

---

## 3. The Single Gated Money Path

All trade executions (simulated paper orders) must travel through a strictly serial, cryptographically validated pipeline:

```
[Natural Language Request]
         ↓
[Parallel Intelligence Gathering (ATLAS, NEWSROOM, ATHENA, CHARTIST, ORACLE)]
         ↓
[COMPASS Synthesizes TradePlanSchema]
         ↓
[SENTINEL Independent Risk Audit]
         ↓
    [VETO?] ─── YES ───► [Execution Terminated · Approve Button Disabled]
         ↓ NO
[HUMAN USER Confirmation Gate (wait_for_user)]
         ↓
    [APPROVED?] ─── NO ───► [Workflow Cancelled / Rejected]
         ↓ YES
[HMAC-SHA256 Token Issuance]
         ↓
[PILOT Paper Order Execution (Phase 3)]
         ↓
[LEDGER Journal Audit]
```

### Immutable Sentinel Risk Rules
`SENTINEL` independently assesses every trade plan against hardcoded risk policies:
- **Mandatory Directional Stop-Loss**: Every trade plan must define a non-zero, directional stop-loss (Stop < Entry for Longs, Stop > Entry for Shorts). Plans without a stop are immediately vetoed.
- **Minimum Reward-to-Risk Ratio ($R:R \ge 1.5$)**: Plans offering less than 1.5R expected payoff are vetoed or forced to modify.
- **Maximum Account Risk ($\le 2\%$)**: The calculated dollar risk based on position size and stop-loss distance cannot exceed the account risk threshold.
- **Event Risk Quarantine**: Plans targeting stocks with imminent earnings announcements, FDA rulings, or major unscheduled binary catalysts within 24–48 hours are vetoed to avoid gap risk.

### Sentinel VETO Cannot Be Overridden
If `SENTINEL` issues a `veto`:
- The workflow state machine marks the risk review as failed.
- The UI frontend automatically **disables** the "Approve & Arm" button.
- The backend `/api/workflow/action` endpoint rejects any incoming approval payloads for a vetoed plan with HTTP 403 / Risk Violation.
- No human override or prompt manipulation can bypass a Sentinel veto.

---

## 4. Zero Secrets in Client Renderer

F.R.I.D.A.Y. enforces strict isolation between client-side UI code and backend execution environments:

1. **Environment Variables**:
   - API keys (Finnhub API key, Gemini API key, HMAC signing secrets) reside exclusively in `.env` read by Node.js server processes.
   - `.env` is explicitly registered in `.gitignore` and is never bundled into client JavaScript.
2. **Electron IPC Bridge**:
   - Electron shell runs with `contextIsolation: true` and `nodeIntegration: false`.
   - Communication between the HUD frontend and the operating system occurs exclusively over a sanitized IPC bridge (`preload.js`) with explicit channel whitelisting.
3. **No Direct Database Access from UI**:
   - The browser / HUD has zero direct connection to SQLite.
   - All state mutations occur through validated REST API endpoints (`/api/workflows`, `/api/workflow/action`).

---

## 5. Anti-Hallucination & Model Honesty

To eliminate financial hallucinations:
- **Explicit Missing Data Representation**: When an indicator, filing date, or metric is unavailable, it is displayed as `"—"` or `null`. Fabricated values are strictly prohibited.
- **Model-Estimated Tags**: All probabilistic bands generated by ORACLE must be visibly badged as `MODEL-ESTIMATED (NOT A PREDICTION)`.
- **Mandatory Data Sources**: Every trade plan must provide verifiable source citations (e.g. `finnhub`, `sec-edgar`, `tradingview`).

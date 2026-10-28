# F.R.I.D.A.Y. – Voice Command Reference Manual
> **The Complete Guide to Commanding the Real-Time AI Trading Desk by Voice**

---

## 🎙️ How to Use Voice Input

### Method 1: Push-To-Talk (Recommended)
1. **Hold down the `[SPACEBAR]`** on your keyboard (make sure your cursor is not typing in a text field).
2. The central glowing orb will pulse with a golden halo and the indicator will show **`MIC ACTIVE`**.
3. **Speak your command clearly** into your microphone.
4. **Release `[SPACEBAR]`** when you are done speaking.
5. F.R.I.D.A.Y. will transition to `THINKING` (spinning orbital rings), coordinate the 9 specialist agents, update the **Signal Log**, animate the orb into `SPEAKING` (with live soundwave bars), and **speak the response out loud**.

### Method 2: Click to Talk
- Click the **`PUSH TO TALK [SPACE]`** button in the bottom-right corner of the HUD to toggle listening mode on and off.

### Method 3: Typed Fallback
- You can also type any of the commands below directly into the bottom command bar (`>_`) and press **Enter** or click **`DISPATCH`**.

---

## 📋 Master Voice Command Directory

### 1. F.R.I.D.A.Y. (Master Orchestrator & Desk Status)
Commands that coordinate all 9 specialist agents and summarize overall desk health.

| Voice Command | What Happens |
|---|---|
| *"Status report"* | Synthesizes live market quotes, session clock, open paper positions, and overall desk posture. |
| *"Give me the pre-market briefing"* | Scans overnight futures, European markets, top pre-market movers, and day's agenda. |
| *"Desk overview"* | Summarizes open risk, Sentinel shield status, and active watchlist alerts. |
| *"What is our current desk equity?"* | Reports paper portfolio balance, unrealized P&L, and open positions. |

---

### 2. ATLAS (Macro, Fed Rates, CPI, Yields, Economic Calendar)
Commands routed to ATLAS for macroeconomic awareness and Federal Reserve telemetry.

| Voice Command | What Happens |
|---|---|
| *"What's the macro picture today?"* | Evaluates 10-year Treasury yields, DXY dollar index, VIX, and Fed rate expectations. |
| *"What's the Fed doing?"* | Queries latest Federal Reserve statements, FOMC rate hike/cut odds, and speech notes. |
| *"What is the economic calendar for this week?"* | Highlights key high-impact events (FOMC decisions, CPI prints, NFP jobs reports). |
| *"What are Treasury yields doing?"* | Checks the 2-year and 10-year yield curve inversion and bond market posture. |

---

### 3. CAPITOL (Smart Money, Insider Trades, Congress Disclosures)
Commands routed to CAPITOL to monitor institutional buying and regulatory disclosures.

| Voice Command | What Happens |
|---|---|
| *"What is Congress buying?"* | Parses recent STOCK Act periodic transaction filings by Senate and House members. |
| *"Any insider buying on Nvidia?"* | Scans SEC EDGAR Form 4 filings for corporate officers and director acquisitions. |
| *"What are institutional hedge funds buying?"* | Reviews institutional 13F quarterly filing disclosures for major funds. |
| *"Are insiders selling TSLA?"* | Verifies insider disposal disclosures (Form 4 / Form 144) for Tesla. |

---

### 4. SCOUT (Recon, Top Movers, Volume Spikes, Viral Tickers)
Commands routed to SCOUT for market discovery and breakout scanning.

| Voice Command | What Happens |
|---|---|
| *"What's going viral right now?"* | Scans social velocity, high-relative-volume tickers, and retail momentum. |
| *"Scan for top movers today"* | Identifies highest percentage gainers and volume breakout tickers. |
| *"What tickers have unusual volume spikes?"* | Detects tickers trading at >200% of their 30-day average volume. |
| *"What is moving in the tech sector?"* | Scans semiconductor and mega-cap tech momentum relative to the QQQ ETF. |

---

### 5. NEWSROOM (Live Breaking News & Regulatory Wire)
Commands routed to NEWSROOM for real-time market wires and corporate filings.

| Voice Command | What Happens |
|---|---|
| *"What's the market news right now?"* | Fetches the top recent macro headlines from Finnhub and Reuters wire feeds. |
| *"What's breaking?"* | Filters for high-urgency market disclosures filed within the last 60 minutes. |
| *"News on Nvidia"* | Aggregates company-specific press releases, SEC 8-K filings, and analyst notes. |
| *"Any breaking news on Tesla or Apple?"* | Pulls recent wire updates and catalyst alerts for the selected symbols. |

---

### 6. ATHENA (Fundamental Valuations, 10-K/10-Q Filings, Liquidity)
Commands routed to ATHENA for fundamental structure and company valuation.

| Voice Command | What Happens |
|---|---|
| *"Analyze Nvidia's fundamentals"* | Evaluates revenue growth, data center backlog, gross margins, and P/E ratios. |
| *"What did Tesla report in their latest filing?"* | Summarizes the most recent SEC 10-Q / 10-K filing disclosures. |
| *"What is the market structure on SPY?"* | Maps institutional supply/demand pools, fair value gaps, and liquidity sweeps. |
| *"Is Apple overvalued right now?"* | Assesses forward earnings multiples against historical valuation bands. |

---

### 7. CHARTIST (Technician, S/R Levels, TradingView Overlays)
Commands routed to CHARTIST for technical analysis and chart level drawing.

| Voice Command | What Happens |
|---|---|
| *"Pull up Nvidia and mark the levels"* | Switches active symbol, marks key support/resistance, and projects target brackets. |
| *"Where is the major support on SPY?"* | Identifies 200-day moving average, prior swing lows, and volume shelf supports. |
| *"What does the Bitcoin chart look like?"* | Examines higher-timeframe trend, consolidation ranges, and key breakout trigger prices. |
| *"Draw support and resistance on QQQ"* | Calculates and plots automated horizontal levels on the technical chart. |

---

### 8. ORACLE (Quant Forecasting & Statistical Probabilities)
Commands routed to ORACLE for statistical distribution models and scenario ranges.

| Voice Command | What Happens |
|---|---|
| *"Give me the forecast for NVDA"* | Calculates expected move probabilities, statistical confidence bands, and lookback model. |
| *"What is the probability of SPY closing green?"* | Estimates session continuation probabilities based on opening volatility and drift. |
| *"What is the expected range for Bitcoin this week?"* | Projects 1-standard-deviation implied volatility cones. |
| *"Run a quant distribution analysis on Tesla"* | Simulates scenario distribution without promising fixed certainty. |

---

### 9. SENTINEL (Risk Officer & Veto Gatekeeper)
Commands routed to SENTINEL to audit risk and inspect trade restrictions.

| Voice Command | What Happens |
|---|---|
| *"Why did you veto that trade?"* | Explains the exact mathematical risk failure (e.g., risk > 1% of equity, missing stop). |
| *"What is our maximum allowed risk per trade?"* | Verifies the 1% risk limit against current desk equity ($16,041 max dollar risk). |
| *"Audit our portfolio risk exposure"* | Calculates gross portfolio exposure, concentration per sector, and drawdown guard. |
| *"Check if buying 50 AAPL violates risk limits"* | Simulates position size and confirms if the stop loss satisfies risk parameters. |

---

### 10. PILOT & LEDGER (Gated Paper Trading & Journaling)
The **Gated Money Path**: All order commands are evaluated by Sentinel first; Pilot executes paper trades only with a valid approval token, and Ledger records the entry.

| Voice Command | What Happens |
|---|---|
| *"Should I buy 100 shares of NVDA?"* | **Full Multi-Agent Pipeline**: Athena valuations + Chartist levels + Oracle quant stats + Newsroom check $\rightarrow$ Sentinel risk decision $\rightarrow$ Pilot fills paper order if approved $\rightarrow$ Ledger journals $\rightarrow$ Friday speaks brief. |
| *"Paper buy 50 NVDA with a 2% stop"* | Proposes trade to Sentinel; if approved, Pilot logs paper buy fill at live market price. |
| *"Paper short 30 TSLA with stop at 250 and target 230"* | Proposes bracket short trade with defined risk; Sentinel verifies R:R $\ge 1.5$. |
| *"Flatten everything"* / *"Close all open positions"* | Pilot executes paper market exits across all open paper positions; updates realized P&L. |
| *"Show my paper P&L"* | Switches HUD to the Portfolio tab and speaks total unrealized and realized P&L. |
| *"Show the trade journal"* | Switches HUD to the Journal tab showing post-trade audits, win rate, and mistake notes. |

---

## 🔊 Audio & Speech Settings

- **TTS Engine**: Built-in Web Speech API (runs locally in your browser, 100% free of charge).
- **Voice Tuning**: F.R.I.D.A.Y. uses a crisp, natural British accent (`en-GB` / Sonia profile).
- **Visual Sync**: When F.R.I.D.A.Y. speaks, the central orb pulses and displays an oscillating soundwave equalizer inside its radiant core.
- **Push-to-Talk Indicator**: The bottom control bar displays `MIC ACTIVE` in amber when listening.

---

## 💡 Pro-Tips for Best Results

1. **Include Symbol and Stop Loss**: When asking to paper trade, always mention a stop loss (e.g. *"Paper buy 50 AAPL with a stop at 220"*). Sentinel **always vetoes** orders without defined stops!
2. **Natural Language**: You can speak conversationally — Gemini Flash parses intent, tickers, and parameters automatically.
3. **Microphone Permissions**: If your browser asks for microphone access when you first press `[SPACEBAR]`, click **Allow**.

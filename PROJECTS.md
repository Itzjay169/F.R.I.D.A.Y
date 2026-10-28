# F.R.I.D.A.Y. – THE TRADING DESK (MASTER SPEC)

You are a principal-level full-stack and AI-systems engineer. Build an Electron desktop app called "F.R.I.D.A.Y. – The Trading Desk": a voice-driven AI trading research desk where one master agent commands nine specialist agents. It gives live market data, recent trading news, chart control on TradingView, and PAPER trading only. A screenshot of the target HUD is attached as the visual reference.

Read this whole file before every phase. Write a plan first and wait for my approval. Then build phase by phase and stop after each phase for my "next".

---------------------------------------------------------------
## 0. WHAT THIS IS / IS NOT
- A research and awareness co-pilot with a built-in risk officer. It surfaces structure, news and context. It does NOT predict the future or promise outcomes.
- PAPER TRADING ONLY. No real broker, no real money, no live order routing.
- Footer on every screen: "Educational only. Not financial advice. Paper trading only."
- Never show or speak invented numbers. Every figure must come from a real feed or my own paper ledger. If a feed is down, show "—" and say so.

---------------------------------------------------------------
## 1. THE DESK (MASTER + 9 SPECIALISTS)
Master: F.R.I.D.A.Y. – orchestrator. The only agent that talks to me. Routes commands, calls agents in parallel, merges answers, speaks the reply. It never does specialist work itself.

Intelligence (what's happening):
1. ATLAS (Macro): Fed, rates, CPI/jobs data, economic calendar, market "weather" (indices, VIX, yields, dollar). Also owns macro headlines.
2. CAPITOL (Smart Money): insider buying/selling (SEC Form 4), big-fund holdings (13F), congressional trade disclosures. Use free public sources (SEC EDGAR, public disclosure sites). If a source is not free or not reachable, mark "data limited" instead of faking.
3. SCOUT (Recon): finds what is moving or going viral today: top gainers/losers, volume spikes, unusual movers, trending tickers from news volume.
4. NEWSROOM (News Desk) – see section 4. Owns recent trading news. Implement it as part of SCOUT's service OR as its own module; either way it must be a distinct, independently testable module.

Analysis (what it's worth):
5. ATHENA (Analyst): reads filings (10-K/10-Q/8-K summaries via SEC EDGAR), earnings, fundamentals, and calls chart structure (supply, demand, liquidity, trend) and explains it plainly.
6. CHARTIST (Technician): owns the chart screens. Flips symbols and timeframes, marks support/resistance, draws entry/stop/target levels on TradingView via the MCP. Fallback: a built-in lightweight chart (e.g. lightweight-charts) when TradingView is not connected.
7. ORACLE (Quant): forecasting (Google TimesFM if installable, otherwise a simple statistical fallback such as ARIMA/ETS). Answers in probabilities and ranges, never promises. Show the model name and the lookback used.

Execution (where money moves):
8. SENTINEL (Risk Officer): sizes every position, sets stops, enforces limits, holds VETO power. Nothing trades without its signed approval.
9. PILOT (Execution): places PAPER trades only, only with a valid approval token from Sentinel.
10. LEDGER (The Book): journals every call (especially the bad ones), tracks paper P&L, and watches system health.
(Master + 9 specialists. NEWSROOM is a module inside the Intelligence group and may share a seat with SCOUT, keeping the HUD at nine agent nodes.)

Each agent has: a name, role, personality, its own TTS voice, a status light (idle/working/done/error), and a one-line "last action".

---------------------------------------------------------------
## 2. ARCHITECTURE RULES (NON-NEGOTIABLE)
1. Each agent is an independent module/service with one job and a clean JSON interface. Adding a tenth agent must not change the other nine.
2. Shared contract (write once in /shared/contract, validate every message):
   request:  { id, from, to, intent, symbol?, params, context, deadline_ms }
   response: { id, agent, status: "ok"|"error"|"veto"|"limited", summary, data, sources: [..], confidence: 0-1, spoken_text, timestamp }
   - "sources" is mandatory. Every number cites its feed, e.g. "finnhub:quote:NVDA", "sec-edgar:form4:...".
3. Orchestration:
   - Master classifies intent, selects agents, calls independent agents IN PARALLEL with per-agent timeouts (default 8s).
   - If an agent fails or times out, the master still answers with the rest and says which agent was unavailable. Never block the whole desk.
   - Stream partial results to the HUD as they arrive (signal log + node glow).
   - Spoken answer is short (under ~25 seconds); full detail goes to the HUD.
4. One gated money path: Proposal -> SENTINEL checks -> signed approval token -> PILOT. Analysis agents cannot execute. PILOT cannot self-authorize. Pilot rejects any order lacking a valid, unexpired, matching token. Unit-test this.
5. Secrets live in .env only (never hardcoded, never sent to the renderer).
6. Config in one file: models, voices, symbols/watchlist, timeouts, risk limits. No hardcoded model names.

---------------------------------------------------------------
## 3. PAPER TRADING (TRADINGVIEW + LOCAL LEDGER)
Goal: I can say "paper buy 50 NVDA" or "short TSLA with a stop" and the desk plans it, risk-checks it, "executes" it on paper, shows it on my TradingView chart, and journals it.

Step A – Capability check (do this in Phase 1 planning):
- Inspect the installed TradingView MCP server and list exactly which tools it exposes (symbol change, timeframe, drawing tools, screenshot, reading chart data, any trading-panel/paper-order support).
- Tell me plainly what it can and cannot do. Do NOT assume it can place orders. TradingView has no official order API.

Step B – Local Paper Engine (the source of truth, always on):
- Build a PAPER ENGINE in PILOT with SQLite: account (starting balance configurable, default 100,000 USD), positions, orders (market/limit/stop/stop-limit), fills, fees/slippage model (configurable, default small), realized and unrealized P&L, equity curve, daily P&L.
- Prices for fills come from the live feed (Finnhub quote). Orders only fill while the market is open (use the NYSE session clock) unless I enable extended hours. Show order status honestly (pending/filled/rejected/cancelled).
- Support: buy, sell, short, cover, bracket (entry + stop + target), cancel, flatten all.

Step C – TradingView mirroring (via MCP):
- After each paper fill, CHARTIST draws on my TradingView chart: entry line, stop line, target line, and a text label (e.g. "PAPER LONG 50 @ 142.30 | SL 139 | TP 150"). Update/remove lines when the trade changes or closes.
- If the MCP supports TradingView's built-in Paper Trading panel, offer an OPTIONAL mode "mirror into TradingView Paper Trading", OFF by default and requiring my explicit confirmation each session. If it does not support it, say so and rely on drawn levels plus the local engine. Never use fragile UI hacks without telling me first.

Step D – Safety:
- Config flag LIVE_TRADING=false. The app refuses to enable anything live; there is no live broker code in this project.
- SENTINEL rules (configurable): max risk per trade (default 1% of equity), max position size, max concentration per symbol/sector, max open positions, daily loss limit (halts new entries), required stop on every trade, minimum reward:risk (default 1.5), no trades when market is closed or data is stale or the symbol's quote is older than N seconds.
- Every proposal returns a clear verdict: APPROVE / MODIFY (with suggested size/stop) / VETO (with reason). Sentinel's favourite word is "no".
- LEDGER journals: thesis, inputs from agents, Sentinel verdict, fill, outcome, and a post-trade review ("what went right/wrong"). It computes win rate, average R, max drawdown. It highlights the desk's mistakes.

Example flow – "Should I buy 100 NVDA?":
ATHENA (structure/fundamentals) + ORACLE (probabilities) + NEWSROOM (latest headlines) + ATLAS (macro backdrop) -> master drafts a proposal -> SENTINEL sizes/vetoes -> if approved, PILOT fills on paper -> CHARTIST draws levels on TradingView -> LEDGER journals -> master speaks a short summary.

---------------------------------------------------------------
## 4. NEWSROOM (RECENT TRADING NEWS)
- Sources (free, with fallbacks): Finnhub market news and company news endpoints; SEC EDGAR filings feed (8-K etc.); Federal Reserve and other official press-release RSS feeds; economic calendar from a free source; optionally the open-source worldmonitor project for world/market events. Respect each source's terms and rate limits; cache and throttle.
- Capabilities:
  a) "What's the market news right now?" -> top market headlines, newest first.
  b) "News on NVDA" -> latest company headlines, filings, and analyst/insider events.
  c) "What's breaking?" -> items from the last 60 minutes, with a BREAKING badge.
  d) Pre-market / post-market digest on request.
- Each news item: headline, source, published time (show "x min ago" and absolute time in my timezone), link, related tickers, and a short neutral summary written in the desk's own words (do not copy article text; headlines + link + brief summary only).
- Deduplicate near-identical stories across sources; sort by recency, then relevance to my watchlist.
- Tagging: optional sentiment (bullish/bearish/neutral) must be clearly labelled "model-estimated" and never presented as fact.
- Always state "as of <time>" on any news answer. If all news feeds fail, say "News feed unavailable" instead of guessing.
- HUD: a News panel (scrolling, click to open link), and critical items (Fed, big movers on my watchlist, filings on positions I hold) push into the Signal Log with an alert sound option.
- Auto-refresh every 60-120 seconds within rate limits; stream breaking items immediately when detected.
- SENTINEL consumes news: it may veto or reduce size ahead of major scheduled events (FOMC, CPI, earnings of the symbol) and flags it.

---------------------------------------------------------------
## 5. TECH STACK (FREE WHERE POSSIBLE)
- Shell: Electron + React + Vite (or equivalent). contextIsolation ON, nodeIntegration OFF, preload bridge only, strict IPC, secrets only in the main process.
- Agents/backend: Node.js or Python services (your choice, justify in the plan). LLM calls use my API key from .env; model name is configurable. Use streaming.
- Speech-to-text: whisper.cpp (local). Push-to-talk and optional wake word.
- Text-to-speech: local Kokoro (via Voicebox or Kokoro-82M), one distinct voice per agent. Pluggable so ElevenLabs can be swapped in later. Pre-warm on start; speak sentence by sentence.
- Market data: Finnhub (quotes, movers, news) + yfinance (history). Refresh quotes about every 60s; cache; throttle for the free tier.
- Chart control: open-source TradingView MCP server. Fallback chart built in.
- Storage: SQLite (paper ledger, journal, news cache).
- Optional last: MediaPipe hand tracking to steer the orb.
- Ideas to borrow (read their docs, do not blindly copy): TauricResearch/TradingAgents (analyst team, bull vs bear debate, trader, risk verdict), koala73/worldmonitor (live news/world monitor for ATLAS/NEWSROOM), NousResearch/hermes-agent (orchestration and persistent memory).
- Include a bull-vs-bear "debate" mode: ATHENA argues both sides, ORACLE adds probabilities, SENTINEL gives the final verdict.

---------------------------------------------------------------
## 6. HUD DESIGN (MATCH THE SCREENSHOT)
- Dark cinematic sci-fi HUD, gold/amber glow.
- Center: large glowing orb with gold halo and states (idle, listening, thinking, speaking, focus). Nine agent nodes around it with name, role, status glow.
- Left column: Market Pulse (live quote rings, red when down), Task Queue, Signal Log (alerts from sub-agents: macro, recon, risk, news).
- Right column: Market Session (real NYSE phase + countdown from New York time), Calendar (FOMC, CPI, options expiry dots), Agent Load.
- Additional panels: News (section 4), Paper Portfolio (equity, positions, P&L, open orders), Journal (last trades).
- Bottom: command bar (typed), mic button, keyboard shortcut to talk, footer disclaimer.
- Smooth animations; responsive; never display placeholder numbers (use "—" if no data). Any mock data in early phases must be visibly labelled "MOCK".

---------------------------------------------------------------
## 7. PERFORMANCE TARGETS
- Command to first spoken word under ~3 seconds for simple queries.
- Parallel agent calls, streamed LLM output, sentence-level TTS, pre-warmed STT/TTS.
- HUD stays at 60fps; heavy work off the UI thread.

---------------------------------------------------------------
## 8. ENGINEERING QUALITY
- Folder structure: /app (Electron + UI), /agents (one folder per agent), /master, /shared (contract, config), /services (voice, data, news, chart, paper-engine), /tests, README.md, CHANGELOG.md, .env.example.
- Structured logging, a Health panel (keys present, whisper/Kokoro installed, TradingView MCP reachable, feeds alive), graceful startup checks with clear fixes.
- Tests: contract validation, router/intent classification, parallel orchestration with timeouts, Sentinel veto cases, Pilot rejection without token, paper-engine P&L math, order fill logic, news dedupe, data-fallback behaviour.
- When a tool is missing (whisper.cpp, Kokoro, TradingView MCP), give me exact install steps. Never fake it.

---------------------------------------------------------------
## 9. BUILD PHASES (STOP AFTER EACH; WAIT FOR "next")
Phase 1: Plan + capability check of the TradingView MCP + Electron app + static HUD matching the screenshot (orb states, nine seats, all panels, MOCK labels).
Phase 2: Shared contract + master + routing + two agents (ATLAS, CHARTIST) working on typed commands. Parallel calls and timeouts.
Phase 3: Voice: whisper.cpp input, Kokoro per-agent voices, orb reacts, sentence streaming.
Phase 4: Live data: Finnhub quotes in Market Pulse, real NYSE session clock, movers, economic calendar. "—" when down.
Phase 5: NEWSROOM: all news sources, dedupe, breaking detection, News panel, Signal Log alerts, "as of" timestamps.
Phase 6: Remaining agents one at a time: SCOUT, CAPITOL, ATHENA, ORACLE (each independent and tested).
Phase 7: Safety gate + paper trading: SENTINEL, PILOT paper engine (SQLite), LEDGER journal, Paper Portfolio panel, approval-token tests.
Phase 8: TradingView chart takeover and paper-trade mirroring (entry/stop/target lines, labels) via MCP, with fallback chart and the optional TradingView Paper Trading mirror mode if supported.
Phase 9: Bull-vs-bear debate mode, pre/post-market digest, performance tuning, polish.
Phase 10 (optional): MediaPipe hand tracking to steer the orb.

After each phase: run the app and tests, give me a pass/fail checklist and the exact commands to run it, update CHANGELOG.md and README.md, then wait for "next".

---------------------------------------------------------------
## 10. EXAMPLE COMMANDS IT MUST HANDLE
- "What's the market news right now?" / "What's breaking?" (Newsroom)
- "News on Nvidia." (Newsroom + Athena)
- "What's the macro picture today?" (Atlas)
- "What's going viral right now?" (Scout)
- "Pull up Nvidia and mark the levels." (Chartist, TradingView updates)
- "Give me the forecast for NVDA." (Oracle, probabilities only)
- "What is Congress or insiders buying?" (Capitol, data limited if needed)
- "Should I buy 100 shares of TSLA?" (Athena + Oracle + Newsroom + Atlas -> Sentinel -> Pilot paper trade if approved -> Chartist draws levels -> Ledger journals)
- "Paper buy 50 AAPL with a 2% stop." / "Flatten everything." / "Show my paper P&L." / "Why did you veto that?"
- "Give me the pre-market briefing."

---------------------------------------------------------------
## 11. WORKING STYLE
- Plan first, ask only when truly blocked, otherwise choose sensible defaults and tell me what you assumed.
- Keep answers and code honest: no fake data, no pretending a tool works when it doesn't.
- Keep the code modular and readable. Explain any trade-off in one or two lines.


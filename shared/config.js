// Shared configuration for F.R.I.D.A.Y. Desk and Specialists

export const DESK_CONFIG = {
  version: '1.0.0-phase1',
  name: 'F.R.I.D.A.Y. – The Trading Desk',
  tagline: 'MASTER · STRATEGY SYNTHESIS · RISK ROUTER',
  disclaimer: 'RESEARCH CO-PILOT. NOT FINANCIAL ADVICE. PAPER TRADING ONLY. DO YOUR OWN RESEARCH.',
  liveTrading: false, // Strictly enforced: no live broker connections
  defaultTimezone: 'Australia/Melbourne',
  nyseTimezone: 'America/New_York',
  
  // Starting Paper Portfolio
  initialEquity: 1604199,
  currency: 'USD',

  // Agent Specifications
  agents: [
    {
      id: 'friday',
      name: 'FRIDAY',
      role: 'Master Orchestrator',
      wing: 'Master',
      color: '#00f0ff',
      voice: 'en-GB-SoniaNeural',
      position: 'center',
      description: 'Central strategy synthesis, voice dispatch, and parallel task coordinator.'
    },
    {
      id: 'capitol',
      name: 'CAPITOL',
      role: 'SMART MONEY',
      wing: 'Intelligence',
      color: '#f59e0b', // Amber/orange
      voice: 'en-US-GuyNeural',
      orbitAngle: 270, // Top
      load: 37,
      status: 'idle',
      lastAction: 'STOCK Act filing parsed'
    },
    {
      id: 'scout',
      name: 'SCOUT',
      role: 'RECON',
      wing: 'Intelligence',
      color: '#eab308', // Yellow
      voice: 'en-US-EricNeural',
      orbitAngle: 325, // Top-Right
      load: 43,
      status: 'working',
      lastAction: 're-armed - next sweep 05:00'
    },
    {
      id: 'sentinel',
      name: 'SENTINEL',
      role: 'RISK OFFICER',
      wing: 'Execution',
      color: '#ef4444', // Red
      voice: 'en-US-DavisNeural',
      orbitAngle: 0, // Mid-Right
      load: 70,
      status: 'alert',
      lastAction: 'drawdown / exposure warnings'
    },
    {
      id: 'pilot',
      name: 'PILOT',
      role: 'EXECUTION',
      wing: 'Execution',
      color: '#ec4899', // Pink / Magenta
      voice: 'en-US-SteffanNeural',
      orbitAngle: 35, // Bottom-Right
      load: 12,
      status: 'idle',
      lastAction: 'idle - no open tickets'
    },
    {
      id: 'ledger',
      name: 'LEDGER',
      role: 'THE BOOK',
      wing: 'Execution',
      color: '#94a3b8', // Slate / Cyan-gray
      voice: 'en-US-RogerNeural',
      orbitAngle: 75, // Bottom-Right-Center
      load: 12,
      status: 'done',
      lastAction: 'book reconciled - 0 breaks'
    },
    {
      id: 'oracle',
      name: 'ORACLE',
      role: 'QUANT',
      wing: 'Analysis',
      color: '#a855f7', // Violet
      voice: 'en-US-AndrewNeural',
      orbitAngle: 105, // Bottom-Left-Center
      load: 38,
      status: 'done',
      lastAction: 'forecast run complete'
    },
    {
      id: 'chartist',
      name: 'CHARTIST',
      role: 'TECHNICIAN',
      wing: 'Analysis',
      color: '#06b6d4', // Cyan
      voice: 'en-US-BrianNeural',
      orbitAngle: 145, // Bottom-Left
      load: 64,
      status: 'working',
      lastAction: 'SPY yield 5.33% - near 200d MA'
    },
    {
      id: 'athena',
      name: 'ATHENA',
      role: 'ANALYST',
      wing: 'Analysis',
      color: '#10b981', // Emerald green
      voice: 'en-US-JennyNeural',
      orbitAngle: 180, // Mid-Left
      load: 4,
      status: 'idle',
      lastAction: 'thesis refresh queued - 5 names'
    },
    {
      id: 'atlas',
      name: 'ATLAS',
      role: 'MACRO',
      wing: 'Intelligence',
      color: '#38bdf8', // Sky Blue
      voice: 'en-US-ChristopherNeural',
      orbitAngle: 215, // Top-Left
      load: 38,
      status: 'working',
      lastAction: 'FOMC decision Wed - 2pm ET'
    }
  ],

  // Market Pulse Tickers (Mock baseline for Phase 1)
  marketPulse: [
    { symbol: 'SPY', name: 'S&P 500 ETF', changePct: -0.25, price: 562.40, isNegative: true },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF', changePct: -0.37, price: 479.15, isNegative: true },
    { symbol: 'NVDA', name: 'Nvidia Corp', changePct: -2.69, price: 118.80, isNegative: true },
    { symbol: 'BTC', name: 'Bitcoin / USD', changePct: +2.37, price: 63840.00, isNegative: false }
  ],

  // Desk Queue Tasks
  deskQueue: [
    { id: 1, title: 'Assemble desk ledger', done: true },
    { id: 2, title: 'Refresh pre-market snapshot', done: true },
    { id: 3, title: 'Re-sync PnL', done: true },
    { id: 4, title: 'Backtest queue', badge: '3 PENDING', done: false, highlight: true },
    { id: 5, title: 'Sync fundamentals DB', done: false },
    { id: 6, title: 'Roll watchlist alerts', done: false },
    { id: 7, title: 'Audit Sentinel limits', done: false },
    { id: 8, title: 'Archive session tape', done: false }
  ],

  // Initial Streaming Signals
  initialSignals: [
    { time: '04:37:02', agent: 'LEDGER', color: '#94a3b8', message: 'book reconciled - 0 breaks' },
    { time: '04:37:10', agent: 'CHARTIST', color: '#06b6d4', message: 'SPY yield 5.33% - near 200d MA' },
    { time: '04:37:18', agent: 'PILOT', color: '#ec4899', message: 'idle - no open tickets' },
    { time: '04:37:31', agent: 'ATHENA', color: '#10b981', message: 'thesis refresh queued - 5 names' },
    { time: '04:37:44', agent: 'CAPITOL', color: '#f59e0b', message: 'STOCK Act filing parsed' },
    { time: '04:37:52', agent: 'SENTINEL', color: '#ef4444', message: 'drawdown / exposure warnings' },
    { time: '04:38:03', agent: 'ATLAS', color: '#38bdf8', message: 'FOMC decision Wed - 2pm ET' },
    { time: '04:38:09', agent: 'SCOUT', color: '#eab308', message: 're-armed - next sweep 05:00' },
    { time: '04:38:14', agent: 'ORACLE', color: '#a855f7', message: 'forecast run complete' }
  ]
};

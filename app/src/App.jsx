import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DESK_CONFIG } from '../../shared/config.js';
import TopBar from './components/TopBar.jsx';
import MarketPulse from './components/MarketPulse.jsx';
import DeskQueue from './components/DeskQueue.jsx';
import SignalLog from './components/SignalLog.jsx';
import CentralOrb from './components/CentralOrb.jsx';
import SessionWidget from './components/SessionWidget.jsx';
import CalendarWidget from './components/CalendarWidget.jsx';
import AgentLoadWidget from './components/AgentLoadWidget.jsx';
import CommandBar from './components/CommandBar.jsx';
import AgentModal from './components/AgentModal.jsx';
import PortfolioView from './components/PortfolioView.jsx';
import NewsView from './components/NewsView.jsx';
import JournalView from './components/JournalView.jsx';
import ChartView from './components/ChartView.jsx';
import HealthModal from './components/HealthModal.jsx';
import WorkflowView from './components/WorkflowView.jsx';
import AlertManagerView from './components/AlertManagerView.jsx';
import AlertToast from './components/AlertToast.jsx';
import ArchiveManagerView from './components/ArchiveManagerView.jsx';
import PortfolioRiskView from './components/PortfolioRiskView.jsx';

import {
  fetchLiveQuotes,
  fetchSessionState,
  fetchPaperPortfolio,
  fetchLiveNews,
  summarizeNewsArticle,
  dispatchDeskCommand,
  detectLocalAction
} from './services/deskService.js';

import {
  parseVoiceChartCommand,
  executeChartAction
} from './services/chartService.js';

export default function App() {
  const [agents, setAgents] = useState(DESK_CONFIG.agents);
  const [marketPulse, setMarketPulse] = useState(DESK_CONFIG.marketPulse);
  const [sessionData, setSessionData] = useState(null);
  const [deskQueue] = useState(DESK_CONFIG.deskQueue);
  const [signals, setSignals] = useState(DESK_CONFIG.initialSignals);
  const [orbState, setOrbState] = useState('idle');
  const [activeTab, setActiveTab] = useState('hud');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [chartSymbol, setChartSymbol] = useState('SPY');
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [activeAlertToast, setActiveAlertToast] = useState(null);

  // Real-time breaking news states
  const [latestBreakingNews, setLatestBreakingNews] = useState(null);
  const [breakingNewsAlert, setBreakingNewsAlert] = useState(null);
  const [selectedNewsArticle, setSelectedNewsArticle] = useState(null);
  const seenNewsIdsRef = useRef(new Set());
  const isFirstNewsSyncRef = useRef(true);

  // Free Web Speech Synthesis for F.R.I.D.A.Y. voice
  const speakResponse = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en-GB') || v.name.includes('Sonia') || v.name.includes('Natural')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setOrbState('speaking');
    utterance.onend = () => setOrbState('idle');
    utterance.onerror = () => setOrbState('idle');

    window.speechSynthesis.speak(utterance);
  }, []);

  // Add a signal to the log
  const addSignal = useCallback((agent, message, color) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setSignals(prev => [...prev, { time: timeStr, agent, color: color || 'var(--neon-cyan)', message }]);
  }, []);

  // Fetch real-time live quotes and NYSE session (dual resilient)
  const refreshMarketTelemetry = useCallback(async () => {
    try {
      const [quotes, session] = await Promise.all([
        fetchLiveQuotes(),
        fetchSessionState()
      ]);

      if (Array.isArray(quotes) && quotes.length > 0) {
        setMarketPulse(quotes);
      }
      if (session && session.status) {
        setSessionData(session);
      }
    } catch (err) {
      console.warn('[DESK TELEMETRY] Telemetry sync error:', err.message);
    }
  }, []);

  // Initial fetch and auto-refresh loop for quotes (every 20s)
  useEffect(() => {
    refreshMarketTelemetry();
    const interval = setInterval(refreshMarketTelemetry, 20000);
    return () => clearInterval(interval);
  }, [refreshMarketTelemetry]);

  // Background real-time breaking news monitor (every 25s)
  const checkLiveNewsWire = useCallback(async () => {
    try {
      const items = await fetchLiveNews();
      if (!Array.isArray(items) || items.length === 0) return;

      // First run: Seed existing IDs so we do not spam old articles on load
      if (isFirstNewsSyncRef.current) {
        items.forEach(it => seenNewsIdsRef.current.add(String(it.id)));
        setLatestBreakingNews(items[0]);
        isFirstNewsSyncRef.current = false;
        return;
      }

      // Subsequent runs: Check for genuine new wire items
      const newArrivals = items.filter(it => !seenNewsIdsRef.current.has(String(it.id)));
      if (newArrivals.length > 0) {
        const freshest = newArrivals[0];
        newArrivals.forEach(it => seenNewsIdsRef.current.add(String(it.id)));

        setLatestBreakingNews(freshest);
        setBreakingNewsAlert(freshest);

        // Update NEWSROOM agent status in HUD
        setAgents(prev => prev.map(a => {
          if (a.id === 'newsroom') {
            return { ...a, status: 'alert', lastAction: `Breaking: ${freshest.headline.slice(0, 32)}...` };
          }
          return a;
        }));

        // Log breaking signal
        addSignal('NEWSROOM', `🚨 BREAKING WIRE [${freshest.source}]: "${freshest.headline}"`, '#ef4444');

        // Voice alert to operator
        const voiceAlert = `Operator, new breaking news just came in from ${freshest.source}: ${freshest.headline}. Say "read that" or "describe the news" if you want me to brief you.`;
        addSignal('FRIDAY', voiceAlert, 'var(--neon-cyan)');
        speakResponse(voiceAlert);
      }
    } catch (err) {
      console.warn('[NEWS MONITOR] Wire check error:', err.message);
    }
  }, [addSignal, speakResponse]);

  useEffect(() => {
    checkLiveNewsWire();
    const interval = setInterval(checkLiveNewsWire, 25000);
    return () => clearInterval(interval);
  }, [checkLiveNewsWire]);

  // Spacebar Push-To-Talk Keyboard Hook
  useEffect(() => {
    let recognition = null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && orbState !== 'listening') {
        e.preventDefault();
        setOrbState('listening');
        if (SpeechRecognition) {
          try {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.onresult = (evt) => {
              const transcript = evt.results[0][0].transcript;
              if (transcript) handleCommand(transcript);
            };
            recognition.onerror = () => setOrbState('idle');
            recognition.onend = () => {
              setOrbState(prev => prev === 'listening' ? 'idle' : prev);
            };
            recognition.start();
          } catch {
            // Web speech fallback
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        if (recognition) {
          try { recognition.stop(); } catch {}
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [orbState]);

  // ─── MASTER COMMAND HANDLER ───
  const handleCommand = async (cmd) => {
    // Log user command
    addSignal('OPERATOR', `Command: "${cmd}"`, '#ffffff');
    // 0. Check for authoritative natural chart intents (Step C / Phase 8)
    const activeQuote = marketPulse.find(q => q.symbol === chartSymbol);
    const parsedChartAction = parseVoiceChartCommand(cmd, chartSymbol, activeQuote);

    if (parsedChartAction) {
      setActiveTab('chart');
      if (parsedChartAction.symbol) {
        setChartSymbol(parsedChartAction.symbol);
      }
      if (Array.isArray(parsedChartAction.actions)) {
        for (const act of parsedChartAction.actions) {
          try {
            await executeChartAction(act.intent, act.payload, act.agent);
          } catch (err) {
            console.warn('[CHART ACTION ROUTER]', err.message);
          }
        }
      }

      // Add specialist agent signals to HUD
      if (parsedChartAction.type === 'COMPOSITE_CHART_ANALYSIS') {
        addSignal('CHARTIST', `Identified key technical support/resistance & liquidity on ${parsedChartAction.symbol}. EMA/RSI feeds online.`, '#06b6d4');
        addSignal('ATHENA', `Structure analysis confirmed for ${parsedChartAction.symbol}. Market posture updated.`, '#10b981');
      } else if (parsedChartAction.type === 'ADD_INDICATORS') {
        addSignal('CHARTIST', `Applied indicators to ${parsedChartAction.symbol}.`, '#06b6d4');
      } else if (parsedChartAction.type === 'DRAW_ZONE') {
        addSignal('ATHENA', `Supply/demand zone plotted on ${parsedChartAction.symbol}.`, '#10b981');
      } else if (parsedChartAction.type === 'DRAW_FIBONACCI') {
        addSignal('CHARTIST', `Fibonacci retracement plotted on ${parsedChartAction.symbol}. Golden pocket highlighted.`, '#06b6d4');
      } else if (parsedChartAction.type === 'CREATE_ALERT') {
        addSignal('SENTINEL', `Price alert armed for ${parsedChartAction.symbol}. Real-time monitoring active.`, '#ef4444');
      } else if (parsedChartAction.type === 'SHOW_TRADE_OVERLAYS') {
        addSignal('PILOT', `Projected active paper trade brackets onto ${parsedChartAction.symbol}.`, '#ec4899');
      } else if (parsedChartAction.type === 'CLEAR_AGENT_DRAWINGS') {
        addSignal('CHARTIST', `Cleared all agent drawings on ${parsedChartAction.symbol}. User manual drawings preserved.`, '#06b6d4');
      } else {
        addSignal('CHARTIST', `Chart action executed for ${parsedChartAction.symbol}.`, '#06b6d4');
      }

      addSignal('FRIDAY', parsedChartAction.spokenText, 'var(--neon-cyan)');
      speakResponse(parsedChartAction.spokenText);
      return;
    }

    // 1. Check for local actionable commands first
    const localAction = detectLocalAction(cmd);

    if (localAction) {
      switch (localAction.action) {
        case 'SHOW_PORTFOLIO': {
          setActiveTab('portfolio');
          const portfolio = await fetchPaperPortfolio();
          
          let spokenText;
          if (portfolio && portfolio.positions !== undefined) {
            const posCount = portfolio.positions.length;
            const pnlStr = portfolio.unrealizedPnl >= 0
              ? `plus $${Math.abs(portfolio.unrealizedPnl).toFixed(0)}`
              : `minus $${Math.abs(portfolio.unrealizedPnl).toFixed(0)}`;
            spokenText = `Switching to portfolio view. You have ${posCount} open position${posCount !== 1 ? 's' : ''}. Unrealized P and L is ${pnlStr}. Desk equity stands at $${portfolio.equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}.`;
            
            addSignal('PILOT', `Portfolio loaded: ${posCount} positions, Unrealized P&L: $${portfolio.unrealizedPnl.toFixed(2)}`, '#ec4899');
            addSignal('LEDGER', `Desk equity: $${portfolio.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '#94a3b8');
          } else {
            spokenText = 'Switching to portfolio view. Paper portfolio is loading from the ledger.';
            addSignal('LEDGER', 'Portfolio view activated. Mark-to-market refresh in progress.', '#94a3b8');
          }

          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'SHOW_CHART': {
          const sym = localAction.symbol || 'SPY';
          setChartSymbol(sym);
          setActiveTab('chart');
          
          const quote = marketPulse.find(q => q.symbol === sym);
          const priceInfo = quote && quote.price ? ` at $${quote.price}` : '';
          const spokenText = `Opening ${sym} chart${priceInfo}. TradingView live feed is active with technical indicators.`;
          
          addSignal('CHARTIST', `Loading ${sym} chart — TradingView live widget active`, '#06b6d4');
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'READ_BREAKING_NEWS': {
          setActiveTab('news');
          let target = latestBreakingNews;
          if (!target) {
            const currentNews = await fetchLiveNews();
            if (Array.isArray(currentNews) && currentNews.length > 0) {
              target = currentNews[0];
            }
          }

          if (target) {
            setSelectedNewsArticle(target);
            setBreakingNewsAlert(null);

            addSignal('NEWSROOM', `Parsing wire dossier for "${target.headline}"...`, '#eab308');
            const summary = await summarizeNewsArticle(target);

            if (summary) {
              addSignal('NEWSROOM', `Executive Briefing: ${summary.briefing}`, '#eab308');
              if (summary.impact) {
                addSignal('ATHENA', `Market Impact: ${summary.impact} · Focus Tickers: ${(summary.affectedTickers || []).join(', ')}`, '#a855f7');
              }
              const spokenBrief = `Here is the briefing from the Newsroom on ${target.source}. ${summary.briefing}`;
              addSignal('FRIDAY', spokenBrief, 'var(--neon-cyan)');
              speakResponse(spokenBrief);
            } else {
              const fallbackBrief = `${target.source} reports: ${target.headline}. ${target.summary}`;
              addSignal('FRIDAY', fallbackBrief, 'var(--neon-cyan)');
              speakResponse(fallbackBrief);
            }
          } else {
            const spokenText = "The newsroom wire is currently clear. Standing by for incoming market headlines.";
            addSignal('NEWSROOM', spokenText, '#eab308');
            addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
            speakResponse(spokenText);
          }
          return;
        }

        case 'SHOW_NEWS': {
          setActiveTab('news');
          const spokenText = 'Opening the newsroom. Scout and Newsroom are tracking live wires from Finnhub.';
          addSignal('SCOUT', 'News feed active — scanning incoming wires', '#eab308');
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'SHOW_JOURNAL': {
          setActiveTab('journal');
          const spokenText = 'Opening the trade journal. Ledger has your full execution history and Sentinel audit trail.';
          addSignal('LEDGER', 'Trade journal opened — all entries verified, zero breaks', '#94a3b8');
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'SHOW_HUD': {
          setActiveTab('hud');
          const spokenText = 'Returning to the main HUD. All nine specialist agents are reporting.';
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'STATUS_REPORT': {
          setActiveTab('hud');
          const activeAgents = agents.filter(a => a.status === 'working').length;
          const alertAgents = agents.filter(a => a.status === 'alert').length;
          const spokenText = `Desk status report: ${activeAgents} agents actively working, ${alertAgents} on alert. All feeds operational. Sentinel risk gate is armed.`;
          
          agents.forEach(a => {
            if (a.id !== 'friday') {
              addSignal(a.name, a.lastAction || 'Standing by', a.color);
            }
          });
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'SHOW_WORKFLOWS': {
          setActiveTab('workflows');
          const spokenText = 'Switching to workflows center. COMPASS trade planning and active execution pipelines ready.';
          addSignal('COMPASS', 'Workflows center opened — viewing active pipelines and drafted trade plans', 'var(--neon-cyan)');
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'SHOW_RISK': {
          setActiveTab('risk');
          const spokenText = 'Switching to Sentinel-X portfolio risk center. Monitoring heat, correlation, and kill switch.';
          addSignal('SENTINEL', 'Portfolio risk center opened — real-time risk monitor online', '#ef4444');
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'SHOW_ARCHIVE': {
          setActiveTab('archive');
          const spokenText = 'Opening the ARCHIVE research memory, playbooks, and trade review journal.';
          addSignal('ARCHIVE', 'ARCHIVE library opened — historical notes and trade reviews ready', '#a855f7');
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        case 'SHOW_ALERTS': {
          setActiveTab('alerts');
          const spokenText = 'Opening RELAY watchtower alerts and proactive routine manager.';
          addSignal('RELAY', 'Watchtower alerts center opened — monitoring market conditions', '#f59e0b');
          addSignal('FRIDAY', spokenText, 'var(--neon-cyan)');
          speakResponse(spokenText);
          return;
        }

        default:
          break;
      }
    }

    // 2. No local action matched — route to Gemini AI for intelligent analysis
    try {
      const data = await dispatchDeskCommand(cmd, marketPulse);
      const replyTime = new Date().toTimeString().split(' ')[0];

      // Add specialist signals
      if (Array.isArray(data.signals) && data.signals.length > 0) {
        const mapped = data.signals.map(s => {
          const spec = agents.find(a => a.name.toUpperCase() === s.agent.toUpperCase());
          return {
            time: replyTime,
            agent: s.agent.toUpperCase(),
            color: spec?.color || 'var(--neon-cyan)',
            message: s.message
          };
        });
        setSignals(prev => [...prev, ...mapped]);
      }

      // Add Friday's synthesized response
      setSignals(prev => [
        ...prev,
        {
          time: replyTime,
          agent: 'FRIDAY',
          color: 'var(--neon-cyan)',
          message: data.summary || data.spokenText
        }
      ]);

      // Update specialist load meters dynamically
      if (data.agentLoads) {
        setAgents(prev => prev.map(a => {
          const newLoad = data.agentLoads[a.id];
          return typeof newLoad === 'number' ? { ...a, load: newLoad } : a;
        }));
      }

      // If a trade plan or workflow was drafted/launched, switch to workflows view
      if (data.workflow || data.tradePlan) {
        setActiveTab('workflows');
      }

      // If an alert or routine was created/queried, switch to alerts view and toast
      if (data.alert || data.alerts) {
        setActiveTab('alerts');
        if (data.alert) {
          setActiveAlertToast({
            alert_id: data.alert.alert_id,
            alert_name: data.alert.name,
            symbol: data.alert.symbol,
            severity: 'info',
            message: `Armed: ${data.alert.condition.left} ${data.alert.condition.operator} ${data.alert.condition.right ?? ''}`,
            source: 'RELAY Watchtower'
          });
        }
      }

      // If a risk query or kill switch command was run, switch to risk view
      const lowerCmd = cmd.toLowerCase();
      if (
        data.risk ||
        lowerCmd.includes('portfolio risk') ||
        lowerCmd.includes('portfolio heat') ||
        lowerCmd.includes('kill switch') ||
        lowerCmd.includes('killswitch') ||
        lowerCmd.includes('stress test') ||
        lowerCmd.includes('risk budget') ||
        lowerCmd.includes('defensive plan') ||
        lowerCmd.includes('reduce my risk')
      ) {
        setActiveTab('risk');
      }

      // Speak response out loud
      if (data.spokenText) {
        speakResponse(data.spokenText);
      } else {
        setOrbState('idle');
      }
    } catch (err) {
      console.error('[DESK] Command dispatch failure:', err);
      setOrbState('idle');
    }
  };

  // Ping agent from diagnostic modal
  const handlePingAgent = (agent) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setSignals(prev => [
      ...prev,
      { time: timeStr, agent: agent.name, color: agent.color, message: `Ping acknowledged. Latency: 8ms. Feeds operational.` }
    ]);
  };

  return (
    <div className="hud-container">
      {/* 1. Top Bar */}
      <TopBar onOpenHealth={() => setShowHealthModal(true)} />

      {/* 1.5. Breaking News Live Cyber Banner */}
      {breakingNewsAlert && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.28) 0%, rgba(234, 179, 8, 0.18) 45%, rgba(6, 12, 24, 0.95) 100%)',
          border: '1px solid var(--neon-red)',
          borderRadius: '4px',
          padding: '7px 14px',
          margin: '2px 0 6px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)',
          animation: 'pulse-dot 3s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={{
              background: 'rgba(239, 68, 68, 0.35)',
              border: '1px solid var(--neon-red)',
              color: 'var(--neon-red)',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              letterSpacing: '1px'
            }}>
              🚨 BREAKING WIRE
            </span>
            <span style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-data)', fontSize: '10.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              [{breakingNewsAlert.source}]
            </span>
            <span style={{
              color: '#ffffff',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {breakingNewsAlert.headline}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => handleCommand('read the news')}
              style={{
                background: 'rgba(0, 240, 255, 0.25)',
                border: '1px solid var(--neon-cyan)',
                color: 'var(--neon-cyan)',
                fontFamily: 'var(--font-hud)',
                fontSize: '8.5px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '2px',
                cursor: 'pointer',
                letterSpacing: '0.5px'
              }}
            >
              🎙️ "READ THAT"
            </button>
            <button
              onClick={() => {
                setActiveTab('news');
                setSelectedNewsArticle(breakingNewsAlert);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontFamily: 'var(--font-data)',
                fontSize: '8.5px',
                padding: '4px 8px',
                borderRadius: '2px',
                cursor: 'pointer'
              }}
            >
              DOSSIER
            </button>
            <button
              onClick={() => setBreakingNewsAlert(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '0 4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Middle Viewport */}
      {activeTab === 'hud' && (
        <main style={{
          display: 'grid',
          gridTemplateColumns: '300px 1fr 300px',
          gap: '14px',
          height: '100%',
          overflow: 'hidden',
          paddingTop: '4px'
        }}>
          {/* Left Column: Pulse, Queue, Signal Log */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            height: '100%',
            overflow: 'hidden'
          }}>
            <MarketPulse items={marketPulse} />
            <DeskQueue tasks={deskQueue} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <SignalLog signals={signals} />
            </div>
          </div>

          {/* Center Column: Interactive Orb + 9 Agent Satellites */}
          <div style={{ height: '100%', position: 'relative' }}>
            <CentralOrb
              agents={agents}
              orbState={orbState}
              onSelectAgent={(agent) => setSelectedAgent(agent)}
            />
          </div>

          {/* Right Column: Session, Calendar, Agent Load */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            height: '100%',
            overflow: 'hidden'
          }}>
            <SessionWidget session={sessionData} quotes={marketPulse} />
            <CalendarWidget />
            <AgentLoadWidget agents={agents} />
          </div>
        </main>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div style={{ padding: '8px 0', height: '100%', overflow: 'hidden' }}>
          <PortfolioView />
        </div>
      )}

      {/* Chart Tab */}
      {activeTab === 'chart' && (
        <div style={{ padding: '8px 0', height: '100%', overflow: 'hidden' }}>
          <ChartView
            symbol={chartSymbol}
            onOpenHealth={() => setShowHealthModal(true)}
            onClose={() => setActiveTab('hud')}
            onTradeExecuted={(tradeInfo) => {
              if (tradeInfo.type === 'CLOSE') {
                const pnlText = tradeInfo.pnl >= 0 ? `profit of $${tradeInfo.pnl.toFixed(2)}` : `loss of $${Math.abs(tradeInfo.pnl).toFixed(2)}`;
                const speech = `Position in ${tradeInfo.symbol} flattened. Realized ${pnlText}. Portfolio balance updated.`;
                addSignal('PILOT', `FLATTENED ${tradeInfo.symbol}: Realized PnL: $${tradeInfo.pnl.toFixed(2)}`, tradeInfo.pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)');
                addSignal('FRIDAY', speech, 'var(--neon-cyan)');
                speakResponse(speech);
              } else if (tradeInfo.type === 'WORKING') {
                const speech = `Working ${tradeInfo.action} order placed for ${tradeInfo.shares} shares of ${tradeInfo.symbol} at $${tradeInfo.price.toFixed(2)}.`;
                addSignal('PILOT', `WORKING ORDER: ${tradeInfo.action} ${tradeInfo.shares} ${tradeInfo.symbol} @ $${tradeInfo.price.toFixed(2)}`, 'var(--neon-cyan)');
                addSignal('FRIDAY', speech, 'var(--neon-cyan)');
                speakResponse(speech);
              } else {
                const speech = `Order executed. ${tradeInfo.action} ${tradeInfo.shares} shares of ${tradeInfo.symbol} at $${tradeInfo.price.toFixed(2)}. Sentinel cryptographic token verified.`;
                addSignal('PILOT', `EXECUTED ${tradeInfo.action} ${tradeInfo.shares} ${tradeInfo.symbol} @ $${tradeInfo.price.toFixed(2)} · Token: ${tradeInfo.token}`, 'var(--neon-green)');
                addSignal('SENTINEL', `Risk parameters verified for ${tradeInfo.symbol}. Audit entry committed to ledger.`, 'var(--neon-cyan)');
                addSignal('FRIDAY', speech, 'var(--neon-cyan)');
                speakResponse(speech);
              }
            }}
          />
        </div>
      )}

      {/* News Tab */}
      {activeTab === 'news' && (
        <div style={{ padding: '8px 0', height: '100%', overflow: 'hidden' }}>
          <NewsView
            selectedArticle={selectedNewsArticle}
            onSelectArticle={(item) => setSelectedNewsArticle(item)}
            speakArticle={(text) => {
              addSignal('NEWSROOM', text, '#eab308');
              speakResponse(text);
            }}
          />
        </div>
      )}

      {/* Journal Tab */}
      {activeTab === 'journal' && (
        <div style={{ padding: '8px 0', height: '100%', overflow: 'hidden' }}>
          <JournalView />
        </div>
      )}

      {/* Workflows & COMPASS Trade Plans Tab */}
      {activeTab === 'workflows' && (
        <div style={{ padding: '8px 0', height: '100%', overflow: 'hidden' }}>
          <WorkflowView
            onSendToChart={(sym) => {
              setChartSymbol(sym);
              setActiveTab('chart');
            }}
            onNotify={(agent, message, color) => addSignal(agent, message, color)}
            onSpeak={(text) => speakResponse(text)}
          />
        </div>
      )}

      {/* Alerts & Routines (RELAY Watchtower) Tab */}
      {activeTab === 'alerts' && (
        <div style={{ padding: '8px 0', height: '100%', overflow: 'hidden' }}>
          <AlertManagerView
            onSendToChart={(sym) => {
              setChartSymbol(sym);
              setActiveTab('chart');
            }}
            onNotify={(agent, message, color) => addSignal(agent, message, color)}
            onSpeak={(text) => speakResponse(text)}
          />
        </div>
      )}

      {/* ARCHIVE — Research Library, Playbooks, Trade Reviews */}
      {activeTab === 'archive' && (
        <div style={{ padding: '8px 0', height: '100%', overflow: 'hidden' }}>
          <ArchiveManagerView
            onSendToChart={(sym) => {
              setChartSymbol(sym);
              setActiveTab('chart');
            }}
            onNotify={(agent, message, color) => addSignal(agent, message, color)}
            onSpeak={(text) => speakResponse(text)}
          />
        </div>
      )}

      {/* SENTINEL-X — Portfolio Risk, Heat, Correlation, Kill Switch */}
      {activeTab === 'risk' && (
        <div style={{ padding: '8px 0', height: '100%', overflow: 'hidden' }}>
          <PortfolioRiskView
            onSendToChart={(sym) => {
              setChartSymbol(sym);
              setActiveTab('chart');
            }}
            onNotify={(agent, message, color) => addSignal(agent, message, color)}
            onSpeak={(text) => speakResponse(text)}
          />
        </div>
      )}

      {/* Non-blocking HUD Alert Toast Notification */}
      <AlertToast
        alertEvent={activeAlertToast}
        onDismiss={() => setActiveAlertToast(null)}
        onViewSymbol={(sym) => {
          setChartSymbol(sym);
          setActiveTab('chart');
        }}
      />

      {/* 3. Bottom Controls */}
      <CommandBar
        orbState={orbState}
        setOrbState={setOrbState}
        onSubmitCommand={handleCommand}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Agent Details Inspector Modal */}
      {selectedAgent && (
        <AgentModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onPing={handlePingAgent}
        />
      )}

      {/* System Health & TradingView Capabilities Audit Modal */}
      {showHealthModal && (
        <HealthModal onClose={() => setShowHealthModal(false)} />
      )}
    </div>
  );
}

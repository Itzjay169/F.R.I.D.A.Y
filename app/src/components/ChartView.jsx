import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  fetchSymbolQuote,
  fetchPaperPortfolio,
  evaluatePaperOrder,
  placePaperOrder,
  closePaperPosition,
  cancelPaperOrder
} from '../services/deskService.js';
import {
  syncPaperTradeToOverlay,
  syncTradeCloseToOverlay,
  getSymbolTradeOverlays,
  getSymbolStructureDrawings,
  clearAgentDrawingsForSymbol
} from '../services/chartService.js';

const TIMEFRAMES = [
  { label: '1m', interval: '1' },
  { label: '5m', interval: '5' },
  { label: '15m', interval: '15' },
  { label: '30m', interval: '30' },
  { label: '1H', interval: '60' },
  { label: '4H', interval: '240' },
  { label: '1D', interval: 'D' },
  { label: '1W', interval: 'W' },
];

const CHART_STYLES = [
  { id: '1', label: '🕯️ Candles' },
  { id: '8', label: '🎌 Heikin Ashi' },
  { id: '0', label: '📊 Bars' },
  { id: '2', label: '📈 Line' },
  { id: '3', label: '📉 Area' },
  { id: '9', label: '🕯️ Hollow' }
];

const INDICATOR_PRESETS = [
  {
    id: 'standard',
    label: 'MA + RSI + MACD',
    studies: ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies', 'MACD@tv-basicstudies']
  },
  {
    id: 'momentum',
    label: 'RSI + MACD + Stoch',
    studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies', 'StochasticRSI@tv-basicstudies']
  },
  {
    id: 'trend',
    label: 'EMA + Bollinger Bands',
    studies: ['MAExp@tv-basicstudies', 'BB@tv-basicstudies']
  },
  {
    id: 'clean',
    label: 'Clean (TradingView Tools)',
    studies: []
  }
];

const QUICK_SYMBOLS = [
  { label: 'SPY', symbol: 'SPY', type: 'ETF' },
  { label: 'QQQ', symbol: 'QQQ', type: 'ETF' },
  { label: 'NVDA', symbol: 'NVDA', type: 'TECH' },
  { label: 'TSLA', symbol: 'TSLA', type: 'TECH' },
  { label: 'AAPL', symbol: 'AAPL', type: 'TECH' },
  { label: 'BA', symbol: 'BA', type: 'NYSE' },
  { label: 'DIS', symbol: 'DIS', type: 'NYSE' },
  { label: 'JPM', symbol: 'JPM', type: 'NYSE' },
  { label: 'BTC', symbol: 'BTC', type: 'CRYPTO' },
  { label: 'ETH', symbol: 'ETH', type: 'CRYPTO' },
  { label: 'GOLD', symbol: 'GOLD', type: 'COMMODITY' }
];

const CRYPTO_LIST = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'NEAR',
  'SUI', 'BNB', 'SHIB', 'PEPE', 'MATIC', 'POL', 'LTC', 'BCH', 'UNI', 'ATOM',
  'ICP', 'FIL', 'APT', 'RENDER', 'FET', 'INJ', 'TIA', 'KAS', 'STX', 'ARB',
  'OP', 'XLM', 'HBAR', 'VET', 'TRX', 'TON'
]);

const FOREX_LIST = new Set([
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY'
]);

const AMEX_ETFS = new Set([
  'SPY', 'DIA', 'IWM', 'VOO', 'VTI', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI',
  'XLP', 'XLU', 'XLY', 'XLB', 'XLRE', 'XLC', 'VNQ', 'GLD', 'SLV', 'TLT',
  'HYG', 'LQD', 'EEM', 'EFA', 'FXI', 'GDX', 'GDXJ', 'BITO', 'ARKK', 'SOXL', 'SOXS'
]);

const NYSE_STOCKS = new Set([
  'BA', 'DIS', 'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BLK', 'SCHW', 'V', 'MA',
  'AXP', 'KO', 'WMT', 'TGT', 'HD', 'LOW', 'MCD', 'NKE', 'XOM', 'CVX', 'COP',
  'SLB', 'EOG', 'OXY', 'MPC', 'PSX', 'VLO', 'CAT', 'DE', 'GE', 'HON', 'UNP',
  'UPS', 'FDX', 'RTX', 'LMT', 'GD', 'NOC', 'PFE', 'MRK', 'ABBV', 'LLY', 'BMY',
  'JNJ', 'UNH', 'CVS', 'CI', 'ELV', 'HUM', 'PG', 'CL', 'KMB', 'GIS', 'SYY',
  'T', 'VZ', 'IBM', 'ORCL', 'CRM', 'NOW', 'SNOW', 'UBER', 'SHOP', 'SPOT',
  'DELL', 'HPQ', 'F', 'GM', 'STLA', 'BABA', 'NIO', 'TSM', 'RIO', 'BHP',
  'VALE', 'PBR', 'BP', 'SHEL', 'TTE', 'NEE', 'DUK', 'SO', 'D', 'AEP', 'ED',
  'PLD', 'AMT', 'CCI', 'SPG', 'O', 'PSA', 'WM', 'RSG', 'ECL', 'APD', 'SHW',
  'LIN', 'FCX', 'NEM', 'NUE', 'STLD', 'CLF', 'AA', 'SQ', 'NET', 'KEY', 'USB',
  'PNC', 'TFC', 'MTB', 'PRU', 'MET', 'ALL', 'TRV', 'PGR', 'CB', 'AIG', 'MMC'
]);

const INDEX_COMMODITY_MAP = {
  'SPX': 'SP:SPX',
  'NDX': 'NASDAQ:NDX',
  'DJI': 'DJ:DJI',
  'VIX': 'CBOE:VIX',
  'DXY': 'CAPITALCOM:DXY',
  'GOLD': 'TVC:GOLD',
  'SILVER': 'TVC:SILVER',
  'OIL': 'TVC:USOIL',
  'USOIL': 'TVC:USOIL',
  'BRENT': 'TVC:UKOIL',
  'US10Y': 'TVC:US10Y',
  'US02Y': 'TVC:US02Y'
};

function resolveTradingViewSymbol(raw) {
  if (!raw) return 'AMEX:SPY';
  const clean = raw.trim().toUpperCase();

  if (clean.includes(':')) return clean;
  if (INDEX_COMMODITY_MAP[clean]) return INDEX_COMMODITY_MAP[clean];
  if (CRYPTO_LIST.has(clean)) return `BINANCE:${clean}USDT`;
  if (clean.endsWith('USDT') || clean.endsWith('USD')) return `BINANCE:${clean}`;
  if (FOREX_LIST.has(clean)) return `FX:${clean}`;
  if (AMEX_ETFS.has(clean)) return `AMEX:${clean}`;
  if (NYSE_STOCKS.has(clean)) return `NYSE:${clean}`;

  return `NASDAQ:${clean}`;
}

export default function ChartView({ symbol = 'SPY', onClose, onTradeExecuted, onOpenHealth }) {
  const containerRef = useRef(null);
  const chartRootRef = useRef(null);

  // Chart configuration states
  const [activeInterval, setActiveInterval] = useState('D');
  const [chartStyle, setChartStyle] = useState('1'); // 1 = Candles
  const [activeIndicatorPreset, setActiveIndicatorPreset] = useState('standard');
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [inputSymbol, setInputSymbol] = useState(symbol);
  const [resolvedTvSymbol, setResolvedTvSymbol] = useState(() => resolveTradingViewSymbol(symbol));

  // Full Chart mode state
  const [isFullChart, setIsFullChart] = useState(false);

  // Live Quote & Bid/Ask State
  const [symbolQuote, setSymbolQuote] = useState(null);

  // Trade Overlays & Agent Structure Drawings States
  const [activeOverlays, setActiveOverlays] = useState([]);
  const [structureDrawings, setStructureDrawings] = useState([]);
  const [showTradeBrackets, setShowTradeBrackets] = useState(true);
  const [showAgentDrawings, setShowAgentDrawings] = useState(true);

  // Refresh Overlays & Agent Structure Drawings
  const refreshOverlaysAndDrawings = useCallback(() => {
    try {
      setActiveOverlays(getSymbolTradeOverlays(currentSymbol));
      setStructureDrawings(getSymbolStructureDrawings(currentSymbol));
    } catch {}
  }, [currentSymbol]);

  useEffect(() => {
    refreshOverlaysAndDrawings();
    const interval = setInterval(refreshOverlaysAndDrawings, 2500);
    return () => clearInterval(interval);
  }, [refreshOverlaysAndDrawings]);

  // Panels layout state
  const [showTradePanel, setShowTradePanel] = useState(false); // Collapsible Order Ticket Drawer
  const [showBottomTables, setShowBottomTables] = useState(false); // Collapsible Positions/Orders Dock
  const [bottomTab, setBottomTab] = useState('positions'); // positions | orders | account | journal

  // On-Chart Floating Quick Trader state
  const [showQuickTrader, setShowQuickTrader] = useState(true);

  // On-Chart Buy/Sell Range Planner (Risk/Reward Graph Overlay)
  const [showRangeVisualizer, setShowRangeVisualizer] = useState(true);
  const [rangeSide, setRangeSide] = useState('BUY'); // 'BUY' | 'SELL'
  const [rangeLockLive, setRangeLockLive] = useState(true);
  const [customRangeEntry, setCustomRangeEntry] = useState('');
  const [rangeStopPct, setRangeStopPct] = useState(2.0); // 2.0% stop loss
  const [rangeTargetPct, setRangeTargetPct] = useState(4.0); // 4.0% take profit

  // Paper Portfolio State
  const [portfolio, setPortfolio] = useState({
    equity: 1604199.00,
    cash: 1420500.00,
    unrealizedPnl: 0,
    realizedPnl: 0,
    positions: [],
    orders: [],
    journal: []
  });

  // Order Ticket State
  const [orderSide, setOrderSide] = useState('BUY'); // BUY | SELL
  const [orderType, setOrderType] = useState('MARKET'); // MARKET | LIMIT | STOP
  const [sharesInput, setSharesInput] = useState('50');
  const [priceInput, setPriceInput] = useState('');
  const [useStopLoss, setUseStopLoss] = useState(true);
  const [stopLossInput, setStopLossInput] = useState('');
  const [useTakeProfit, setUseTakeProfit] = useState(true);
  const [takeProfitInput, setTakeProfitInput] = useState('');
  const [executingOrder, setExecutingOrder] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState(null);

  // Synchronize on symbol prop change
  useEffect(() => {
    setCurrentSymbol(symbol);
    setInputSymbol(symbol);
  }, [symbol]);

  // Symbol resolution
  useEffect(() => {
    let active = true;
    async function determineSymbol() {
      const clean = currentSymbol.trim().toUpperCase();
      const initial = resolveTradingViewSymbol(clean);

      if (
        clean.includes(':') ||
        INDEX_COMMODITY_MAP[clean] ||
        CRYPTO_LIST.has(clean) ||
        FOREX_LIST.has(clean) ||
        AMEX_ETFS.has(clean) ||
        NYSE_STOCKS.has(clean)
      ) {
        if (active) setResolvedTvSymbol(initial);
        return;
      }

      try {
        const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${clean}&token=dbg5ou1r01qidncmd640dbg5ou1r01qidncmd64g`, {
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const profile = await res.json();
          if (profile && profile.exchange && active) {
            const ex = profile.exchange.toUpperCase();
            if (ex.includes('NEW YORK')) {
              setResolvedTvSymbol(`NYSE:${clean}`);
              return;
            } else if (ex.includes('AMEX') || ex.includes('ARCA')) {
              setResolvedTvSymbol(`AMEX:${clean}`);
              return;
            } else if (ex.includes('NASDAQ')) {
              setResolvedTvSymbol(`NASDAQ:${clean}`);
              return;
            }
          }
        }
      } catch {}

      if (active) setResolvedTvSymbol(initial);
    }

    determineSymbol();
    return () => { active = false; };
  }, [currentSymbol]);

  // Refresh live quote for active symbol
  const refreshQuote = useCallback(async () => {
    try {
      const q = await fetchSymbolQuote(currentSymbol);
      if (q && q.price) {
        setSymbolQuote(q);
        // Default price input if empty
        setPriceInput(prev => (prev === '' || orderType === 'MARKET') ? q.price.toFixed(2) : prev);
        
        // Auto default SL (2.5%) and TP (5%) if not filled
        if (!stopLossInput || orderType === 'MARKET') {
          const sl = orderSide === 'BUY' ? q.price * 0.975 : q.price * 1.025;
          setStopLossInput(sl.toFixed(2));
        }
        if (!takeProfitInput || orderType === 'MARKET') {
          const tp = orderSide === 'BUY' ? q.price * 1.05 : q.price * 0.95;
          setTakeProfitInput(tp.toFixed(2));
        }
      }
    } catch {}
  }, [currentSymbol, orderSide, orderType, stopLossInput, takeProfitInput]);

  useEffect(() => {
    refreshQuote();
    const interval = setInterval(refreshQuote, 8000);
    return () => clearInterval(interval);
  }, [refreshQuote]);

  // Refresh Paper Portfolio
  const refreshPortfolio = useCallback(async () => {
    try {
      const liveMap = {};
      if (symbolQuote && symbolQuote.price) {
        liveMap[currentSymbol.toUpperCase()] = symbolQuote.price;
      }
      const data = await fetchPaperPortfolio(liveMap);
      if (data && data.positions !== undefined) {
        setPortfolio(data);
      }
    } catch {}
  }, [currentSymbol, symbolQuote]);

  useEffect(() => {
    refreshPortfolio();
    const interval = setInterval(refreshPortfolio, 10000);
    return () => clearInterval(interval);
  }, [refreshPortfolio]);

  // Handle Full Chart Escape and F-key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullChart) {
        setIsFullChart(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullChart]);

  // Sync with browser native fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullChart) {
        setIsFullChart(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullChart]);

  const toggleFullChart = () => {
    setIsFullChart(prev => {
      const next = !prev;
      if (next) {
        try {
          if (chartRootRef.current?.requestFullscreen) {
            chartRootRef.current.requestFullscreen().catch(() => {});
          }
        } catch {}
      } else {
        try {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
        } catch {}
      }
      return next;
    });
  };

  // Render TradingView Advanced Chart Widget with ALL Drawing Tools & Indicators
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    const currentPreset = INDICATOR_PRESETS.find(p => p.id === activeIndicatorPreset) || INDICATOR_PRESETS[0];

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: resolvedTvSymbol,
      interval: activeInterval,
      timezone: 'America/New_York',
      theme: 'dark',
      style: chartStyle,
      locale: 'en',
      backgroundColor: 'rgba(6, 10, 20, 1)',
      gridColor: 'rgba(0, 240, 255, 0.04)',
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false, // FULL TRADING VIEW DRAWING TOOLBAR ENABLED!
      allow_symbol_change: true,
      save_image: true,
      calendar: true,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      withdateranges: true,
      details: false,
      hotlist: false,
      show_popup_button: true,
      popup_width: '1000',
      popup_height: '650',
      studies: currentPreset.studies,
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': '#00f0ff',
        'mainSeriesProperties.candleStyle.downColor': '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#00f0ff',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#00f0ff',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444'
      }
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container__widget';
    wrapper.style.height = '100%';
    wrapper.style.width = '100%';

    containerRef.current.appendChild(wrapper);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [resolvedTvSymbol, activeInterval, chartStyle, activeIndicatorPreset]);

  const handleSymbolSubmit = (e) => {
    e.preventDefault();
    if (inputSymbol.trim()) {
      const sym = inputSymbol.trim().toUpperCase();
      setCurrentSymbol(sym);
      setPriceInput('');
      setStopLossInput('');
      setTakeProfitInput('');
      setCustomRangeEntry('');
    }
  };

  const handleQuickSelect = (sym) => {
    setCurrentSymbol(sym);
    setInputSymbol(sym);
    setPriceInput('');
    setStopLossInput('');
    setTakeProfitInput('');
    setCustomRangeEntry('');
  };

  // Calculations for order ticket & live quote
  const currentPrice = symbolQuote?.price || (priceInput ? parseFloat(priceInput) : 100);
  const entryPrice = orderType === 'MARKET' ? currentPrice : (parseFloat(priceInput) || currentPrice);
  const sharesCount = Math.max(1, parseInt(sharesInput) || 1);
  const totalOrderValue = entryPrice * sharesCount;
  const slPrice = useStopLoss && stopLossInput ? parseFloat(stopLossInput) : null;
  const tpPrice = useTakeProfit && takeProfitInput ? parseFloat(takeProfitInput) : null;
  
  const riskPerShare = slPrice ? Math.abs(entryPrice - slPrice) : entryPrice * 0.025;
  const totalRiskDollars = riskPerShare * sharesCount;
  const riskEquityPct = portfolio.equity > 0 ? ((totalRiskDollars / portfolio.equity) * 100).toFixed(2) : '0.10';

  let rrRatioText = '—';
  if (slPrice && tpPrice) {
    const rewardPerShare = Math.abs(tpPrice - entryPrice);
    if (riskPerShare > 0) {
      const ratio = (rewardPerShare / riskPerShare).toFixed(2);
      rrRatioText = `${ratio}:1`;
    }
  }

  // Active Position for the currently viewed symbol
  const activePosition = useMemo(() => {
    return (portfolio.positions || []).find(p => p.symbol.toUpperCase() === currentSymbol.toUpperCase());
  }, [portfolio.positions, currentSymbol]);

  // Visual Buy/Sell Range Computations
  const rangeEntryNum = rangeLockLive || !customRangeEntry ? currentPrice : (parseFloat(customRangeEntry) || currentPrice);
  const isRangeBuy = rangeSide === 'BUY';
  const rangeTargetPrice = isRangeBuy
    ? rangeEntryNum * (1 + rangeTargetPct / 100)
    : rangeEntryNum * (1 - rangeTargetPct / 100);
  const rangeStopPrice = isRangeBuy
    ? rangeEntryNum * (1 - rangeStopPct / 100)
    : rangeEntryNum * (1 + rangeStopPct / 100);

  const rangeRewardPerShare = Math.abs(rangeTargetPrice - rangeEntryNum);
  const rangeRiskPerShare = Math.abs(rangeEntryNum - rangeStopPrice);
  const rangeTotalGain = rangeRewardPerShare * sharesCount;
  const rangeTotalRisk = rangeRiskPerShare * sharesCount;
  const rangeRRRatio = rangeRiskPerShare > 0 ? (rangeRewardPerShare / rangeRiskPerShare) : 1;
  const rangeBreakevenWinRate = rangeRRRatio > 0 ? ((1 / (1 + rangeRRRatio)) * 100).toFixed(1) : '50.0';

  // Quick 1-Click Buy / Sell execution
  const handleQuickExecution = async (side) => {
    setOrderSide(side);
    const execPrice = side === 'BUY' ? (symbolQuote?.ask || currentPrice) : (symbolQuote?.bid || currentPrice);
    const sl = side === 'BUY' ? execPrice * 0.975 : execPrice * 1.025;
    const tp = side === 'BUY' ? execPrice * 1.05 : execPrice * 0.95;

    await executeTradeInternal({
      side,
      type: 'MARKET',
      price: execPrice,
      shares: sharesCount,
      stopLoss: sl,
      takeProfit: tp
    });
  };

  // Submit full order ticket
  const handleOrderSubmit = async (e) => {
    if (e) e.preventDefault();
    await executeTradeInternal({
      side: orderSide,
      type: orderType,
      price: entryPrice,
      shares: sharesCount,
      stopLoss: slPrice,
      takeProfit: tpPrice
    });
  };

  // Submit trade from Visual Buy/Sell Range
  const handleExecuteRangeTrade = async () => {
    await executeTradeInternal({
      side: rangeSide,
      type: rangeLockLive ? 'MARKET' : 'LIMIT',
      price: rangeEntryNum,
      shares: sharesCount,
      stopLoss: parseFloat(rangeStopPrice.toFixed(2)),
      takeProfit: parseFloat(rangeTargetPrice.toFixed(2))
    });
  };

  const executeTradeInternal = async ({ side, type, price, shares, stopLoss, takeProfit }) => {
    setExecutingOrder(true);
    setOrderFeedback(null);

    try {
      // 1. Sentinel Risk Evaluation
      const ticket = {
        symbol: currentSymbol,
        action: side,
        shares,
        price,
        orderType: type,
        stopLoss,
        takeProfit
      };

      const evalRes = await evaluatePaperOrder(ticket);
      if (evalRes && evalRes.verdict === 'VETO') {
        setOrderFeedback({
          type: 'error',
          text: `SENTINEL VETO: ${evalRes.reason || 'Risk threshold exceeded.'}`
        });
        setExecutingOrder(false);
        return;
      }

      // 2. Pilot Execution
      const fillRes = await placePaperOrder({
        ...ticket,
        token: evalRes?.token,
        stopLoss: evalRes?.effectiveStopLoss || stopLoss
      });

      if (fillRes) {
        setOrderFeedback({
          type: 'success',
          text: fillRes.orderType === 'LIMIT' || fillRes.orderType === 'STOP'
            ? `ORDER PLACED: ${type} ${side} ${shares} @ $${price.toFixed(2)} [Token ${fillRes.token || 'SIG_OK'}]`
            : `FILLED: ${side} ${shares} ${currentSymbol} @ $${price.toFixed(2)} [${fillRes.token}]`
        });

        // Mirror trade bracket to ChartTradeOverlay store
        try {
          syncPaperTradeToOverlay({
            tradeId: fillRes.order?.id || `TRD-${currentSymbol}-${Date.now()}`,
            symbol: currentSymbol,
            side,
            shares,
            price,
            stopLoss,
            takeProfit,
            token: fillRes.token
          });
          refreshOverlaysAndDrawings();
        } catch {}

        // Trigger voice & signal callback to App
        if (onTradeExecuted) {
          onTradeExecuted({
            type: fillRes.orderType === 'LIMIT' || fillRes.orderType === 'STOP' ? 'WORKING' : 'FILL',
            action: side,
            symbol: currentSymbol,
            shares,
            price,
            token: fillRes.token
          });
        }

        // Refresh book
        await refreshPortfolio();
      }
    } catch (err) {
      setOrderFeedback({ type: 'error', text: `EXECUTION ERROR: ${err.message}` });
    } finally {
      setExecutingOrder(false);
    }
  };

  // Instant Flatten / Close Position
  const handleClosePosition = async (pos) => {
    const mark = pos.curPrice || symbolQuote?.price || pos.avgPrice;
    try {
      const res = await closePaperPosition(pos.symbol, mark);
      if (res && res.success) {
        // Purge trade overlay to guarantee zero orphaned drawings!
        try {
          syncTradeCloseToOverlay(pos.symbol, 'CLOSED');
          refreshOverlaysAndDrawings();
        } catch {}

        setOrderFeedback({
          type: 'success',
          text: `CLOSED ${pos.symbol}: Realized ${res.pnl >= 0 ? '+' : ''}$${res.pnl.toFixed(2)}`
        });

        if (onTradeExecuted) {
          onTradeExecuted({
            type: 'CLOSE',
            symbol: pos.symbol,
            shares: Math.abs(pos.qty),
            pnl: res.pnl,
            closePrice: mark
          });
        }
        await refreshPortfolio();
      }
    } catch (err) {
      setOrderFeedback({ type: 'error', text: `Close failed: ${err.message}` });
    }
  };

  // Cancel Working Order
  const handleCancelOrder = async (orderId) => {
    try {
      await cancelPaperOrder(orderId);
      await refreshPortfolio();
    } catch {}
  };

  return (
    <div
      ref={chartRootRef}
      className="hud-panel"
      style={{
        position: isFullChart ? 'fixed' : 'relative',
        top: isFullChart ? 0 : 'auto',
        left: isFullChart ? 0 : 'auto',
        right: isFullChart ? 0 : 'auto',
        bottom: isFullChart ? 0 : 'auto',
        width: isFullChart ? '100vw' : '100%',
        height: isFullChart ? '100vh' : '100%',
        zIndex: isFullChart ? 99999 : 1,
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#020612',
        border: isFullChart ? 'none' : '1px solid var(--border-cyan)',
        borderRadius: isFullChart ? 0 : '4px',
        boxShadow: isFullChart ? '0 0 50px rgba(0, 240, 255, 0.2)' : 'none'
      }}
    >
      {/* ─── 1. TOP HEADER & PRO COMMAND TOOLBAR ─── */}
      <div className="panel-header" style={{
        margin: '0',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        borderBottom: '1px solid var(--border-cyan)',
        background: isFullChart ? 'rgba(4, 8, 18, 0.98)' : 'rgba(6, 12, 24, 0.95)',
        zIndex: 20
      }}>
        {/* Left: Ticker & Search & Full Chart Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="panel-title" style={{ margin: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>CHARTIST // <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{resolvedTvSymbol}</span></span>
            {isFullChart && (
              <span className="badge badge-live" style={{ fontSize: '8px', padding: '1px 5px' }}>
                ⛶ FULL CHART ACTIVE
              </span>
            )}
          </div>

          <form onSubmit={handleSymbolSubmit} style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            <input
              type="text"
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value)}
              placeholder="e.g. NVDA, BA"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid var(--border-cyan)',
                color: '#ffffff',
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '2px',
                width: '80px',
                outline: 'none',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            />
            <button type="submit" style={{
              background: 'rgba(0, 240, 255, 0.15)',
              border: '1px solid var(--neon-cyan)',
              color: 'var(--neon-cyan)',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              padding: '4px 7px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}>
              LOAD
            </button>
          </form>

          {/* Timeframes */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.interval}
                onClick={() => setActiveInterval(tf.interval)}
                style={{
                  background: activeInterval === tf.interval ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: activeInterval === tf.interval ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: activeInterval === tf.interval ? 'var(--neon-cyan)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-data)',
                  fontSize: '8.5px',
                  padding: '2px 5px',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart Style Switcher (TradingView style) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '2px' }}>
            <select
              value={chartStyle}
              onChange={(e) => setChartStyle(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                color: 'var(--neon-cyan)',
                fontFamily: 'var(--font-data)',
                fontSize: '8.5px',
                padding: '2px 4px',
                borderRadius: '2px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {CHART_STYLES.map(cs => (
                <option key={cs.id} value={cs.id} style={{ background: '#0a1020', color: '#fff' }}>
                  {cs.label}
                </option>
              ))}
            </select>
          </div>

          {/* Indicator Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <select
              value={activeIndicatorPreset}
              onChange={(e) => setActiveIndicatorPreset(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                color: '#ffffff',
                fontFamily: 'var(--font-data)',
                fontSize: '8.5px',
                padding: '2px 4px',
                borderRadius: '2px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {INDICATOR_PRESETS.map(ip => (
                <option key={ip.id} value={ip.id} style={{ background: '#0a1020', color: '#fff' }}>
                  ⚡ {ip.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Symbols */}
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            {QUICK_SYMBOLS.slice(0, 6).map(qs => (
              <button
                key={qs.symbol}
                onClick={() => handleQuickSelect(qs.symbol)}
                style={{
                  background: currentSymbol.toUpperCase() === qs.symbol ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: currentSymbol.toUpperCase() === qs.symbol ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: currentSymbol.toUpperCase() === qs.symbol ? 'var(--neon-cyan)' : '#94a3b8',
                  fontFamily: 'var(--font-data)',
                  fontSize: '8px',
                  padding: '2px 4px',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                {qs.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: TradingView Pro Instant Bid/Ask Execution Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '2px 8px',
          borderRadius: '3px',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
        }}>
          {/* Quick Sell Button */}
          <button
            onClick={() => handleQuickExecution('SELL')}
            disabled={executingOrder}
            style={{
              background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.35) 0%, rgba(239, 68, 68, 0.15) 100%)',
              border: '1px solid var(--neon-red)',
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: '2px',
              cursor: executingOrder ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.1,
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.25)'
            }}
          >
            <span style={{ fontFamily: 'var(--font-hud)', fontSize: '9px', fontWeight: 700, color: 'var(--neon-red)' }}>SELL</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '10.5px', fontWeight: 600 }}>
              ${symbolQuote?.bid ? symbolQuote.bid.toFixed(2) : (currentPrice * 0.9998).toFixed(2)}
            </span>
          </button>

          {/* Quick Quantity Counter */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <button
                onClick={() => setSharesInput(prev => String(Math.max(1, (parseInt(prev) || 10) - 10)))}
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', fontSize: '9px', padding: '1px 5px', cursor: 'pointer', borderRadius: '1px' }}
              >-</button>
              <input
                type="text"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '38px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--neon-cyan)',
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => setSharesInput(prev => String((parseInt(prev) || 0) + 10))}
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', fontSize: '9px', padding: '1px 5px', cursor: 'pointer', borderRadius: '1px' }}
              >+</button>
            </div>
            <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
              SPREAD ${symbolQuote?.spread ? symbolQuote.spread.toFixed(2) : '0.04'}
            </span>
          </div>

          {/* Quick Buy Button */}
          <button
            onClick={() => handleQuickExecution('BUY')}
            disabled={executingOrder}
            style={{
              background: 'linear-gradient(180deg, rgba(0, 240, 255, 0.35) 0%, rgba(0, 240, 255, 0.15) 100%)',
              border: '1px solid var(--neon-cyan)',
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: '2px',
              cursor: executingOrder ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.1,
              boxShadow: '0 0 8px rgba(0, 240, 255, 0.25)'
            }}
          >
            <span style={{ fontFamily: 'var(--font-hud)', fontSize: '9px', fontWeight: 700, color: 'var(--neon-cyan)' }}>BUY</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '10.5px', fontWeight: 600 }}>
              ${symbolQuote?.ask ? symbolQuote.ask.toFixed(2) : (currentPrice * 1.0002).toFixed(2)}
            </span>
          </button>
        </div>

        {/* Right: Pro Controls & Full Chart Toggle */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {symbolQuote && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>
                ${symbolQuote.price.toFixed(2)}
              </span>
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: '9.5px',
                fontWeight: 600,
                color: symbolQuote.changePct >= 0 ? 'var(--neon-green)' : 'var(--neon-red)'
              }}>
                {symbolQuote.changePct >= 0 ? '+' : ''}{symbolQuote.changePct.toFixed(2)}%
              </span>
            </div>
          )}

          {/* 🎯 Toggle Buy/Sell Range Planner Tool */}
          <button
            onClick={() => setShowRangeVisualizer(!showRangeVisualizer)}
            title="Toggle Buy/Sell Graph Range & Risk/Reward Overlay"
            style={{
              background: showRangeVisualizer ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.1) 100%)' : 'rgba(255, 255, 255, 0.05)',
              border: showRangeVisualizer ? '1px solid var(--neon-green)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: showRangeVisualizer ? 'var(--neon-green)' : '#94a3b8',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              padding: '4px 8px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              boxShadow: showRangeVisualizer ? '0 0 8px rgba(16, 185, 129, 0.3)' : 'none'
            }}
          >
            🎯 RANGE TOOL
          </button>

          {/* ⚡ Toggle On-Chart Quick Trader HUD */}
          <button
            onClick={() => setShowQuickTrader(!showQuickTrader)}
            title="Toggle Floating Chart Trader"
            style={{
              background: showQuickTrader ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: showQuickTrader ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: showQuickTrader ? 'var(--neon-cyan)' : '#94a3b8',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              padding: '4px 8px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            ⚡ QUICK TRADER
          </button>

          {/* 📝 Toggle Side Order Ticket Drawer */}
          <button
            onClick={() => setShowTradePanel(!showTradePanel)}
            style={{
              background: showTradePanel ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: showTradePanel ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: showTradePanel ? 'var(--neon-cyan)' : '#94a3b8',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              padding: '4px 8px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '0.5px'
            }}
          >
            📝 TICKET
          </button>

          {/* 📐 Toggle Agent Structure Levels */}
          <button
            onClick={() => setShowAgentDrawings(!showAgentDrawings)}
            title="Toggle Agent Structure Drawings (Support, Resistance, Zones, Fibonacci)"
            style={{
              background: showAgentDrawings ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              border: showAgentDrawings ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: showAgentDrawings ? 'var(--neon-cyan)' : '#94a3b8',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              padding: '4px 8px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '0.5px'
            }}
          >
            📐 LEVELS ({structureDrawings.length})
          </button>

          {/* 📊 Toggle Paper Trade Brackets */}
          <button
            onClick={() => setShowTradeBrackets(!showTradeBrackets)}
            title="Toggle Active Paper Trade Overlays (Entry, Stop Loss, Take Profit)"
            style={{
              background: showTradeBrackets ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              border: showTradeBrackets ? '1px solid var(--neon-green)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: showTradeBrackets ? 'var(--neon-green)' : '#94a3b8',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              padding: '4px 8px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '0.5px'
            }}
          >
            📊 BRACKETS ({activeOverlays.length})
          </button>

          {/* ✕ Clear Agent Drawings (Preserving User Manual Drawings) */}
          {structureDrawings.length > 0 && (
            <button
              onClick={() => {
                clearAgentDrawingsForSymbol(currentSymbol);
                refreshOverlaysAndDrawings();
              }}
              title="Clear all F.R.I.D.A.Y. agent drawings while strictly preserving manual drawings"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: 'var(--neon-red)',
                fontFamily: 'var(--font-hud)',
                fontSize: '8px',
                padding: '4px 6px',
                borderRadius: '2px',
                cursor: 'pointer'
              }}
            >
              ✕ CLEAR AGENT DRAWINGS
            </button>
          )}

          {/* 🛡️ System Health & TradingView MCP Capabilities Audit */}
          {onOpenHealth && (
            <button
              onClick={onOpenHealth}
              title="Open System Health Panel & TradingView Capabilities Audit"
              style={{
                background: 'rgba(0, 240, 255, 0.15)',
                border: '1px solid var(--neon-cyan)',
                color: 'var(--neon-cyan)',
                fontFamily: 'var(--font-hud)',
                fontSize: '8.5px',
                padding: '4px 8px',
                borderRadius: '2px',
                cursor: 'pointer',
                letterSpacing: '0.5px'
              }}
            >
              🛡️ HEALTH AUDIT
            </button>
          )}

          {/* 📋 Toggle Bottom Positions Dock */}
          <button
            onClick={() => setShowBottomTables(!showBottomTables)}
            style={{
              background: showBottomTables ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: showBottomTables ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: showBottomTables ? 'var(--neon-cyan)' : '#94a3b8',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              padding: '4px 8px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '0.5px'
            }}
          >
            📋 POSITIONS ({portfolio.positions.length})
          </button>

          {/* ⛶ FULL CHART MODE BUTTON */}
          <button
            onClick={toggleFullChart}
            title={isFullChart ? "Exit Full Chart Mode (Esc)" : "Expand to Full Chart Mode"}
            style={{
              background: isFullChart ? 'linear-gradient(180deg, rgba(0, 240, 255, 0.4) 0%, rgba(0, 240, 255, 0.2) 100%)' : 'rgba(0, 240, 255, 0.15)',
              border: '1px solid var(--neon-cyan)',
              color: '#ffffff',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              fontWeight: 700,
              padding: '4px 9px',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              boxShadow: isFullChart ? '0 0 12px rgba(0, 240, 255, 0.5)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{isFullChart ? '🗗 EXIT FULL' : '⛶ FULL CHART'}</span>
          </button>

          {onClose && (
            <button onClick={onClose} style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--neon-red)',
              color: 'var(--neon-red)',
              fontFamily: 'var(--font-hud)',
              fontSize: '8.5px',
              padding: '4px 8px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. MIDDLE AREA: CHART + DRAWING TOOLS + ON-CHART TRADING SUITE ─── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* TradingView Advanced Chart Widget Container with Full Left Drawing Toolbar */}
        <div
          ref={containerRef}
          className="tradingview-widget-container"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflow: 'hidden',
            background: 'rgba(6, 10, 20, 1)',
            position: 'relative'
          }}
        />

        {/* ─── OVERLAY 1: ACTIVE POSITION LIVE STATUS BANNER ─── */}
        {activePosition && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '60px',
            zIndex: 15,
            background: 'rgba(6, 12, 26, 0.92)',
            border: `1px solid ${activePosition.qty > 0 ? 'var(--neon-green)' : 'var(--neon-red)'}`,
            borderRadius: '4px',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '9px',
                fontWeight: 700,
                color: activePosition.qty > 0 ? 'var(--neon-green)' : 'var(--neon-red)'
              }}>
                {activePosition.qty > 0 ? '▲ LONG' : '▼ SHORT'} {Math.abs(activePosition.qty)} {activePosition.symbol}
              </span>
              <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'var(--font-data)' }}>
                @ ${activePosition.avgPrice?.toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'var(--font-data)' }}>PNL:</span>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-data)',
                fontWeight: 700,
                color: (activePosition.pnl || 0) >= 0 ? 'var(--neon-green)' : 'var(--neon-red)'
              }}>
                {(activePosition.pnl || 0) >= 0 ? '+' : ''}${(activePosition.pnl || 0).toFixed(2)} ({(activePosition.pnlPct || 0).toFixed(2)}%)
              </span>
            </div>

            {activePosition.stopLoss && (
              <span style={{ fontSize: '8.5px', color: 'var(--neon-red)', fontFamily: 'var(--font-data)' }}>
                SL: ${activePosition.stopLoss.toFixed(2)}
              </span>
            )}
            {activePosition.takeProfit && (
              <span style={{ fontSize: '8.5px', color: 'var(--neon-green)', fontFamily: 'var(--font-data)' }}>
                TP: ${activePosition.takeProfit.toFixed(2)}
              </span>
            )}

            <button
              onClick={() => handleClosePosition(activePosition)}
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid var(--neon-red)',
                color: 'var(--neon-red)',
                fontFamily: 'var(--font-hud)',
                fontSize: '8px',
                padding: '2px 6px',
                borderRadius: '2px',
                cursor: 'pointer'
              }}
            >
              ✕ FLATTEN
            </button>
          </div>
        )}

        {/* ─── OVERLAY 2: FLOATING CHART TRADER (1-CLICK BUY / SELL TILE) ─── */}
        {showQuickTrader && (
          <div style={{
            position: 'absolute',
            top: activePosition ? '46px' : '10px',
            left: '60px',
            zIndex: 14,
            background: 'linear-gradient(180deg, rgba(8, 14, 28, 0.94) 0%, rgba(4, 8, 16, 0.96) 100%)',
            border: '1px solid var(--border-cyan)',
            borderRadius: '4px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            width: '210px'
          }}>
            {/* Header / Collapse */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-hud)', fontSize: '8.5px', color: 'var(--neon-cyan)', letterSpacing: '0.5px' }}>
                ⚡ CHART TRADER // {currentSymbol}
              </span>
              <button
                onClick={() => setShowQuickTrader(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '9px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Live Buy / Sell Dual Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <button
                onClick={() => handleQuickExecution('SELL')}
                disabled={executingOrder}
                style={{
                  background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.2) 100%)',
                  border: '1px solid var(--neon-red)',
                  color: '#ffffff',
                  padding: '5px 4px',
                  borderRadius: '3px',
                  cursor: executingOrder ? 'not-allowed' : 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontFamily: 'var(--font-hud)', fontSize: '8.5px', color: 'var(--neon-red)', fontWeight: 700 }}>SELL / BID</div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700 }}>
                  ${symbolQuote?.bid ? symbolQuote.bid.toFixed(2) : (currentPrice * 0.9998).toFixed(2)}
                </div>
              </button>

              <button
                onClick={() => handleQuickExecution('BUY')}
                disabled={executingOrder}
                style={{
                  background: 'linear-gradient(180deg, rgba(0, 240, 255, 0.4) 0%, rgba(0, 240, 255, 0.2) 100%)',
                  border: '1px solid var(--neon-cyan)',
                  color: '#ffffff',
                  padding: '5px 4px',
                  borderRadius: '3px',
                  cursor: executingOrder ? 'not-allowed' : 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontFamily: 'var(--font-hud)', fontSize: '8.5px', color: 'var(--neon-cyan)', fontWeight: 700 }}>BUY / ASK</div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700 }}>
                  ${symbolQuote?.ask ? symbolQuote.ask.toFixed(2) : (currentPrice * 1.0002).toFixed(2)}
                </div>
              </button>
            </div>

            {/* Quick Quantity Counter & Pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>QTY:</span>
                <input
                  type="text"
                  value={sharesInput}
                  onChange={(e) => setSharesInput(e.target.value.replace(/\D/g, ''))}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.6)',
                    border: '1px solid var(--border-cyan)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-data)',
                    fontSize: '11px',
                    fontWeight: 700,
                    textAlign: 'center',
                    padding: '2px',
                    borderRadius: '2px',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '8px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-data)' }}>
                  ${(currentPrice * sharesCount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '2px' }}>
                {[10, 50, 100, 250].map(cnt => (
                  <button
                    key={cnt}
                    onClick={() => setSharesInput(String(cnt))}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-data)',
                      fontSize: '7.5px',
                      padding: '1px 0',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── OVERLAY 3: BUY / SELL GRAPH RANGE PLANNER & RISK-REWARD OVERLAY ─── */}
        {showRangeVisualizer && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: showTradePanel ? '325px' : '10px',
            zIndex: 14,
            background: 'linear-gradient(180deg, rgba(8, 16, 32, 0.95) 0%, rgba(4, 10, 22, 0.98) 100%)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            borderRadius: '4px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.85), inset 0 0 15px rgba(0, 240, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            width: '290px'
          }}>
            {/* Header: Title & Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px' }}>🎯</span>
                <span style={{ fontFamily: 'var(--font-hud)', fontSize: '9px', color: 'var(--neon-green)', fontWeight: 700, letterSpacing: '0.5px' }}>
                  BUY / SELL GRAPH RANGE
                </span>
              </div>
              <button
                onClick={() => setShowRangeVisualizer(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '9px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Long (Buy) vs Short (Sell) Direction Toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setRangeSide('BUY')}
                style={{
                  background: rangeSide === 'BUY'
                    ? 'linear-gradient(180deg, rgba(0, 240, 255, 0.3) 0%, rgba(0, 240, 255, 0.15) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: rangeSide === 'BUY' ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: rangeSide === 'BUY' ? 'var(--neon-cyan)' : '#94a3b8',
                  fontFamily: 'var(--font-hud)',
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '4px',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                ▲ LONG (BUY)
              </button>
              <button
                type="button"
                onClick={() => setRangeSide('SELL')}
                style={{
                  background: rangeSide === 'SELL'
                    ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.15) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: rangeSide === 'SELL' ? '1px solid var(--neon-red)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: rangeSide === 'SELL' ? 'var(--neon-red)' : '#94a3b8',
                  fontFamily: 'var(--font-hud)',
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '4px',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                ▼ SHORT (SELL)
              </button>
            </div>

            {/* Entry Price Control */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>ENTRY PRICE</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '7.5px', color: 'var(--neon-cyan)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rangeLockLive}
                    onChange={(e) => {
                      setRangeLockLive(e.target.checked);
                      if (e.target.checked) setCustomRangeEntry('');
                    }}
                    style={{ accentColor: 'var(--neon-cyan)' }}
                  />
                  SYNC LIVE (${currentPrice.toFixed(2)})
                </label>
              </div>
              {!rangeLockLive && (
                <input
                  type="number"
                  step="0.01"
                  value={customRangeEntry}
                  onChange={(e) => setCustomRangeEntry(e.target.value)}
                  placeholder={currentPrice.toFixed(2)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.6)',
                    border: '1px solid var(--border-cyan)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-data)',
                    fontSize: '11px',
                    padding: '3px 6px',
                    borderRadius: '2px',
                    outline: 'none'
                  }}
                />
              )}
            </div>

            {/* ─── TAKE PROFIT TARGET ZONE (GREEN) ─── */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '3px',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '8.5px', color: 'var(--neon-green)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
                  🎯 TAKE PROFIT RANGE (+{rangeTargetPct.toFixed(1)}%)
                </span>
                <span style={{ fontSize: '9px', color: 'var(--neon-green)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                  +${rangeTotalGain.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-data)' }}>TARGET PRICE:</span>
                <span style={{ fontSize: '11px', color: '#ffffff', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                  ${rangeTargetPrice.toFixed(2)}
                </span>
              </div>
              {/* Target Quick Range Pills */}
              <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                {[1, 2, 3, 5, 8, 10].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setRangeTargetPct(pct)}
                    style={{
                      flex: 1,
                      background: rangeTargetPct === pct ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                      border: rangeTargetPct === pct ? '1px solid var(--neon-green)' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: rangeTargetPct === pct ? 'var(--neon-green)' : '#94a3b8',
                      fontFamily: 'var(--font-data)',
                      fontSize: '7.5px',
                      padding: '2px 0',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* ─── STOP LOSS RISK ZONE (RED) ─── */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '3px',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '8.5px', color: 'var(--neon-red)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
                  🛡️ STOP LOSS RANGE (-{rangeStopPct.toFixed(1)}%)
                </span>
                <span style={{ fontSize: '9px', color: 'var(--neon-red)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                  -${rangeTotalRisk.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-data)' }}>STOP PRICE:</span>
                <span style={{ fontSize: '11px', color: '#ffffff', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                  ${rangeStopPrice.toFixed(2)}
                </span>
              </div>
              {/* Stop Quick Range Pills */}
              <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                {[0.5, 1, 1.5, 2, 3, 5].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setRangeStopPct(pct)}
                    style={{
                      flex: 1,
                      background: rangeStopPct === pct ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                      border: rangeStopPct === pct ? '1px solid var(--neon-red)' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: rangeStopPct === pct ? 'var(--neon-red)' : '#94a3b8',
                      fontFamily: 'var(--font-data)',
                      fontSize: '7.5px',
                      padding: '2px 0',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    -{pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* ─── RISK : REWARD GRAPH METRICS & QUICK RATIOS ─── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '6px',
              borderRadius: '3px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div>
                <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)', display: 'block' }}>
                  REWARD : RISK
                </span>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 700,
                  color: rangeRRRatio >= 2 ? 'var(--neon-green)' : (rangeRRRatio >= 1.5 ? 'var(--neon-cyan)' : 'var(--neon-amber)')
                }}>
                  {rangeRRRatio.toFixed(2)} : 1
                </span>
              </div>
              <div>
                <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)', display: 'block' }}>
                  BREAKEVEN WIN RATE
                </span>
                <span style={{ fontSize: '11px', color: '#ffffff', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                  {rangeBreakevenWinRate}%
                </span>
              </div>
            </div>

            {/* Quick R:R Ratios Auto-Setter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>R:R PRESET:</span>
              {[
                { label: '1:1', ratio: 1 },
                { label: '1:1.5', ratio: 1.5 },
                { label: '1:2', ratio: 2 },
                { label: '1:3', ratio: 3 },
                { label: '1:5', ratio: 5 }
              ].map(r => (
                <button
                  key={r.label}
                  onClick={() => setRangeTargetPct(rangeStopPct * r.ratio)}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--neon-cyan)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '7.5px',
                    padding: '2px 0',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Visual Graphical Gauge: Stop -> Entry -> Target */}
            <div style={{
              height: '8px',
              borderRadius: '2px',
              overflow: 'hidden',
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{
                flex: rangeStopPct,
                background: 'linear-gradient(90deg, #ef4444 0%, rgba(239, 68, 68, 0.5) 100%)'
              }} title={`Stop Loss Range: -${rangeStopPct}%`} />
              <div style={{ width: '3px', background: '#ffffff', boxShadow: '0 0 6px #fff' }} title="Entry" />
              <div style={{
                flex: rangeTargetPct,
                background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.5) 0%, #10b981 100%)'
              }} title={`Take Profit Range: +${rangeTargetPct}%`} />
            </div>

            {/* Execute This Range Button */}
            <button
              onClick={handleExecuteRangeTrade}
              disabled={executingOrder}
              style={{
                background: isRangeBuy
                  ? 'linear-gradient(180deg, rgba(0, 240, 255, 0.4) 0%, rgba(0, 240, 255, 0.2) 100%)'
                  : 'linear-gradient(180deg, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.2) 100%)',
                border: isRangeBuy ? '1px solid var(--neon-cyan)' : '1px solid var(--neon-red)',
                color: '#ffffff',
                fontFamily: 'var(--font-hud)',
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '7px',
                borderRadius: '3px',
                cursor: executingOrder ? 'not-allowed' : 'pointer',
                letterSpacing: '0.5px',
                textAlign: 'center',
                boxShadow: isRangeBuy ? '0 0 12px rgba(0, 240, 255, 0.3)' : '0 0 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              {executingOrder ? 'EXECUTING RANGE...' : `EXECUTE ${rangeSide} RANGE (${sharesCount} shs)`}
            </button>
          </div>
        )}

        {/* ─── OVERLAY 4: ACTIVE PAPER TRADE OVERLAYS (BRACKETS) ─── */}
        {showTradeBrackets && activeOverlays.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '12px',
            right: showTradePanel ? '325px' : '10px',
            zIndex: 14,
            background: 'linear-gradient(180deg, rgba(8, 16, 32, 0.95) 0%, rgba(4, 10, 22, 0.98) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '4px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            maxWidth: '340px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-hud)', fontSize: '9px', color: 'var(--neon-green)', fontWeight: 700, letterSpacing: '0.5px' }}>
                📊 ACTIVE TRADE BRACKETS ({activeOverlays.length})
              </span>
              <button
                onClick={() => setShowTradeBrackets(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '9px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
              {activeOverlays.map(o => (
                <div key={o.trade_id} style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '3px',
                  padding: '5px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-hud)',
                      fontSize: '8.5px',
                      fontWeight: 700,
                      color: o.side === 'BUY' ? 'var(--neon-green)' : 'var(--neon-red)'
                    }}>
                      {o.side} {o.quantity} {o.symbol} @ ${o.entry.toFixed(2)}
                    </span>
                    <span className="badge badge-live" style={{ fontSize: '7px' }}>
                      {o.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontFamily: 'var(--font-data)' }}>
                    <span style={{ color: 'var(--neon-red)' }}>SL: ${o.stop ? o.stop.toFixed(2) : 'NONE'}</span>
                    <span style={{ color: 'var(--neon-green)' }}>TP: ${o.target ? o.target.toFixed(2) : 'NONE'}</span>
                    <span style={{ color: '#64748b' }}>{o.token}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── OVERLAY 5: AGENT STRUCTURE DRAWINGS (ATHENA / CHARTIST / SENTINEL) ─── */}
        {showAgentDrawings && structureDrawings.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '60px',
            zIndex: 14,
            background: 'linear-gradient(180deg, rgba(8, 16, 32, 0.95) 0%, rgba(4, 10, 22, 0.98) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: '4px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            maxWidth: '360px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-hud)', fontSize: '9px', color: 'var(--neon-cyan)', fontWeight: 700, letterSpacing: '0.5px' }}>
                📐 AGENT STRUCTURE DRAWINGS ({structureDrawings.length})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => {
                    clearAgentDrawingsForSymbol(currentSymbol);
                    refreshOverlaysAndDrawings();
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--neon-red)',
                    fontSize: '7px',
                    padding: '1px 4px',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                >
                  CLEAR
                </button>
                <button
                  onClick={() => setShowAgentDrawings(false)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '9px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
              {structureDrawings.map(d => {
                const agentColor = d.agent === 'ATHENA' ? 'var(--neon-green)' : (d.agent === 'SENTINEL' ? 'var(--neon-red)' : (d.agent === 'ORACLE' ? 'var(--neon-purple)' : 'var(--neon-cyan)'));
                return (
                  <div key={d.id} style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderLeft: `2px solid ${agentColor}`,
                    padding: '4px 6px',
                    borderRadius: '2px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-hud)', fontSize: '8px', color: agentColor, fontWeight: 700 }}>
                        {d.agent} // {d.type.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '7px', color: '#64748b', fontFamily: 'var(--font-data)' }}>
                        {new Date(d.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-data)', fontSize: '8.5px', color: '#ffffff' }}>
                      {d.label}
                    </div>
                    {d.type === 'fibonacci' && d.data?.levels && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                        {d.data.levels.map(lvl => (
                          <span key={lvl.ratio} style={{
                            fontSize: '7.5px',
                            fontFamily: 'var(--font-data)',
                            color: lvl.ratio === '0.618' ? 'var(--neon-amber)' : 'var(--neon-cyan)',
                            background: lvl.ratio === '0.618' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 240, 255, 0.08)',
                            padding: '1px 3px',
                            borderRadius: '1px'
                          }}>
                            {lvl.ratio}: ${lvl.price}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── RIGHT DOCKED ORDER TICKET DRAWER ─── */}
        {showTradePanel && (
          <div style={{
            width: '315px',
            borderLeft: '1px solid var(--border-cyan)',
            background: 'linear-gradient(180deg, rgba(8, 14, 28, 0.98) 0%, rgba(4, 8, 16, 0.99) 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '12px',
            gap: '10px',
            boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.6)',
            zIndex: 16
          }}>
            {/* Panel Title & Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-hud)', fontSize: '10px', color: 'var(--neon-cyan)', letterSpacing: '1px', fontWeight: 700 }}>
                ORDER ENTRY // PILOT DESK
              </span>
              <button
                onClick={() => setShowTradePanel(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Buy / Sell Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setOrderSide('BUY')}
                style={{
                  background: orderSide === 'BUY'
                    ? 'linear-gradient(180deg, rgba(0, 240, 255, 0.3) 0%, rgba(0, 240, 255, 0.15) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: orderSide === 'BUY' ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: orderSide === 'BUY' ? 'var(--neon-cyan)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-hud)',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '7px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                  boxShadow: orderSide === 'BUY' ? '0 0 10px rgba(0, 240, 255, 0.2)' : 'none'
                }}
              >
                BUY / LONG
              </button>
              <button
                type="button"
                onClick={() => setOrderSide('SELL')}
                style={{
                  background: orderSide === 'SELL'
                    ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.15) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: orderSide === 'SELL' ? '1px solid var(--neon-red)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: orderSide === 'SELL' ? 'var(--neon-red)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-hud)',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '7px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                  boxShadow: orderSide === 'SELL' ? '0 0 10px rgba(239, 68, 68, 0.2)' : 'none'
                }}
              >
                SELL / SHORT
              </button>
            </div>

            {/* Order Type Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {['MARKET', 'LIMIT', 'STOP'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  style={{
                    background: orderType === type ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: orderType === type ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: orderType === type ? '#ffffff' : 'var(--text-muted)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '9px',
                    padding: '4px 0',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Price Input (Disabled for MARKET) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                  {orderType === 'MARKET' ? 'MARKET PRICE (EST)' : 'LIMIT / ENTRY PRICE'}
                </span>
                <span style={{ fontSize: '8.5px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-data)' }}>
                  LIVE: ${currentPrice.toFixed(2)}
                </span>
              </div>
              <input
                type="number"
                step="0.01"
                disabled={orderType === 'MARKET'}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder={currentPrice.toFixed(2)}
                style={{
                  width: '100%',
                  background: orderType === 'MARKET' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid var(--border-cyan)',
                  color: orderType === 'MARKET' ? '#94a3b8' : '#ffffff',
                  fontFamily: 'var(--font-data)',
                  fontSize: '13px',
                  fontWeight: 700,
                  padding: '6px 10px',
                  borderRadius: '3px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Quantity Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                  QUANTITY / SHARES
                </span>
                <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                  VAL: ${(entryPrice * sharesCount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="number"
                  min="1"
                  value={sharesInput}
                  onChange={(e) => setSharesInput(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.6)',
                    border: '1px solid var(--border-cyan)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-data)',
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '6px 10px',
                    borderRadius: '3px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Quick Size Percentage Pills */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {[
                  { label: '10%', shares: 20 },
                  { label: '25%', shares: 50 },
                  { label: '50%', shares: 100 },
                  { label: 'MAX', shares: 250 }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setSharesInput(String(p.shares))}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-data)',
                      fontSize: '8px',
                      padding: '2px 0',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sentinel Risk Gate: Take Profit & Stop Loss */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(0, 240, 255, 0.15)',
              borderRadius: '4px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <span style={{ fontSize: '8px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)', letterSpacing: '0.5px' }}>
                🛡️ SENTINEL RISK MANAGEMENT
              </span>

              {/* Take Profit */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '8.5px', color: 'var(--neon-green)', fontFamily: 'var(--font-data)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={useTakeProfit}
                      onChange={(e) => setUseTakeProfit(e.target.checked)}
                      style={{ accentColor: 'var(--neon-green)' }}
                    />
                    TAKE PROFIT (TP)
                  </label>
                  {tpPrice && (
                    <span style={{ fontSize: '8px', color: 'var(--neon-green)', fontFamily: 'var(--font-data)' }}>
                      +${Math.abs((tpPrice - entryPrice) * sharesCount).toFixed(0)}
                    </span>
                  )}
                </div>
                {useTakeProfit && (
                  <input
                    type="number"
                    step="0.01"
                    value={takeProfitInput}
                    onChange={(e) => setTakeProfitInput(e.target.value)}
                    placeholder="TP Price"
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: 'var(--neon-green)',
                      fontFamily: 'var(--font-data)',
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '2px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>

              {/* Stop Loss */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '8.5px', color: 'var(--neon-red)', fontFamily: 'var(--font-data)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={useStopLoss}
                      onChange={(e) => setUseStopLoss(e.target.checked)}
                      style={{ accentColor: 'var(--neon-red)' }}
                    />
                    STOP LOSS (SL)
                  </label>
                  {slPrice && (
                    <span style={{ fontSize: '8px', color: 'var(--neon-red)', fontFamily: 'var(--font-data)' }}>
                      -${Math.abs((entryPrice - slPrice) * sharesCount).toFixed(0)}
                    </span>
                  )}
                </div>
                {useStopLoss && (
                  <input
                    type="number"
                    step="0.01"
                    value={stopLossInput}
                    onChange={(e) => setStopLossInput(e.target.value)}
                    placeholder="SL Price"
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: 'var(--neon-red)',
                      fontFamily: 'var(--font-data)',
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '2px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>

              {/* Reward/Risk & Risk Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                paddingTop: '4px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <div>
                  <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)', display: 'block' }}>REWARD : RISK</span>
                  <span style={{ fontSize: '10px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                    {rrRatioText}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)', display: 'block' }}>TOTAL RISK</span>
                  <span style={{ fontSize: '10px', color: 'var(--neon-red)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                    ${totalRiskDollars.toFixed(0)} ({riskEquityPct}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Feedback notification */}
            {orderFeedback && (
              <div style={{
                padding: '6px 8px',
                borderRadius: '3px',
                fontSize: '8.5px',
                fontFamily: 'var(--font-data)',
                lineHeight: 1.3,
                background: orderFeedback.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                border: orderFeedback.type === 'error' ? '1px solid var(--neon-red)' : '1px solid var(--neon-green)',
                color: orderFeedback.type === 'error' ? 'var(--neon-red)' : 'var(--neon-green)'
              }}>
                {orderFeedback.text}
              </div>
            )}

            {/* Execute Order Button */}
            <button
              onClick={handleOrderSubmit}
              disabled={executingOrder}
              style={{
                marginTop: 'auto',
                background: orderSide === 'BUY'
                  ? 'linear-gradient(180deg, rgba(0, 240, 255, 0.4) 0%, rgba(0, 240, 255, 0.2) 100%)'
                  : 'linear-gradient(180deg, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.2) 100%)',
                border: orderSide === 'BUY' ? '1px solid var(--neon-cyan)' : '1px solid var(--neon-red)',
                color: '#ffffff',
                fontFamily: 'var(--font-hud)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '10px',
                borderRadius: '3px',
                cursor: executingOrder ? 'not-allowed' : 'pointer',
                letterSpacing: '1px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                boxShadow: orderSide === 'BUY' ? '0 0 15px rgba(0, 240, 255, 0.3)' : '0 0 15px rgba(239, 68, 68, 0.3)'
              }}
            >
              <span>{executingOrder ? 'SIGNING WITH SENTINEL...' : `EXECUTE ${orderSide} ${sharesCount} ${currentSymbol}`}</span>
              <span style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 400 }}>
                {orderType} @ ${entryPrice.toFixed(2)} (${totalOrderValue.toLocaleString('en-US', { maximumFractionDigits: 0 })})
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ─── 3. BOTTOM DOCKED TABLES BAR (TRADINGVIEW PRO PANEL) ─── */}
      {showBottomTables && (
        <div style={{
          height: '210px',
          borderTop: '1px solid var(--border-cyan)',
          background: 'rgba(6, 10, 20, 0.98)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 15
        }}>
          {/* Bottom Tabs Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.6)',
            borderBottom: '1px solid rgba(0, 240, 255, 0.1)',
            padding: '0 8px'
          }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              {[
                { id: 'positions', label: `POSITIONS (${portfolio.positions.length})` },
                { id: 'orders', label: `ORDERS (${portfolio.orders.length})` },
                { id: 'account', label: 'ACCOUNT SUMMARY' },
                { id: 'journal', label: 'EXECUTION LOG' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setBottomTab(t.id)}
                  style={{
                    background: bottomTab === t.id ? 'rgba(0, 240, 255, 0.18)' : 'transparent',
                    border: 'none',
                    borderBottom: bottomTab === t.id ? '2px solid var(--neon-cyan)' : '2px solid transparent',
                    color: bottomTab === t.id ? 'var(--neon-cyan)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-hud)',
                    fontSize: '9px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                EQUITY: <span style={{ color: '#ffffff', fontWeight: 700 }}>${portfolio.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </span>
              <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                UNREALIZED: <span style={{ color: portfolio.unrealizedPnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 700 }}>
                  {portfolio.unrealizedPnl >= 0 ? '+' : ''}${portfolio.unrealizedPnl.toFixed(2)}
                </span>
              </span>
              <button
                onClick={refreshPortfolio}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(0, 240, 255, 0.2)',
                  color: 'var(--neon-cyan)',
                  fontSize: '8px',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                ↻
              </button>
              <button
                onClick={() => setShowBottomTables(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}
              >
                ▼
              </button>
            </div>
          </div>

          {/* Tab Content Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
            {/* 1. POSITIONS TABLE */}
            {bottomTab === 'positions' && (
              portfolio.positions.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-data)' }}>
                  NO OPEN POSITIONS // USE THE ON-CHART QUICK TRADER, RANGE TOOL, OR BUY/SELL BUTTONS ABOVE
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-data)', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(0, 240, 255, 0.15)', textAlign: 'left', height: '24px' }}>
                      <th>SYMBOL</th>
                      <th>SIDE / SIZE</th>
                      <th>ENTRY PRICE</th>
                      <th>MARK PRICE</th>
                      <th>UNREALIZED P&L</th>
                      <th>P&L %</th>
                      <th>STOP LOSS</th>
                      <th>TAKE PROFIT</th>
                      <th>MARKET VALUE</th>
                      <th style={{ textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map(p => {
                      const isLong = p.qty > 0;
                      const mark = p.curPrice || p.avgPrice;
                      const val = mark * Math.abs(p.qty);
                      return (
                        <tr key={p.symbol} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', height: '28px' }}>
                          <td>
                            <button
                              onClick={() => handleQuickSelect(p.symbol)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--neon-cyan)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                                fontFamily: 'var(--font-data)'
                              }}
                            >
                              {p.symbol} ↗
                            </button>
                          </td>
                          <td style={{ color: isLong ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 600 }}>
                            {isLong ? `LONG ${p.qty}` : `SHORT ${Math.abs(p.qty)}`}
                          </td>
                          <td>${p.avgPrice?.toFixed(2)}</td>
                          <td style={{ color: '#ffffff', fontWeight: 600 }}>${mark.toFixed(2)}</td>
                          <td style={{ color: (p.pnl || 0) >= 0 ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 700 }}>
                            {(p.pnl || 0) >= 0 ? '+' : ''}${(p.pnl || 0).toFixed(2)}
                          </td>
                          <td style={{ color: (p.pnlPct || 0) >= 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                            {(p.pnlPct || 0) >= 0 ? '+' : ''}{(p.pnlPct || 0).toFixed(2)}%
                          </td>
                          <td style={{ color: 'var(--neon-red)' }}>${p.stopLoss?.toFixed(2) || '—'}</td>
                          <td style={{ color: 'var(--neon-green)' }}>${p.takeProfit?.toFixed(2) || '—'}</td>
                          <td>${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleClosePosition(p)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid var(--neon-red)',
                                color: 'var(--neon-red)',
                                fontFamily: 'var(--font-hud)',
                                fontSize: '8px',
                                padding: '2px 8px',
                                borderRadius: '2px',
                                cursor: 'pointer'
                              }}
                            >
                              ✕ CLOSE
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {/* 2. ORDERS TABLE */}
            {bottomTab === 'orders' && (
              portfolio.orders.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-data)' }}>
                  NO ACTIVE WORKING ORDERS // PLACE A LIMIT OR STOP ORDER FROM THE ORDER TICKET
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-data)', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(0, 240, 255, 0.15)', textAlign: 'left', height: '24px' }}>
                      <th>ORDER ID</th>
                      <th>TIME</th>
                      <th>SYMBOL</th>
                      <th>SIDE / TYPE</th>
                      <th>QTY</th>
                      <th>TARGET PRICE</th>
                      <th>STOP LOSS</th>
                      <th>TAKE PROFIT</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.orders.map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', height: '28px' }}>
                        <td style={{ color: 'var(--neon-cyan)' }}>{o.id}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleTimeString()}</td>
                        <td style={{ fontWeight: 700 }}>{o.symbol}</td>
                        <td style={{ color: o.action === 'BUY' ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 600 }}>
                          {o.action} {o.orderType}
                        </td>
                        <td>{o.shares}</td>
                        <td style={{ color: '#ffffff', fontWeight: 600 }}>${o.price?.toFixed(2)}</td>
                        <td>${o.stopLoss ? o.stopLoss.toFixed(2) : '—'}</td>
                        <td>${o.takeProfit ? o.takeProfit.toFixed(2) : '—'}</td>
                        <td><span className="badge badge-streaming">{o.status}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleCancelOrder(o.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid var(--neon-red)',
                              color: 'var(--neon-red)',
                              fontFamily: 'var(--font-hud)',
                              fontSize: '8px',
                              padding: '2px 6px',
                              borderRadius: '2px',
                              cursor: 'pointer'
                            }}
                          >
                            CANCEL
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {/* 3. ACCOUNT SUMMARY */}
            {bottomTab === 'account' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', height: '100%', alignItems: 'center' }}>
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>DESK EQUITY</span>
                  <div style={{ fontSize: '15px', color: '#ffffff', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
                    ${portfolio.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>FREE CASH</span>
                  <div style={{ fontSize: '15px', color: '#ffffff', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
                    ${portfolio.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>UNREALIZED P&L</span>
                  <div style={{
                    fontSize: '15px',
                    color: portfolio.unrealizedPnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)',
                    fontFamily: 'var(--font-hud)',
                    fontWeight: 700
                  }}>
                    {portfolio.unrealizedPnl >= 0 ? '+' : ''}${portfolio.unrealizedPnl.toFixed(2)}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>REALIZED P&L</span>
                  <div style={{
                    fontSize: '15px',
                    color: portfolio.realizedPnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)',
                    fontFamily: 'var(--font-hud)',
                    fontWeight: 700
                  }}>
                    {portfolio.realizedPnl >= 0 ? '+' : ''}${portfolio.realizedPnl.toFixed(2)}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>MARGIN USED</span>
                  <div style={{ fontSize: '15px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
                    ${(portfolio.marginUsed || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-cyan)' }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>SENTINEL RISK GATE</span>
                  <div style={{ fontSize: '13px', color: 'var(--neon-green)', fontFamily: 'var(--font-hud)', fontWeight: 700 }}>
                    ARMED (2% LIMIT)
                  </div>
                </div>
              </div>
            )}

            {/* 4. EXECUTION LOG / JOURNAL */}
            {bottomTab === 'journal' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-data)', fontSize: '10px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(0, 240, 255, 0.15)', textAlign: 'left', height: '24px' }}>
                    <th>TIME</th>
                    <th>ID</th>
                    <th>SYMBOL</th>
                    <th>ACTION / EXECUTION</th>
                    <th>SENTINEL TOKEN</th>
                    <th>OUTCOME</th>
                  </tr>
                </thead>
                <tbody>
                  {(portfolio.journal || []).slice(0, 10).map(j => (
                    <tr key={j.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', height: '26px' }}>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(j.timestamp).toLocaleTimeString()}</td>
                      <td style={{ color: 'var(--neon-cyan)' }}>{j.id}</td>
                      <td style={{ fontWeight: 700 }}>{j.symbol}</td>
                      <td>{j.action}</td>
                      <td><span className="badge badge-live">{j.sentinelToken || 'SIG_OK'}</span></td>
                      <td style={{ color: (j.outcome || '').includes('-') ? 'var(--neon-red)' : 'var(--neon-green)' }}>
                        {j.outcome}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

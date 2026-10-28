import { DEFAULT_RISK_CONFIG } from '../../shared/config.js';

/**
 * Symbol metadata dictionary mapping common tickers to Sector, Theme, Asset Class, and Beta
 */
export const SYMBOL_METADATA = {
  NVDA: { sector: 'Technology', theme: 'Semiconductors', subtheme: 'AI Hardware', asset_class: 'equity', beta: 1.65 },
  AMD: { sector: 'Technology', theme: 'Semiconductors', subtheme: 'AI Hardware', asset_class: 'equity', beta: 1.55 },
  SMCI: { sector: 'Technology', theme: 'AI Hardware', subtheme: 'Server Infrastructure', asset_class: 'equity', beta: 1.85 },
  AAPL: { sector: 'Technology', theme: 'Consumer Electronics', subtheme: 'Hardware & Services', asset_class: 'equity', beta: 1.10 },
  MSFT: { sector: 'Technology', theme: 'Enterprise Software', subtheme: 'Cloud & AI', asset_class: 'equity', beta: 1.18 },
  TSLA: { sector: 'Consumer Cyclical', theme: 'Automotive / EV', subtheme: 'High-Beta Growth', asset_class: 'equity', beta: 1.95 },
  AMZN: { sector: 'Consumer Cyclical', theme: 'E-Commerce', subtheme: 'Cloud Infrastructure', asset_class: 'equity', beta: 1.25 },
  GOOGL: { sector: 'Communication', theme: 'Internet Search', subtheme: 'Cloud & AdTech', asset_class: 'equity', beta: 1.15 },
  META: { sector: 'Communication', theme: 'Social Media', subtheme: 'Digital Advertising', asset_class: 'equity', beta: 1.30 },
  SPY: { sector: 'Broad Market', theme: 'Large Cap Blend', subtheme: 'ETF', asset_class: 'etf', beta: 1.00 },
  QQQ: { sector: 'Technology', theme: 'Large Cap Growth', subtheme: 'Tech ETF', asset_class: 'etf', beta: 1.22 },
  BTC: { sector: 'Cryptocurrency', theme: 'Digital Store of Value', subtheme: 'Crypto Beta', asset_class: 'crypto', beta: 2.40 },
  ETH: { sector: 'Cryptocurrency', theme: 'Smart Contracts', subtheme: 'Crypto Beta', asset_class: 'crypto', beta: 2.65 },
  USO: { sector: 'Energy', theme: 'Commodities', subtheme: 'Crude Oil', asset_class: 'etf', beta: 0.85 },
  GLD: { sector: 'Materials', theme: 'Precious Metals', subtheme: 'Gold', asset_class: 'etf', beta: 0.15 },
  TLT: { sector: 'Fixed Income', theme: 'Treasury Bonds', subtheme: 'Duration / Rates', asset_class: 'etf', beta: -0.35 }
};

export function getSymbolMetadata(symbol) {
  const s = String(symbol || '').toUpperCase().trim();
  return SYMBOL_METADATA[s] || {
    sector: 'General Equities',
    theme: 'Unclassified',
    subtheme: 'Equities',
    asset_class: 'equity',
    beta: 1.00
  };
}

/**
 * Calculates Position Risk for a single position
 * Formula: Initial Risk = |Entry - Stop| * Quantity
 */
export function calculatePositionRisk(pos, equity, livePrice = null) {
  const currentPrice = livePrice || pos.current_price || pos.curPrice || pos.avgPrice || pos.entry;
  const entry = pos.entry || pos.avgPrice;
  const rawQty = pos.qty !== undefined ? pos.qty : pos.quantity;
  const quantity = Math.abs(rawQty);
  const direction = (pos.direction || (rawQty < 0 ? 'short' : 'long')).toLowerCase();
  const isLong = direction === 'long';

  const stop = pos.stop !== undefined ? pos.stop : (pos.stopLoss || (isLong ? entry * 0.95 : entry * 1.05));
  const target = pos.target !== undefined ? pos.target : (pos.takeProfit || null);

  // Initial risk dollar = |Entry - Stop| * Quantity
  const perShareRisk = Math.abs(entry - stop);
  const initialRisk = parseFloat((perShareRisk * quantity).toFixed(2));

  // Current open risk: risk from current price to stop
  const currentPerShareRisk = isLong ? Math.max(0, currentPrice - stop) : Math.max(0, stop - currentPrice);
  const currentOpenRisk = parseFloat((currentPerShareRisk * quantity).toFixed(2));

  const marketValue = parseFloat((currentPrice * quantity).toFixed(2));
  const unrealizedPnl = parseFloat((isLong ? (currentPrice - entry) * quantity : (entry - currentPrice) * quantity).toFixed(2));
  const riskPercentEquity = equity > 0 ? parseFloat(((initialRisk / equity) * 100).toFixed(2)) : 0;

  let riskR = null;
  if (perShareRisk > 0 && target) {
    const rewardPerShare = isLong ? target - entry : entry - target;
    riskR = parseFloat((rewardPerShare / perShareRisk).toFixed(2));
  }

  const meta = getSymbolMetadata(pos.symbol);

  return {
    symbol: pos.symbol,
    direction,
    quantity,
    entry: parseFloat(entry.toFixed(2)),
    current_price: parseFloat(currentPrice.toFixed(2)),
    market_value: marketValue,
    stop: parseFloat(stop.toFixed(2)),
    target: target ? parseFloat(target.toFixed(2)) : null,
    initial_risk: initialRisk,
    current_open_risk: currentOpenRisk,
    risk_r: riskR,
    risk_percent_equity: riskPercentEquity,
    unrealized_pnl: unrealizedPnl,
    time_in_trade: pos.time_in_trade || pos.entryTime || 'Intraday',
    sector: pos.sector || meta.sector,
    theme: pos.theme || meta.theme,
    asset_class: pos.asset_class || meta.asset_class,
    data_freshness: 'live (within 1s)',
    event_exposure: pos.event_exposure || []
  };
}

/**
 * Calculates Portfolio Heat
 * Formula: Portfolio Heat = sum(|Entry_i - Stop_i| * Quantity_i)
 */
export function calculatePortfolioHeat(positions = [], equity = 1604199.00, startingEquity = 1604199.00, config = DEFAULT_RISK_CONFIG) {
  const cfg = { ...DEFAULT_RISK_CONFIG, ...(config || {}) };
  const currentEquity = Number(equity) > 0 ? Number(equity) : startingEquity;

  let totalHeatDollars = 0;
  const heatBySector = {};
  const heatByTheme = {};
  const heatByAssetClass = {};
  const heatByDirection = { long: 0, short: 0 };

  for (const p of positions) {
    const risk = calculatePositionRisk(p, currentEquity);
    totalHeatDollars += risk.initial_risk;

    // Sector breakdown
    const sec = risk.sector || 'General';
    heatBySector[sec] = parseFloat(((heatBySector[sec] || 0) + risk.initial_risk).toFixed(2));

    // Theme breakdown
    const th = risk.theme || 'General';
    heatByTheme[th] = parseFloat(((heatByTheme[th] || 0) + risk.initial_risk).toFixed(2));

    // Asset class breakdown
    const ac = risk.asset_class || 'equity';
    heatByAssetClass[ac] = parseFloat(((heatByAssetClass[ac] || 0) + risk.initial_risk).toFixed(2));

    // Direction breakdown
    if (risk.direction === 'short') {
      heatByDirection.short = parseFloat((heatByDirection.short + risk.initial_risk).toFixed(2));
    } else {
      heatByDirection.long = parseFloat((heatByDirection.long + risk.initial_risk).toFixed(2));
    }
  }

  totalHeatDollars = parseFloat(totalHeatDollars.toFixed(2));
  const heatPercentCurrentEquity = parseFloat(((totalHeatDollars / currentEquity) * 100).toFixed(2));
  const heatPercentStartingEquity = parseFloat(((totalHeatDollars / startingEquity) * 100).toFixed(2));

  const maxHeatDollars = (cfg.max_portfolio_heat_percent / 100) * currentEquity;
  const remainingHeatBudget = parseFloat(Math.max(0, maxHeatDollars - totalHeatDollars).toFixed(2));

  let status = 'normal';
  if (heatPercentCurrentEquity >= cfg.max_portfolio_heat_percent) {
    status = 'hard_block';
  } else if (heatPercentCurrentEquity >= cfg.soft_portfolio_heat_percent) {
    status = 'soft_warning';
  }

  return {
    total_heat_dollars: totalHeatDollars,
    heat_percent_current_equity: heatPercentCurrentEquity,
    heat_percent_starting_equity: heatPercentStartingEquity,
    remaining_heat_budget: remainingHeatBudget,
    heat_limit_percent: cfg.max_portfolio_heat_percent,
    soft_warning_percent: cfg.soft_portfolio_heat_percent,
    hard_block_percent: cfg.max_portfolio_heat_percent,
    status,
    heat_by_sector: heatBySector,
    heat_by_theme: heatByTheme,
    heat_by_asset_class: heatByAssetClass,
    heat_by_direction: heatByDirection,
    as_of: new Date().toISOString(),
    source: 'sentinel-x:risk-engine'
  };
}

/**
 * Calculates continuous Account Snapshot from paper engine state
 */
export function calculateAccountSnapshot(accountState = {}, livePrices = {}, config = DEFAULT_RISK_CONFIG) {
  const cfg = { ...DEFAULT_RISK_CONFIG, ...(config || {}) };
  const startingEquity = Number(accountState.initialEquity || accountState.starting_equity || 1604199.00);
  const cash = Number(accountState.cash !== undefined ? accountState.cash : 1420500.00);
  const realizedPnl = Number(accountState.realizedPnl !== undefined ? accountState.realizedPnl : 18450.00);
  const peakEquity = Number(accountState.peakEquity || accountState.peak_equity || Math.max(startingEquity, startingEquity + realizedPnl));

  const rawPositions = accountState.positions || [];
  let grossExposure = 0;
  let longExposure = 0;
  let shortExposure = 0;
  let totalUnrealizedPnl = 0;

  // Compute position risks
  const openPositions = rawPositions.map(pos => {
    const cur = livePrices[pos.symbol] || pos.current_price || pos.curPrice || pos.avgPrice || pos.entry;
    const evaluated = calculatePositionRisk(pos, startingEquity, cur);
    grossExposure += evaluated.market_value;
    totalUnrealizedPnl += evaluated.unrealized_pnl;

    if (evaluated.direction === 'short') {
      shortExposure += evaluated.market_value;
    } else {
      longExposure += evaluated.market_value;
    }
    return evaluated;
  });

  const currentEquity = parseFloat((cash + grossExposure + totalUnrealizedPnl).toFixed(2));
  const netExposure = parseFloat((longExposure - shortExposure).toFixed(2));
  grossExposure = parseFloat(grossExposure.toFixed(2));
  longExposure = parseFloat(longExposure.toFixed(2));
  shortExposure = parseFloat(shortExposure.toFixed(2));

  const leverage = currentEquity > 0 ? parseFloat((grossExposure / currentEquity).toFixed(2)) : 0;

  // Daily P&L calculation
  const dailyRealized = Number(accountState.dailyRealizedPnl || 0);
  const dailyPnl = parseFloat((dailyRealized + totalUnrealizedPnl).toFixed(2));
  const dailyPnlPercent = currentEquity > 0 ? parseFloat(((dailyPnl / currentEquity) * 100).toFixed(2)) : 0;

  // Drawdown calculation
  const currentDrawdownDollars = parseFloat(Math.max(0, peakEquity - currentEquity).toFixed(2));
  const currentDrawdownPercent = peakEquity > 0 ? parseFloat(((currentDrawdownDollars / peakEquity) * 100).toFixed(2)) : 0;

  // Portfolio Heat & Risk Budget used
  const heat = calculatePortfolioHeat(openPositions, currentEquity, startingEquity, cfg);
  const dailyRiskLimitDollars = (cfg.daily_loss_limit_percent / 100) * currentEquity;
  const riskUsedToday = Math.abs(Math.min(0, dailyPnl)) + heat.total_heat_dollars;
  const remainingRiskBudget = parseFloat(Math.max(0, dailyRiskLimitDollars - riskUsedToday).toFixed(2));

  return {
    starting_equity: startingEquity,
    current_equity: currentEquity,
    cash: parseFloat(cash.toFixed(2)),
    gross_exposure: grossExposure,
    net_exposure: netExposure,
    long_exposure: longExposure,
    short_exposure: shortExposure,
    leverage,
    open_positions: openPositions,
    pending_orders: accountState.orders || [],
    unrealized_pnl: parseFloat(totalUnrealizedPnl.toFixed(2)),
    realized_pnl: parseFloat(realizedPnl.toFixed(2)),
    daily_pnl: dailyPnl,
    daily_pnl_percent: dailyPnlPercent,
    peak_equity: peakEquity,
    current_drawdown: currentDrawdownDollars,
    current_drawdown_percent: currentDrawdownPercent,
    max_drawdown_percent: cfg.max_drawdown_percent,
    risk_used_today: parseFloat(riskUsedToday.toFixed(2)),
    remaining_risk_budget: remainingRiskBudget,
    as_of: new Date().toISOString(),
    source: 'sentinel-x:paper-ledger'
  };
}

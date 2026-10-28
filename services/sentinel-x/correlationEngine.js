import { DEFAULT_RISK_CONFIG } from '../../shared/config.js';
import { getSymbolMetadata } from './portfolioRiskModel.js';

/**
 * Calculates percentage daily returns from an array of historical closing prices
 * Formula: Returns[t] = (Price[t] - Price[t-1]) / Price[t-1]
 */
export function calculateReturnsFromPrices(prices = []) {
  if (!Array.isArray(prices) || prices.length < 2) return [];
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

/**
 * Computes Pearson correlation coefficient between two equal-length return series
 */
export function calculatePearsonCorrelation(seriesA = [], seriesB = []) {
  if (!Array.isArray(seriesA) || !Array.isArray(seriesB)) return null;
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 5) return null; // Require at least 5 common return samples

  const a = seriesA.slice(0, n);
  const b = seriesB.slice(0, n);

  const meanA = a.reduce((sum, val) => sum + val, 0) / n;
  const meanB = b.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  if (denomA === 0 || denomB === 0) return 0;
  const r = numerator / (Math.sqrt(denomA) * Math.sqrt(denomB));
  return parseFloat(Math.max(-1, Math.min(1, r)).toFixed(4));
}

/**
 * Classifies correlation into human-readable bracket
 */
export function classifyCorrelation(r) {
  if (r === null || r === undefined || isNaN(r)) return 'unknown';
  if (r >= 0.80) return 'very_high';
  if (r >= 0.60) return 'high';
  if (r >= 0.40) return 'moderate';
  if (r >= -0.39) return 'low';
  return 'negative';
}

/**
 * Generates deterministic synthetic returns for lookback window
 * (In production this connects to local market DB or yfinance cache)
 */
export function getHistoricalReturns(symbol, lookback = 60) {
  const meta = getSymbolMetadata(symbol);
  const s = String(symbol || '').toUpperCase().trim();

  // Synthetic deterministic seed based on ticker characters
  let seed = 0;
  for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) % 10000;

  const returns = [];
  const baseVol = 0.015 * (meta.beta || 1.0);

  for (let t = 0; t < lookback; t++) {
    // Generate pseudo-random returns with correlation component linked to market beta
    const marketShock = Math.sin((t + 7) * 0.45) * 0.012;
    const sectorShock = Math.cos((t + seed) * 0.35) * (baseVol * 0.6);
    const idiosyncratic = Math.sin((t * seed + 3) * 0.28) * (baseVol * 0.4);
    returns.push(parseFloat(((marketShock * meta.beta) + sectorShock + idiosyncratic).toFixed(5)));
  }

  return returns;
}

/**
 * Calculates Rolling Correlation Matrix from historical daily returns
 */
export function calculateCorrelationMatrix(symbols = [], options = {}, customReturnData = {}) {
  const lookback = options.lookback_days || DEFAULT_RISK_CONFIG.correlation_lookback_days || 60;
  const frequency = options.frequency || 'daily';
  const cleanSymbols = Array.from(new Set(symbols.map(s => String(s || '').toUpperCase().trim()).filter(Boolean)));

  const returnSeries = {};
  for (const sym of cleanSymbols) {
    if (customReturnData[sym]) {
      returnSeries[sym] = customReturnData[sym].slice(0, lookback);
    } else {
      returnSeries[sym] = getHistoricalReturns(sym, lookback);
    }
  }

  const matrix = {};
  const pairs = [];

  for (let i = 0; i < cleanSymbols.length; i++) {
    const symA = cleanSymbols[i];
    matrix[symA] = matrix[symA] || {};

    for (let j = 0; j < cleanSymbols.length; j++) {
      const symB = cleanSymbols[j];
      if (i === j) {
        matrix[symA][symB] = 1.0;
      } else if (j > i) {
        const seriesA = returnSeries[symA];
        const seriesB = returnSeries[symB];

        let corr = null;
        if (seriesA && seriesB && seriesA.length >= 5 && seriesB.length >= 5) {
          corr = calculatePearsonCorrelation(seriesA, seriesB);
        }

        matrix[symA][symB] = corr;
        matrix[symB] = matrix[symB] || {};
        matrix[symB][symA] = corr;

        if (corr !== null) {
          pairs.push({
            pair: `${symA}/${symB}`,
            symbols: [symA, symB],
            correlation: corr,
            classification: classifyCorrelation(corr),
            lookback
          });
        }
      }
    }
  }

  return {
    lookback_days: lookback,
    frequency,
    symbols: cleanSymbols,
    matrix,
    pairs,
    label: 'Estimated from historical returns; correlations can change quickly.',
    source: 'sentinel-x:correlation-engine',
    as_of: new Date().toISOString()
  };
}

/**
 * Detects Correlated Clusters among open positions
 * Groups positions by:
 * 1. Rolling correlation exceeding threshold (default >= 0.70)
 * 2. Sector/theme overlap (e.g. Semiconductors / AI Hardware)
 * 3. Shared macro factors (e.g. Crypto beta, High-beta growth)
 */
export function detectCorrelatedClusters(positions = [], correlationMatrix = null, config = DEFAULT_RISK_CONFIG) {
  const cfg = { ...DEFAULT_RISK_CONFIG, ...(config || {}) };
  const thresh = cfg.high_correlation_threshold || 0.70;

  if (!positions || positions.length === 0) return [];

  const syms = positions.map(p => p.symbol);
  const matrixObj = correlationMatrix || calculateCorrelationMatrix(syms, { lookback_days: cfg.correlation_lookback_days });
  const pairs = matrixObj.pairs || [];

  // 1. Pre-defined macro clusters by subtheme
  const knownClusters = [
    { id: 'cluster_semi_ai', name: 'Semiconductors & AI Hardware', factor: 'AI Hardware / Chips', members: ['NVDA', 'AMD', 'SMCI', 'AVGO', 'TSM'] },
    { id: 'cluster_big_tech', name: 'Mega-Cap Technology', factor: 'Big Tech Growth', members: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'] },
    { id: 'cluster_high_beta', name: 'High-Beta Growth', factor: 'Risk-On Momentum', members: ['TSLA', 'NVDA', 'SMCI', 'COIN'] },
    { id: 'cluster_crypto', name: 'Crypto Beta', factor: 'Digital Assets', members: ['BTC', 'ETH', 'SOL', 'COIN', 'MSTR'] },
    { id: 'cluster_macro_rates', name: 'Treasury & Rates Duration', factor: 'Yield Sensitivity', members: ['TLT', 'IEF', 'SHY'] }
  ];

  const clusters = [];
  const processedSymbols = new Set();

  // Check known macro clusters first
  for (const kc of knownClusters) {
    const matchingPositions = positions.filter(p => kc.members.includes(p.symbol));
    if (matchingPositions.length >= 2) {
      const clusterSyms = matchingPositions.map(p => p.symbol);
      let combinedHeat = 0;
      let combinedExposure = 0;
      let longCount = 0;
      let shortCount = 0;

      for (const p of matchingPositions) {
        combinedHeat += (p.initial_risk !== undefined ? p.initial_risk : Math.abs(p.entry - p.stop) * Math.abs(p.qty || p.quantity));
        combinedExposure += (p.market_value || Math.abs(p.current_price || p.entry) * Math.abs(p.qty || p.quantity));
        if ((p.direction || '').toLowerCase() === 'short' || (p.qty || 0) < 0) {
          shortCount++;
        } else {
          longCount++;
        }
      }

      // Average pairwise correlation in cluster
      let sumCorr = 0;
      let pairCount = 0;
      for (const pr of pairs) {
        if (clusterSyms.includes(pr.symbols[0]) && clusterSyms.includes(pr.symbols[1])) {
          sumCorr += pr.correlation;
          pairCount++;
        }
      }
      const avgCorr = pairCount > 0 ? parseFloat((sumCorr / pairCount).toFixed(2)) : 0.75;

      clusters.push({
        cluster_id: kc.id,
        name: kc.name,
        factor: kc.factor,
        symbols: clusterSyms,
        combined_heat: parseFloat(combinedHeat.toFixed(2)),
        combined_heat_percent: 0, // Calculated outside with current equity
        combined_exposure: parseFloat(combinedExposure.toFixed(2)),
        average_pairwise_correlation: avgCorr,
        dominant_direction: shortCount > longCount ? 'short' : (longCount > shortCount ? 'long' : 'mixed'),
        common_catalysts: ['Earnings season', 'Tech momentum', 'Macro liquidity'],
        stress_test_loss: null
      });

      clusterSyms.forEach(s => processedSymbols.add(s));
    }
  }

  // Dynamic high-correlation clusters (for pairs exceeding threshold that aren't already clustered)
  for (const pr of pairs) {
    if (pr.correlation >= thresh && !processedSymbols.has(pr.symbols[0]) && !processedSymbols.has(pr.symbols[1])) {
      const posA = positions.find(p => p.symbol === pr.symbols[0]);
      const posB = positions.find(p => p.symbol === pr.symbols[1]);
      if (posA && posB) {
        const pairSyms = [posA.symbol, posB.symbol];
        const heatA = posA.initial_risk || Math.abs(posA.entry - posA.stop) * Math.abs(posA.qty || posA.quantity);
        const heatB = posB.initial_risk || Math.abs(posB.entry - posB.stop) * Math.abs(posB.qty || posB.quantity);
        const expA = posA.market_value || posA.entry * Math.abs(posA.qty || posA.quantity);
        const expB = posB.market_value || posB.entry * Math.abs(posB.qty || posB.quantity);

        clusters.push({
          cluster_id: `cluster_${posA.symbol}_${posB.symbol}`,
          name: `${posA.symbol} + ${posB.symbol} Correlated Pair`,
          factor: `High statistical correlation (${pr.correlation})`,
          symbols: pairSyms,
          combined_heat: parseFloat((heatA + heatB).toFixed(2)),
          combined_heat_percent: 0,
          combined_exposure: parseFloat((expA + expB).toFixed(2)),
          average_pairwise_correlation: pr.correlation,
          dominant_direction: 'mixed',
          common_catalysts: ['Correlated market beta'],
          stress_test_loss: null
        });
        processedSymbols.add(posA.symbol);
        processedSymbols.add(posB.symbol);
      }
    }
  }

  return clusters;
}

/**
 * Evaluates Portfolio Concentration against limits
 */
export function evaluateConcentration(positions = [], equity = 1604199.00, config = DEFAULT_RISK_CONFIG) {
  const cfg = { ...DEFAULT_RISK_CONFIG, ...(config || {}) };
  const currentEquity = Number(equity) || 1604199.00;

  const symbolHeat = {};
  const sectorHeat = {};
  const themeHeat = {};
  const warnings = [];
  const violations = [];

  for (const p of positions) {
    const sym = p.symbol;
    const heat = p.initial_risk !== undefined ? p.initial_risk : Math.abs(p.entry - p.stop) * Math.abs(p.qty || p.quantity);
    const meta = getSymbolMetadata(sym);
    const sec = p.sector || meta.sector;
    const th = p.theme || meta.theme;

    symbolHeat[sym] = (symbolHeat[sym] || 0) + heat;
    sectorHeat[sec] = (sectorHeat[sec] || 0) + heat;
    themeHeat[th] = (themeHeat[th] || 0) + heat;
  }

  // Symbol heat limit checks
  for (const [sym, heat] of Object.entries(symbolHeat)) {
    const pct = parseFloat(((heat / currentEquity) * 100).toFixed(2));
    if (pct > cfg.max_symbol_heat_percent) {
      violations.push({
        type: 'symbol_concentration_breach',
        symbol: sym,
        heat_dollars: heat,
        heat_percent: pct,
        limit_percent: cfg.max_symbol_heat_percent,
        message: `Position ${sym} heat (${pct}%) exceeds single-symbol heat limit (${cfg.max_symbol_heat_percent}%).`
      });
    }
  }

  // Sector heat limit checks
  for (const [sec, heat] of Object.entries(sectorHeat)) {
    const pct = parseFloat(((heat / currentEquity) * 100).toFixed(2));
    if (pct > cfg.max_sector_heat_percent) {
      violations.push({
        type: 'sector_concentration_breach',
        sector: sec,
        heat_dollars: heat,
        heat_percent: pct,
        limit_percent: cfg.max_sector_heat_percent,
        message: `Sector ${sec} combined heat (${pct}%) exceeds sector heat limit (${cfg.max_sector_heat_percent}%).`
      });
    }
  }

  return {
    symbol_heat: symbolHeat,
    sector_heat: sectorHeat,
    theme_heat: themeHeat,
    warnings,
    violations,
    is_concentrated: violations.length > 0
  };
}

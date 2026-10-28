import { getSymbolMetadata } from './portfolioRiskModel.js';

export const SCENARIO_DEFINITIONS = {
  market_down_1_percent: { name: 'Market Down 1%', marketShock: -0.01, techShock: -0.012, cryptoShock: -0.02, oilShock: -0.01 },
  market_down_2_percent: { name: 'Market Down 2%', marketShock: -0.02, techShock: -0.025, cryptoShock: -0.04, oilShock: -0.02 },
  market_down_5_percent: { name: 'Market Down 5% (Severe Correction)', marketShock: -0.05, techShock: -0.065, cryptoShock: -0.10, oilShock: -0.05 },
  market_down_10_percent: { name: 'Market Down 10% (Market Flash Crash)', marketShock: -0.10, techShock: -0.13, cryptoShock: -0.20, oilShock: -0.10 },
  market_up_1_percent: { name: 'Market Up 1%', marketShock: 0.01, techShock: 0.012, cryptoShock: 0.02, oilShock: 0.01 },
  market_up_2_percent: { name: 'Market Up 2%', marketShock: 0.02, techShock: 0.025, cryptoShock: 0.04, oilShock: 0.02 },
  market_up_5_percent: { name: 'Market Up 5% (Broad Rally)', marketShock: 0.05, techShock: 0.065, cryptoShock: 0.10, oilShock: 0.05 },
  tech_down_5_percent: { name: 'Tech Sector Down 5%', marketShock: -0.025, techShock: -0.05, cryptoShock: -0.06, oilShock: 0.0 },
  semiconductors_down_5_percent: { name: 'Semiconductors Down 5%', marketShock: -0.02, techShock: -0.035, semiShock: -0.05, cryptoShock: -0.03, oilShock: 0.0 },
  dollar_up_1_percent: { name: 'US Dollar Up 1%', marketShock: -0.008, techShock: -0.01, goldShock: -0.02, oilShock: -0.015, cryptoShock: -0.025 },
  yields_up_25bp: { name: 'Treasury Yields Up 25 bps', marketShock: -0.015, techShock: -0.025, bondsShock: -0.02, goldShock: -0.015, cryptoShock: -0.03 },
  oil_up_5_percent: { name: 'Crude Oil Up 5%', marketShock: -0.005, techShock: -0.008, energyShock: 0.05, consumerShock: -0.015 },
  oil_down_5_percent: { name: 'Crude Oil Down 5%', marketShock: 0.005, energyShock: -0.05, consumerShock: 0.01 },
  crypto_down_10_percent: { name: 'Crypto Beta Flash Crash (-10%)', marketShock: -0.005, cryptoShock: -0.10, techShock: -0.01 },
  vix_spike_25_percent: { name: 'VIX Spike +25% (Volatility Shock)', marketShock: -0.035, techShock: -0.05, highBetaShock: -0.07, cryptoShock: -0.08 },
  liquidity_shock: { name: 'Liquidity Shock (Widened Spreads & Slippage)', marketShock: -0.02, slippageMultiplier: 2.5, spreadImpact: -0.015 },
  gap_through_stop: { name: 'Overnight Gap Through Stops (-3% Adverse Gap)', gapAdverse: -0.03, marketShock: -0.03 },
  correlation_spike: { name: 'Correlation Spike (All Risk Assets Move to 1.0)', marketShock: -0.045, universalBeta: 1.0 }
};

/**
 * Runs a scenario-based stress test on the open paper portfolio
 */
export function runStressTest(positions = [], equity = 1604199.00, scenarioKey = 'market_down_2_percent') {
  const scenarioDef = SCENARIO_DEFINITIONS[scenarioKey] || SCENARIO_DEFINITIONS.market_down_2_percent;
  const portfolioEquity = Number(equity) || 1604199.00;

  const positionsAffected = [];
  let totalEstimatedPnl = 0;

  for (const pos of positions) {
    const sym = pos.symbol;
    const meta = getSymbolMetadata(sym);
    const beta = meta.beta || 1.0;
    const isLong = (pos.direction || (pos.qty < 0 ? 'short' : 'long')).toLowerCase() === 'long';
    const curPrice = pos.current_price || pos.curPrice || pos.avgPrice || pos.entry;
    const qty = Math.abs(pos.qty || pos.quantity);
    const stopPrice = pos.stop || pos.stopLoss;

    // Determine asset-specific price shock
    let shockPercent = scenarioDef.marketShock * beta;

    if (meta.theme === 'Semiconductors' && scenarioDef.semiShock !== undefined) {
      shockPercent = scenarioDef.semiShock;
    } else if (meta.sector === 'Technology' && scenarioDef.techShock !== undefined) {
      shockPercent = scenarioDef.techShock * (beta > 1.2 ? 1.2 : 1.0);
    } else if (meta.asset_class === 'crypto' && scenarioDef.cryptoShock !== undefined) {
      shockPercent = scenarioDef.cryptoShock;
    } else if (sym === 'TLT' && scenarioDef.bondsShock !== undefined) {
      shockPercent = scenarioDef.bondsShock;
    }

    if (scenarioDef.gapAdverse) {
      shockPercent = isLong ? scenarioDef.gapAdverse : -scenarioDef.gapAdverse;
    }

    // Impact on position price
    const newPrice = Math.max(0.01, curPrice * (1 + shockPercent));
    const priceChange = newPrice - curPrice;
    let posPnl = (isLong ? priceChange : -priceChange) * qty;

    // Check if protective stop was breached during the shock
    let stopBreached = false;
    if (stopPrice) {
      if (isLong && newPrice <= stopPrice) {
        stopBreached = true;
        // If not a gap-through scenario, model stop execution at stop price
        if (!scenarioDef.gapAdverse) {
          posPnl = (stopPrice - curPrice) * qty;
        }
      } else if (!isLong && newPrice >= stopPrice) {
        stopBreached = true;
        if (!scenarioDef.gapAdverse) {
          posPnl = (curPrice - stopPrice) * qty;
        }
      }
    }

    posPnl = parseFloat(posPnl.toFixed(2));
    totalEstimatedPnl += posPnl;

    positionsAffected.push({
      symbol: sym,
      direction: isLong ? 'long' : 'short',
      estimated_pnl: posPnl,
      stop_breached: stopBreached,
      data_source: `sentinel-x:beta-model:${sym}`
    });
  }

  totalEstimatedPnl = parseFloat(totalEstimatedPnl.toFixed(2));
  const estimatedPnlPercent = portfolioEquity > 0
    ? parseFloat(((totalEstimatedPnl / portfolioEquity) * 100).toFixed(2))
    : 0;

  return {
    scenario: scenarioKey,
    scenario_name: scenarioDef.name,
    as_of: new Date().toISOString(),
    portfolio_equity: portfolioEquity,
    estimated_portfolio_pnl: totalEstimatedPnl,
    estimated_portfolio_pnl_percent: estimatedPnlPercent,
    positions_affected: positionsAffected,
    assumptions: [
      'Historical beta estimated from 60-day daily returns',
      scenarioDef.gapAdverse ? 'Adverse gap through stop loss applied' : 'Stops honored without catastrophic slippage unless specified',
      'Current position quantities and prices held constant',
      'Model-estimated scenario impact based on macroeconomic factor shocks'
    ],
    limitations: [
      'Scenario analysis is not a prediction or guarantee of future results',
      'Correlations and betas can spike toward 1.0 during periods of acute market dislocation',
      'Actual execution fills in live markets may differ significantly from modeled prices due to liquidity gaps'
    ],
    sources: [
      'sentinel-x:stress-engine',
      'local-ledger:open-positions',
      'yfinance:rolling-beta-cache'
    ]
  };
}

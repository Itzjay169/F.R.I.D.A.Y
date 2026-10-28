import { calculatePositionRisk } from './portfolioRiskModel.js';
import { getSymbolMetadata } from './portfolioRiskModel.js';

/**
 * Generates an intelligent, step-by-step risk reduction plan
 * 
 * @param {Array} positions - Current open positions
 * @param {Object} options
 * @param {number} [options.targetReductionPercent=30] - Desired risk reduction (e.g. 30%)
 * @param {string} [options.targetSector] - Specific sector to reduce (e.g. 'Technology')
 * @param {string} [options.targetTheme] - Specific theme to reduce (e.g. 'Semiconductors')
 * @param {string} [options.mode='defensive'] - 'defensive', 'cut_highest', 'sector_focus', 'custom'
 * @param {number} [options.equity=1604199.00]
 * @returns {Object} Structured RiskReductionPlan
 */
export function generateRiskReductionPlan(positions = [], options = {}) {
  const equity = Number(options.equity) || 1604199.00;
  const targetPct = Number(options.targetReductionPercent) || 30;
  const targetSector = options.targetSector ? String(options.targetSector).toLowerCase() : null;
  const targetTheme = options.targetTheme ? String(options.targetTheme).toLowerCase() : null;
  const mode = options.mode || 'defensive';

  if (!positions || positions.length === 0) {
    return {
      plan_id: `rrp_${Date.now()}`,
      as_of: new Date().toISOString(),
      target_reduction_percent: targetPct,
      current_heat: 0,
      projected_heat: 0,
      risk_saved_dollars: 0,
      actions: [],
      requires_human_confirmation: true,
      message: 'No open positions to reduce.'
    };
  }

  // Evaluate risk of each position
  const evaluated = positions.map(pos => {
    const riskObj = calculatePositionRisk(pos, equity);
    const meta = getSymbolMetadata(pos.symbol);
    return {
      ...pos,
      ...riskObj,
      meta
    };
  });

  // Calculate current heat
  const currentHeat = evaluated.reduce((sum, p) => sum + p.initial_risk, 0);
  const targetDollarReduction = (targetPct / 100) * currentHeat;

  // Sort candidates according to mode:
  // - 'cut_highest': highest initial risk first
  // - 'sector_focus': matching sector first, then highest risk
  // - 'defensive': worst unrealized PnL or high-beta names first
  const candidates = [...evaluated];

  if (targetSector || targetTheme) {
    candidates.sort((a, b) => {
      const matchA = (targetSector && a.sector.toLowerCase().includes(targetSector)) ||
                     (targetTheme && a.theme.toLowerCase().includes(targetTheme));
      const matchB = (targetSector && b.sector.toLowerCase().includes(targetSector)) ||
                     (targetTheme && b.theme.toLowerCase().includes(targetTheme));
      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
      return b.initial_risk - a.initial_risk;
    });
  } else if (mode === 'cut_highest') {
    candidates.sort((a, b) => b.initial_risk - a.initial_risk);
  } else {
    // Defensive: prioritize underperforming positions or highest risk
    candidates.sort((a, b) => {
      if (a.unrealized_pnl < 0 && b.unrealized_pnl >= 0) return -1;
      if (b.unrealized_pnl < 0 && a.unrealized_pnl >= 0) return 1;
      return b.initial_risk - a.initial_risk;
    });
  }

  let accumulatedSaved = 0;
  const actions = [];

  for (const pos of candidates) {
    if (accumulatedSaved >= targetDollarReduction && actions.length >= 1) break;

    const remainingNeeded = targetDollarReduction - accumulatedSaved;

    // Option 1: Tighten stop if current price is substantially in profit
    const isLong = pos.direction === 'long';
    const curPrice = pos.current_price;
    const entry = pos.entry;
    const isProfitable = isLong ? curPrice > entry : curPrice < entry;

    if (isProfitable && Math.abs(curPrice - entry) > Math.abs(entry - pos.stop) * 0.5) {
      // Propose trailing stop to breakeven or near current price
      const newStop = isLong ? parseFloat((entry * 1.002).toFixed(2)) : parseFloat((entry * 0.998).toFixed(2));
      const newRisk = Math.abs(entry - newStop) * pos.quantity;
      const saved = Math.max(0, pos.initial_risk - newRisk);

      actions.push({
        action: 'tighten_stop',
        symbol: pos.symbol,
        current_risk: pos.initial_risk,
        proposed_risk: parseFloat(newRisk.toFixed(2)),
        risk_saved: parseFloat(saved.toFixed(2)),
        impact_on_thesis: `Raise stop to near breakeven ($${newStop}), locking in capital protection without cutting exposure.`,
        tradeoff: 'Higher probability of being stopped out on normal intraday volatility.',
        required_sentinel_approval: true,
        required_pilot_execution: true
      });
      accumulatedSaved += saved;
      continue;
    }

    // Option 2: Partial reduction (50% trim) if position is large
    if (pos.initial_risk >= remainingNeeded * 0.5 && pos.quantity > 1) {
      const trimFraction = 0.5;
      const saved = pos.initial_risk * trimFraction;
      const proposedRisk = pos.initial_risk - saved;

      actions.push({
        action: 'reduce',
        symbol: pos.symbol,
        current_risk: pos.initial_risk,
        proposed_risk: parseFloat(proposedRisk.toFixed(2)),
        risk_saved: parseFloat(saved.toFixed(2)),
        impact_on_thesis: `Trim 50% of ${pos.symbol} position (${Math.floor(pos.quantity * trimFraction)} shares). Preserves partial upside thesis while halving dollar risk.`,
        tradeoff: 'Reduces upside participation if original thesis plays out to full target.',
        required_sentinel_approval: true,
        required_pilot_execution: true
      });
      accumulatedSaved += saved;
      continue;
    }

    // Option 3: Full position closure
    const saved = pos.initial_risk;
    actions.push({
      action: 'close',
      symbol: pos.symbol,
      current_risk: pos.initial_risk,
      proposed_risk: 0,
      risk_saved: parseFloat(saved.toFixed(2)),
      impact_on_thesis: `Completely close ${pos.symbol} (${pos.quantity} shares). Eliminates $${saved.toFixed(2)} of risk immediately.`,
      tradeoff: 'Full forfeiture of ongoing trade setup and realization of any current unrealized P&L.',
      required_sentinel_approval: true,
      required_pilot_execution: true
    });
    accumulatedSaved += saved;
  }

  const projectedHeat = parseFloat(Math.max(0, currentHeat - accumulatedSaved).toFixed(2));

  return {
    plan_id: `rrp_${Date.now()}`,
    as_of: new Date().toISOString(),
    target_reduction_percent: targetPct,
    current_heat: parseFloat(currentHeat.toFixed(2)),
    projected_heat: projectedHeat,
    risk_saved_dollars: parseFloat(accumulatedSaved.toFixed(2)),
    actions,
    requires_human_confirmation: true,
    rules_notice: 'SENTINEL-X proposes risk actions only. Execution requires explicit user confirmation, SENTINEL token authorization, and PILOT execution.'
  };
}

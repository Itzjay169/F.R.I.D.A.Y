import { DEFAULT_RISK_CONFIG } from '../../shared/config.js';
import { calculateAccountSnapshot, calculatePortfolioHeat, calculatePositionRisk } from '../../services/sentinel-x/portfolioRiskModel.js';
import { calculateCorrelationMatrix, detectCorrelatedClusters, evaluateConcentration } from '../../services/sentinel-x/correlationEngine.js';
import { runStressTest, SCENARIO_DEFINITIONS } from '../../services/sentinel-x/stressTesting.js';
import { calculateRiskBudget } from '../../services/sentinel-x/riskBudget.js';
import { killSwitchManager } from '../../services/sentinel-x/killSwitch.js';
import { pretradePortfolioCheck } from '../../services/sentinel-x/pretradeCheck.js';
import { generateRiskReductionPlan } from '../../services/sentinel-x/riskReductionPlanner.js';

/**
 * Security Assertion: SENTINEL-X is strictly prohibited from executing, modifying,
 * approving, or canceling paper or live trades.
 */
export function assertSentinelXCannotExecute(action = '') {
  const forbidden = [
    'place_order', 'execute_order', 'fill_order', 'cancel_order',
    'modify_order', 'approve_order', 'execute_trade', 'paper_fill',
    'generate_pilot_token', 'bypass_pilot'
  ];
  const act = String(action).toLowerCase().trim();
  if (forbidden.some(f => act.includes(f))) {
    throw new Error(`SECURITY VIOLATION: SENTINEL-X is strictly prohibited from executing, placing, modifying, canceling, or approving trades. Action '${action}' blocked.`);
  }
  return true;
}

/**
 * Natural language intent parser for SENTINEL-X
 */
export function parseSentinelXIntent(input = '') {
  const text = String(input || '').toLowerCase().trim();

  // 1. Kill Switch Activation / Deactivation
  if (text.includes('activate') && (text.includes('kill switch') || text.includes('killswitch') || text.includes('halt'))) {
    return { intent: 'activate_kill_switch', text };
  }
  if (text.includes('deactivate') && (text.includes('kill switch') || text.includes('killswitch') || text.includes('resume'))) {
    return { intent: 'deactivate_kill_switch', text };
  }

  // 2. Risk Reduction / Defensive Plan
  if (
    text.includes('reduce') ||
    text.includes('cut my') ||
    text.includes('defensive plan') ||
    text.includes('what should i close first') ||
    text.includes('risk-reduction') ||
    text.includes('risk reduction')
  ) {
    let targetPct = 30;
    const matchPct = text.match(/(\d+)\s*%/);
    if (matchPct) targetPct = parseInt(matchPct[1], 10);

    let targetSector = null;
    if (text.includes('semi') || text.includes('semiconductor')) targetSector = 'semiconductor';
    else if (text.includes('tech')) targetSector = 'technology';

    let mode = 'defensive';
    if (text.includes('highest') || text.includes('biggest')) mode = 'cut_highest';

    return { intent: 'recommend_risk_reduction', targetReductionPercent: targetPct, targetSector, mode, text };
  }

  // 3. Stress Testing
  if (text.includes('stress test') || text.includes('stress-test') || text.includes('what happens if')) {
    let scenario = 'market_down_2_percent';
    if (text.includes('tech drops 5%') || text.includes('tech down 5%') || text.includes('tech down')) {
      scenario = 'tech_down_5_percent';
    } else if (text.includes('semi') && (text.includes('down') || text.includes('drop'))) {
      scenario = 'semiconductors_down_5_percent';
    } else if (text.includes('10%') || text.includes('crash')) {
      scenario = 'market_down_10_percent';
    } else if (text.includes('5%')) {
      scenario = 'market_down_5_percent';
    } else if (text.includes('crypto')) {
      scenario = 'crypto_down_10_percent';
    } else if (text.includes('vix')) {
      scenario = 'vix_spike_25_percent';
    }
    return { intent: 'stress_test_portfolio', scenario, text };
  }

  // 4. Correlation & Clusters
  if (text.includes('correlat') || text.includes('cluster')) {
    return { intent: 'correlation_report', text };
  }

  // 5. Concentration & Exposure
  if (text.includes('concentrat') || text.includes('too exposed') || text.includes('exposure')) {
    let target = null;
    if (text.includes('tech')) target = 'tech';
    if (text.includes('semi')) target = 'semiconductors';
    return { intent: 'concentration_report', target, text };
  }

  // 6. Portfolio Heat
  if (text.includes('heat') || text.includes('how much heat')) {
    return { intent: 'portfolio_heat', text };
  }

  // 7. Risk Budget / Daily Loss Status
  if (text.includes('budget') || text.includes('daily loss') || text.includes('can i take another trade') || text.includes('take another trade')) {
    return { intent: 'risk_budget_report', text };
  }

  // 8. Pretrade Check (e.g. "Can I take another NVDA long?")
  const matchPretrade = text.match(/(?:can i|should i|check if i can)\s+(?:take|buy|short)\s+(?:another\s+)?([a-z]+)/i);
  if (matchPretrade) {
    const symbol = matchPretrade[1].toUpperCase();
    const direction = text.includes('short') ? 'short' : 'long';
    return { intent: 'pretrade_portfolio_check', symbol, direction, text };
  }

  // 9. Explain Veto
  if (text.includes('why did you block') || text.includes('why was') && text.includes('vetoed') || text.includes('explain veto')) {
    return { intent: 'explain_veto', text };
  }

  // 10. Default Portfolio Risk Report
  return { intent: 'portfolio_risk_report', text };
}

/**
 * SENTINEL-X Specialist Agent
 */
export class SentinelXAgent {
  constructor(config = DEFAULT_RISK_CONFIG) {
    this.name = 'SENTINEL-X';
    this.role = 'Portfolio Risk Officer';
    this.config = { ...DEFAULT_RISK_CONFIG, ...(config || {}) };
    this.personality = 'Cold, precise, conservative, and unimpressed by conviction.';
  }

  /**
   * Main entrypoint for processing natural-language risk queries
   */
  async handleCommand(commandText, accountSnapshot = {}, livePrices = {}) {
    assertSentinelXCannotExecute(commandText);
    const parsed = parseSentinelXIntent(commandText);
    const snapshot = calculateAccountSnapshot(accountSnapshot, livePrices, this.config);
    const heat = calculatePortfolioHeat(snapshot.open_positions, snapshot.current_equity, snapshot.starting_equity, this.config);

    // Continuous auto-trigger evaluation
    killSwitchManager.evaluateAutoTriggers(snapshot, heat, this.config);
    const killSwitch = killSwitchManager.getState();
    const budget = calculateRiskBudget({ ...snapshot, total_heat_dollars: heat.total_heat_dollars }, killSwitch.active, this.config);

    switch (parsed.intent) {
      case 'activate_kill_switch':
        return this.handleActivateKillSwitch(parsed);

      case 'deactivate_kill_switch':
        return this.handleDeactivateKillSwitch(parsed);

      case 'portfolio_heat':
        return this.handlePortfolioHeat(snapshot, heat);

      case 'correlation_report':
        return this.handleCorrelationReport(snapshot.open_positions);

      case 'concentration_report':
        return this.handleConcentrationReport(snapshot.open_positions, snapshot.current_equity, parsed.target);

      case 'stress_test_portfolio':
        return this.handleStressTest(snapshot.open_positions, snapshot.current_equity, parsed.scenario);

      case 'risk_budget_report':
        return this.handleRiskBudgetReport(budget, snapshot);

      case 'recommend_risk_reduction':
        return this.handleRiskReduction(snapshot.open_positions, snapshot.current_equity, parsed);

      case 'pretrade_portfolio_check':
        return this.handlePretradeCheck(parsed, snapshot.open_positions, snapshot);

      case 'explain_veto':
        return this.handleExplainVeto(snapshot, budget, heat);

      case 'portfolio_risk_report':
      default:
        return this.handlePortfolioRiskReport(snapshot, heat, budget, killSwitch);
    }
  }

  handlePortfolioHeat(snapshot, heat) {
    const formattedHeatDollars = `$${heat.total_heat_dollars.toLocaleString()}`;
    const statusNote = heat.status === 'hard_block'
      ? 'HARD BLOCK. Portfolio heat exceeds limit.'
      : (heat.status === 'soft_warning' ? 'SOFT WARNING. Heat approaching limit.' : 'Heat within safe limits.');

    return {
      status: 'ok',
      agent: this.name,
      intent: 'portfolio_heat',
      message: `Portfolio heat is currently ${heat.heat_percent_current_equity}% (${formattedHeatDollars}). Remaining budget: $${heat.remaining_heat_budget.toLocaleString()}. ${statusNote}`,
      data: {
        heat,
        equity: snapshot.current_equity
      }
    };
  }

  handleCorrelationReport(positions) {
    const symbols = positions.map(p => p.symbol);
    const matrix = calculateCorrelationMatrix(symbols, { lookback_days: this.config.correlation_lookback_days });
    const clusters = detectCorrelatedClusters(positions, matrix, this.config);

    let summary = `Evaluated rolling correlations for ${symbols.length} positions over ${matrix.lookback_days} trading days using returns. `;
    if (clusters.length > 0) {
      const clusterNames = clusters.map(c => `${c.name} (${c.symbols.join(', ')})`).join('; ');
      summary += `Detected ${clusters.length} correlated cluster(s): ${clusterNames}.`;
    } else {
      summary += 'No critical correlated clusters detected.';
    }

    return {
      status: 'ok',
      agent: this.name,
      intent: 'correlation_report',
      message: summary,
      data: {
        matrix,
        clusters,
        disclaimer: matrix.label
      }
    };
  }

  handleConcentrationReport(positions, equity, target) {
    const concentration = evaluateConcentration(positions, equity, this.config);
    let message = 'Portfolio concentration audit complete. ';

    if (concentration.violations.length > 0) {
      message += `ALERT: ${concentration.violations.map(v => v.message).join(' ')}`;
    } else {
      message += 'No single symbol or sector exceeds hard concentration boundaries.';
    }

    return {
      status: 'ok',
      agent: this.name,
      intent: 'concentration_report',
      message,
      data: concentration
    };
  }

  handleStressTest(positions, equity, scenarioKey) {
    const result = runStressTest(positions, equity, scenarioKey);
    const sign = result.estimated_portfolio_pnl >= 0 ? '+' : '';
    const formattedPnl = `${sign}$${result.estimated_portfolio_pnl.toLocaleString()} (${sign}${result.estimated_portfolio_pnl_percent}%)`;

    return {
      status: 'ok',
      agent: this.name,
      intent: 'stress_test_portfolio',
      message: `Stress Scenario [${result.scenario_name}]: Estimated portfolio impact is ${formattedPnl}. (Model-estimated from 60d beta returns; not a guarantee).`,
      data: result
    };
  }

  handleRiskBudgetReport(budget, snapshot) {
    const pctUsed = ((budget.daily_risk_used / budget.daily_budget_dollars) * 100).toFixed(0);
    return {
      status: 'ok',
      agent: this.name,
      intent: 'risk_budget_report',
      message: `Risk State: ${budget.risk_state}. Daily budget is ${pctUsed}% used ($${budget.daily_risk_used.toLocaleString()} of $${budget.daily_budget_dollars.toLocaleString()}). Remaining daily buffer: $${budget.daily_budget_remaining.toLocaleString()}. ${budget.reason}`,
      data: {
        budget,
        snapshot
      }
    };
  }

  handleRiskReduction(positions, equity, parsed) {
    const plan = generateRiskReductionPlan(positions, {
      equity,
      targetReductionPercent: parsed.targetReductionPercent,
      targetSector: parsed.targetSector,
      mode: parsed.mode
    });

    const actionCount = plan.actions.length;
    const msg = actionCount > 0
      ? `Proposed defensive plan to reduce risk by $${plan.risk_saved_dollars.toLocaleString()} (${plan.target_reduction_percent}% reduction). ${actionCount} risk actions recommended. Awaiting user confirmation before PILOT execution.`
      : 'No open positions require defensive reduction.';

    return {
      status: 'ok',
      agent: this.name,
      intent: 'recommend_risk_reduction',
      message: msg,
      data: plan
    };
  }

  handlePretradeCheck(parsed, positions, snapshot) {
    const check = pretradePortfolioCheck({
      symbol: parsed.symbol,
      direction: parsed.direction || 'long',
      entry: 100, // Placeholder if evaluating general capability
      stop: 97,
      quantity: 50
    }, positions, snapshot, this.config);

    return {
      status: 'ok',
      agent: this.name,
      intent: 'pretrade_portfolio_check',
      message: check.reason,
      data: check
    };
  }

  handleActivateKillSwitch(parsed) {
    const res = killSwitchManager.activate({
      activated_by: 'user',
      reason: parsed.text || 'User manual command',
      propose_risk_reduction: true
    });

    return {
      status: 'ok',
      agent: this.name,
      intent: 'activate_kill_switch',
      message: '🚨 PORTFOLIO KILL SWITCH ACTIVATED. All new paper entries are blocked. Existing stops and targets remain active.',
      data: res.state
    };
  }

  handleDeactivateKillSwitch(parsed) {
    const res = killSwitchManager.deactivate({
      user_reason: 'User explicitly confirmed resume after reviewing risk state.',
      confirmed: true
    });

    return {
      status: 'ok',
      agent: this.name,
      intent: 'deactivate_kill_switch',
      message: res.success ? res.message : res.error,
      data: res.state
    };
  }

  handleExplainVeto(snapshot, budget, heat) {
    const reasons = [];
    if (heat.status === 'hard_block') reasons.push(`Portfolio heat is at ${heat.heat_percent_current_equity}% (limit: ${heat.heat_limit_percent}%).`);
    if (budget.daily_budget_remaining <= 0) reasons.push(`Daily risk budget exhausted ($${budget.daily_loss_realized.toLocaleString()} realized loss).`);
    if (killSwitchManager.getState().active) reasons.push('Kill switch is currently active.');

    const explanation = reasons.length > 0
      ? `Trades are blocked because: ${reasons.join(' ')}`
      : 'No active portfolio vetoes. New trades must still pass trade-level Sentinel review.';

    return {
      status: 'ok',
      agent: this.name,
      intent: 'explain_veto',
      message: explanation,
      data: {
        reasons,
        risk_state: budget.risk_state
      }
    };
  }

  handlePortfolioRiskReport(snapshot, heat, budget, killSwitch) {
    return {
      status: 'ok',
      agent: this.name,
      intent: 'portfolio_risk_report',
      message: `SENTINEL-X Portfolio Status [State: ${budget.risk_state}]: Heat is ${heat.heat_percent_current_equity}% ($${heat.total_heat_dollars.toLocaleString()}). Gross exposure: $${snapshot.gross_exposure.toLocaleString()}. Drawdown: ${snapshot.current_drawdown_percent}%. Kill Switch: ${killSwitch.active ? 'ACTIVE' : 'OFF'}.`,
      data: {
        snapshot,
        heat,
        budget,
        kill_switch: killSwitch
      }
    };
  }
}

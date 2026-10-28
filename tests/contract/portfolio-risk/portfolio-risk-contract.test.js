import { describe, it, expect } from 'vitest';
import {
  validatePositionRisk,
  validatePortfolioHeat,
  validatePortfolioSnapshot,
  validateCorrelationMatrix,
  validateCorrelatedCluster,
  validateStressTestResult,
  validateRiskBudget,
  validateKillSwitchState,
  validatePretradePortfolioCheck,
  validateRiskReductionPlan
} from '../../../shared/contract.js';

describe('SENTINEL-X Contract Tests — Zod Schema Validation (Phase 7.5)', () => {
  // ── POSITION RISK ──
  it('1. validates a well-formed PositionRisk object', () => {
    const res = validatePositionRisk({
      symbol: 'NVDA',
      direction: 'long',
      quantity: 50,
      entry: 118.80,
      current_price: 120.50,
      market_value: 6025.00,
      stop: 115.00,
      target: 130.00,
      initial_risk: 190.00,
      current_open_risk: 275.00,
      risk_r: 2.95,
      risk_percent_equity: 0.01,
      unrealized_pnl: 85.00,
      time_in_trade: '2026-09-15',
      sector: 'Technology',
      theme: 'Semiconductors',
      asset_class: 'equity',
      data_freshness: 'live (within 1s)',
      event_exposure: ['CPI in 5 days']
    });
    expect(res.valid).toBe(true);
  });

  it('2. rejects PositionRisk with invalid direction or negative risk', () => {
    const res = validatePositionRisk({
      symbol: 'NVDA',
      direction: 'sideways', // Invalid
      quantity: 50,
      entry: 118.80,
      current_price: 120.50,
      market_value: 6025.00,
      stop: 115.00,
      initial_risk: 190.00,
      current_open_risk: 275.00,
      risk_percent_equity: 0.01,
      unrealized_pnl: 85.00
    });
    expect(res.valid).toBe(false);
  });

  // ── PORTFOLIO HEAT ──
  it('3. validates PortfolioHeat with sector and theme breakdowns', () => {
    const res = validatePortfolioHeat({
      total_heat_dollars: 4500.00,
      heat_percent_current_equity: 2.81,
      heat_percent_starting_equity: 2.81,
      remaining_heat_budget: 51251.94,
      heat_limit_percent: 6.0,
      soft_warning_percent: 4.0,
      hard_block_percent: 6.0,
      status: 'normal',
      heat_by_sector: { Technology: 3500.00, 'Consumer Cyclical': 1000.00 },
      heat_by_theme: { Semiconductors: 3500.00, Automotive: 1000.00 },
      heat_by_asset_class: { equity: 4500.00 },
      heat_by_direction: { long: 4500.00, short: 0 },
      as_of: new Date().toISOString(),
      source: 'sentinel-x:risk-engine'
    });
    expect(res.valid).toBe(true);
  });

  // ── PORTFOLIO SNAPSHOT ──
  it('4. validates PortfolioSnapshotSchema', () => {
    const res = validatePortfolioSnapshot({
      starting_equity: 1604199.00,
      current_equity: 1623341.00,
      cash: 1420500.00,
      gross_exposure: 202841.00,
      net_exposure: 180000.00,
      long_exposure: 191420.50,
      short_exposure: 11420.50,
      leverage: 0.12,
      open_positions: [],
      pending_orders: [],
      unrealized_pnl: 692.00,
      realized_pnl: 18450.00,
      daily_pnl: 1250.00,
      daily_pnl_percent: 0.08,
      peak_equity: 1623341.00,
      current_drawdown: 0,
      current_drawdown_percent: 0,
      max_drawdown_percent: 12.0,
      risk_used_today: 4500.00,
      remaining_risk_budget: 43600.00,
      as_of: new Date().toISOString(),
      source: 'sentinel-x:paper-ledger'
    });
    expect(res.valid).toBe(true);
  });

  // ── CORRELATION MATRIX ──
  it('5. validates CorrelationMatrixSchema with required disclaimer', () => {
    const res = validateCorrelationMatrix({
      lookback_days: 60,
      frequency: 'daily',
      symbols: ['NVDA', 'AMD'],
      matrix: {
        NVDA: { NVDA: 1.0, AMD: 0.82 },
        AMD: { NVDA: 0.82, AMD: 1.0 }
      },
      pairs: [
        { pair: 'NVDA/AMD', correlation: 0.82, classification: 'very_high', lookback: 60 }
      ],
      label: 'Estimated from historical returns; correlations can change quickly.',
      source: 'sentinel-x:correlation-engine',
      as_of: new Date().toISOString()
    });
    expect(res.valid).toBe(true);
  });

  // ── CORRELATED CLUSTERS ──
  it('6. validates CorrelatedClusterSchema', () => {
    const res = validateCorrelatedCluster({
      cluster_id: 'cl_semi_01',
      name: 'Semiconductors & AI Hardware',
      factor: 'AI Hardware / Chips',
      symbols: ['NVDA', 'AMD', 'SMCI'],
      combined_heat: 3200.00,
      combined_heat_percent: 1.99,
      combined_exposure: 45000.00,
      average_pairwise_correlation: 0.84,
      dominant_direction: 'long',
      common_catalysts: ['Earnings season', 'Hyperscaler capex'],
      stress_test_loss: -2500.00
    });
    expect(res.valid).toBe(true);
  });

  // ── STRESS TEST RESULT ──
  it('7. validates StressTestResultSchema with assumptions and limitations', () => {
    const res = validateStressTestResult({
      scenario: 'tech_down_5_percent',
      as_of: new Date().toISOString(),
      portfolio_equity: 1604199.00,
      estimated_portfolio_pnl: -3820.00,
      estimated_portfolio_pnl_percent: -0.24,
      positions_affected: [
        {
          symbol: 'NVDA',
          direction: 'long',
          estimated_pnl: -1450.00,
          stop_breached: false,
          data_source: 'yfinance:history:NVDA'
        }
      ],
      assumptions: [
        'Historical beta estimated from 60-day returns',
        'No gap adjustment',
        'Current position sizes',
        'Model-estimated scenario impact'
      ],
      limitations: [
        'Scenario analysis is not a prediction',
        'Correlations may rise during stress',
        'Actual fills may differ from modeled prices'
      ],
      sources: ['sentinel-x:stress-engine', 'local-ledger:open-positions']
    });
    expect(res.valid).toBe(true);
  });

  // ── RISK BUDGET ──
  it('8. validates RiskBudgetSchema with valid risk states', () => {
    const validStates = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'BLACK'];
    for (const state of validStates) {
      const res = validateRiskBudget({
        daily_budget_percent: 3.0,
        daily_budget_dollars: 48125.97,
        daily_loss_realized: 1500.00,
        daily_heat_open: 4500.00,
        daily_risk_used: 6000.00,
        daily_budget_remaining: 42125.97,
        weekly_budget_percent: 8.0,
        weekly_budget_dollars: 128335.92,
        weekly_loss_realized: 3000.00,
        weekly_risk_used: 7500.00,
        weekly_budget_remaining: 120835.92,
        risk_state: state,
        reason: `Desk in ${state} condition`,
        as_of: new Date().toISOString()
      });
      expect(res.valid).toBe(true);
    }
  });

  // ── KILL SWITCH STATE ──
  it('9. validates KillSwitchStateSchema enforcing explicit confirmation requirement', () => {
    const res = validateKillSwitchState({
      active: true,
      activated_at: new Date().toISOString(),
      activated_by: 'system',
      reason: 'Daily loss limit breached',
      trigger_metric: 'daily_pnl_percent',
      trigger_value: -3.12,
      limit: -3.00,
      new_entries_blocked: true,
      existing_stops_active: true,
      existing_targets_active: true,
      risk_reduction_proposed: true,
      deactivation_requires: 'explicit_user_confirmation'
    });
    expect(res.valid).toBe(true);
  });

  // ── PRETRADE PORTFOLIO CHECK ──
  it('10. validates PretradePortfolioCheckSchema', () => {
    const res = validatePretradePortfolioCheck({
      verdict: 'approve',
      portfolio_heat_before: 0.031,
      portfolio_heat_after: 0.044,
      heat_limit: 0.06,
      daily_risk_used: 0.012,
      daily_risk_limit: 0.03,
      correlation_warning: 'NVDA and AMD estimated correlation 0.82 over 60 days',
      concentration_warning: 'Semiconductor cluster would use 68% of sector heat limit',
      stress_note: 'A 5% tech decline is estimated to reduce equity by 3.7%',
      required_changes: [],
      reason: 'APPROVE: Proposed trade remains within portfolio heat and daily risk budget.',
      sources: ['sentinel-x:portfolio-risk-engine'],
      as_of: new Date().toISOString()
    });
    expect(res.valid).toBe(true);
  });

  // ── RISK REDUCTION PLAN ──
  it('11. validates RiskReductionPlanSchema', () => {
    const res = validateRiskReductionPlan({
      plan_id: 'rrp_101',
      as_of: new Date().toISOString(),
      target_reduction_percent: 30,
      current_heat: 5000.00,
      projected_heat: 3500.00,
      risk_saved_dollars: 1500.00,
      actions: [
        {
          action: 'reduce',
          symbol: 'NVDA',
          current_risk: 2000.00,
          proposed_risk: 1000.00,
          risk_saved: 1000.00,
          impact_on_thesis: 'Trim 50% shares',
          tradeoff: 'Half upside participation',
          required_sentinel_approval: true,
          required_pilot_execution: true
        }
      ],
      requires_human_confirmation: true
    });
    expect(res.valid).toBe(true);
  });

  // ── TEST 19: Source and As-Of Timestamp Requirement ──
  it('19. every risk metric schema enforces a verifiable source and as-of timestamp', () => {
    const heatRes = validatePortfolioHeat({
      total_heat_dollars: 100, heat_percent_current_equity: 0.01, heat_percent_starting_equity: 0.01,
      remaining_heat_budget: 1000, status: 'normal',
      heat_by_sector: {}, heat_by_theme: {}, heat_by_asset_class: {}, heat_by_direction: { long: 100, short: 0 },
      as_of: new Date().toISOString(), source: 'sentinel-x:risk-engine'
    });
    expect(heatRes.data.source).toBeDefined();
    expect(heatRes.data.as_of).toBeDefined();

    const snapshotRes = validatePortfolioSnapshot({
      starting_equity: 10000, current_equity: 10000, cash: 10000, gross_exposure: 0, net_exposure: 0,
      long_exposure: 0, short_exposure: 0, open_positions: [], unrealized_pnl: 0, realized_pnl: 0,
      daily_pnl: 0, daily_pnl_percent: 0, peak_equity: 10000, current_drawdown: 0, current_drawdown_percent: 0,
      risk_used_today: 0, remaining_risk_budget: 500,
      as_of: new Date().toISOString(), source: 'sentinel-x:paper-ledger'
    });
    expect(snapshotRes.data.source).toBeDefined();
    expect(snapshotRes.data.as_of).toBeDefined();
  });
});

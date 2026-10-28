import { describe, it, expect, beforeEach } from 'vitest';
import { pretradePortfolioCheck } from '../../../services/sentinel-x/pretradeCheck.js';
import { detectCorrelatedClusters, calculateCorrelationMatrix } from '../../../services/sentinel-x/correlationEngine.js';
import { killSwitchManager } from '../../../services/sentinel-x/killSwitch.js';
import { SentinelXAgent } from '../../../agents/sentinel-x/sentinelXAgent.js';
import { reviewTradePlanWithSentinelSuite } from '../../../services/sentinelReview.js';

describe('SENTINEL-X Portfolio Risk Integration Tests (Phase 7.5)', () => {
  const baseEquity = 100000;
  let defaultPositions = [];

  beforeEach(() => {
    killSwitchManager._resetForTesting();
    defaultPositions = [
      { symbol: 'NVDA', entry: 120, current_price: 122, stop: 110, qty: 100, direction: 'long' }, // Heat = $1,000 (1%)
      { symbol: 'AAPL', entry: 220, current_price: 225, stop: 215, qty: 200, direction: 'long' }, // Heat = $1,000 (1%)
      { symbol: 'MSFT', entry: 420, current_price: 425, stop: 410, qty: 100, direction: 'long' }  // Heat = $1,000 (1%)
    ];
  });

  // ══════════════════════════════════════════════════════
  // TEST 3: A new trade that breaches heat limit is vetoed
  // ══════════════════════════════════════════════════════
  it('3. a new trade that breaches heat limit is vetoed or modified', () => {
    // Current heat is $3,000 (3% of $100k).
    // Propose a trade that adds $4,000 of risk (Total becomes $7,000 = 7%, exceeding 6% heat limit)
    const proposedTrade = {
      symbol: 'TSLA',
      entry: 250,
      stop: 210, // $40 risk per share
      quantity: 100, // 100 * $40 = $4,000 risk
      direction: 'long'
    };

    const check = pretradePortfolioCheck(proposedTrade, defaultPositions, { current_equity: baseEquity });
    expect(['veto', 'modify']).toContain(check.verdict);
    expect(check.portfolio_heat_after).toBeGreaterThan(0.06);
    expect(check.required_changes.length).toBeGreaterThan(0);
    expect(check.reason.toLowerCase()).toContain('portfolio heat');
  });

  // ══════════════════════════════════════════════════════
  // TEST 4: A new trade that breaches daily risk budget is vetoed
  // ══════════════════════════════════════════════════════
  it('4. a new trade that breaches daily risk budget is vetoed', () => {
    // Equity $100,000, 3% daily loss limit = $3,000.
    // Assume account already lost $2,500 today.
    const accountState = {
      current_equity: baseEquity,
      daily_pnl: -2500.00
    };

    // Proposed trade has $1,000 risk -> daily risk would become $3,500 > $3,000
    const proposedTrade = {
      symbol: 'AMZN',
      entry: 180,
      stop: 170,
      quantity: 100,
      direction: 'long'
    };

    const check = pretradePortfolioCheck(proposedTrade, [], accountState);
    expect(['veto', 'modify']).toContain(check.verdict);
    expect(check.reason).toContain('daily risk budget');
  });

  // ══════════════════════════════════════════════════════
  // TEST 5: A trade that breaches symbol concentration is vetoed or modified
  // ══════════════════════════════════════════════════════
  it('5. a trade that breaches symbol concentration is vetoed or modified', () => {
    // NVDA already has $1,000 heat (1%). Adding another $1,500 heat pushes NVDA to 2.5% (exceeding 2% single-symbol limit)
    const proposedTrade = {
      symbol: 'NVDA',
      entry: 120,
      stop: 105, // $15 risk
      quantity: 100, // $1,500 risk
      direction: 'long'
    };

    const check = pretradePortfolioCheck(proposedTrade, defaultPositions, { current_equity: baseEquity });
    expect(['veto', 'modify']).toContain(check.verdict);
    expect(check.concentration_warning).toContain('NVDA');
    expect(check.reason).toContain('Symbol concentration');
  });

  // ══════════════════════════════════════════════════════
  // TEST 6: A trade that breaches sector concentration is vetoed or modified
  // ══════════════════════════════════════════════════════
  it('6. a trade that breaches sector concentration is vetoed or modified', () => {
    // Current positions: NVDA ($1,000 Tech) + AAPL ($1,000 Tech) + MSFT ($1,000 Tech) = $3,000 Tech heat (3.0%).
    // Sector limit is 3.0%. Adding another Tech stock (AMD) with $1,000 heat pushes Tech to 4.0%!
    const proposedTrade = {
      symbol: 'AMD',
      entry: 150,
      stop: 140, // $10 risk
      quantity: 100, // $1,000 risk
      direction: 'long'
    };

    const check = pretradePortfolioCheck(proposedTrade, defaultPositions, { current_equity: baseEquity });
    expect(['veto', 'modify']).toContain(check.verdict);
    expect(check.concentration_warning).toContain('Technology');
    expect(check.reason).toContain('Sector heat for Technology');
  });

  // ══════════════════════════════════════════════════════
  // TEST 7: Correlated positions are grouped into a cluster
  // ══════════════════════════════════════════════════════
  it('7. correlated positions are grouped into a cluster', () => {
    const positions = [
      { symbol: 'NVDA', entry: 120, current_price: 125, stop: 110, qty: 100 },
      { symbol: 'AMD', entry: 150, current_price: 152, stop: 140, qty: 80 },
      { symbol: 'SMCI', entry: 800, current_price: 810, stop: 750, qty: 10 }
    ];

    const matrix = calculateCorrelationMatrix(['NVDA', 'AMD', 'SMCI']);
    const clusters = detectCorrelatedClusters(positions, matrix);

    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const semiCluster = clusters.find(c => c.cluster_id === 'cluster_semi_ai');
    expect(semiCluster).toBeDefined();
    expect(semiCluster.symbols).toEqual(expect.arrayContaining(['NVDA', 'AMD', 'SMCI']));
    expect(semiCluster.average_pairwise_correlation).toBeGreaterThan(0.5);
  });

  // ══════════════════════════════════════════════════════
  // NATURAL LANGUAGE COMMAND DISPATCH TESTS
  // ══════════════════════════════════════════════════════
  it('SENTINEL-X handles "What is my portfolio heat?"', async () => {
    const agent = new SentinelXAgent();
    const result = await agent.handleCommand('What is my portfolio heat?', {
      equity: 1604199.00,
      positions: defaultPositions
    });

    expect(result.status).toBe('ok');
    expect(result.intent).toBe('portfolio_heat');
    expect(result.data.heat.total_heat_dollars).toBeDefined();
    expect(result.message).toContain('Portfolio heat is currently');
  });

  it('SENTINEL-X handles "Stress test my portfolio if tech drops 5%"', async () => {
    const agent = new SentinelXAgent();
    const result = await agent.handleCommand('Stress test my portfolio if tech drops 5%', {
      equity: 1604199.00,
      positions: defaultPositions
    });

    expect(result.status).toBe('ok');
    expect(result.intent).toBe('stress_test_portfolio');
    expect(result.data.scenario).toBe('tech_down_5_percent');
    expect(result.data.estimated_portfolio_pnl).toBeDefined();
    expect(result.message).toContain('Estimated portfolio impact');
  });

  it('SENTINEL-X handles "Reduce my risk by 30%"', async () => {
    const agent = new SentinelXAgent();
    const result = await agent.handleCommand('Reduce my risk by 30%', {
      equity: 1604199.00,
      positions: defaultPositions
    });

    expect(result.status).toBe('ok');
    expect(result.intent).toBe('recommend_risk_reduction');
    expect(result.data.target_reduction_percent).toBe(30);
    expect(result.data.actions.length).toBeGreaterThan(0);
    expect(result.data.requires_human_confirmation).toBe(true);
  });

  it('SENTINEL-X handles "Activate the kill switch"', async () => {
    const agent = new SentinelXAgent();
    const result = await agent.handleCommand('Activate the kill switch', {
      equity: 1604199.00,
      positions: defaultPositions
    });

    expect(result.status).toBe('ok');
    expect(result.intent).toBe('activate_kill_switch');
    expect(result.data.active).toBe(true);
    expect(killSwitchManager.getState().active).toBe(true);
  });

  it('SENTINEL-X dual-check integration with reviewTradePlanWithSentinelSuite', () => {
    // Test that reviewTradePlanWithSentinelSuite runs both Sentinel (Level 1) and Sentinel-X (Level 2)
    const validPlan = {
      id: 'tp_suite_01',
      symbol: 'TSLA',
      direction: 'long',
      timeframe: 'swing',
      thesis: 'Breakout above consolidation',
      entry: { type: 'market', price: 250 },
      stop: { price: 240 }, // $10 risk
      targets: [
        { level: 1, price: 270, exit_pct: 50 },
        { level: 2, price: 285, exit_pct: 50 }
      ],
      position_size: { quantity: 100 }, // $1,000 risk
      invalidation: { condition: 'Close below 240' }
    };

    const suiteResult = reviewTradePlanWithSentinelSuite(validPlan, {
      positions: defaultPositions,
      accountSnapshot: { current_equity: baseEquity }
    });

    expect(suiteResult.sentinel_x_checked).toBe(true);
    expect(suiteResult.portfolio_verdict).toBeDefined();
    expect(suiteResult.verdict).toBe('approve');
  });
});

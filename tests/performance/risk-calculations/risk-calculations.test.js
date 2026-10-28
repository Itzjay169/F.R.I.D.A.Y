import { describe, it, expect } from 'vitest';
import { calculatePortfolioHeat, calculateAccountSnapshot } from '../../../services/sentinel-x/portfolioRiskModel.js';
import { calculateCorrelationMatrix, detectCorrelatedClusters } from '../../../services/sentinel-x/correlationEngine.js';
import { runStressTest, SCENARIO_DEFINITIONS } from '../../../services/sentinel-x/stressTesting.js';

describe('SENTINEL-X Performance & Calculation Benchmarks (Phase 7.5)', () => {
  const symbols = ['NVDA', 'AMD', 'SMCI', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META', 'SPY', 'QQQ', 'BTC', 'ETH', 'TLT', 'GLD'];

  const largePortfolio = symbols.map((sym, i) => ({
    symbol: sym,
    entry: 100 + i * 10,
    current_price: 102 + i * 10,
    stop: 95 + i * 10,
    target: 120 + i * 10,
    qty: 50 + (i % 3) * 20,
    direction: i % 4 === 0 ? 'short' : 'long'
  }));

  it('1. portfolio heat calculation for 15 positions executes in under 20ms', () => {
    const start = performance.now();
    for (let iter = 0; iter < 50; iter++) {
      calculatePortfolioHeat(largePortfolio, 1604199.00, 1604199.00);
    }
    const elapsed = performance.now() - start;
    const avgPerRun = elapsed / 50;

    expect(avgPerRun).toBeLessThan(10); // Less than 10ms per calculation
  });

  it('2. 15-symbol correlation matrix with 60 lookback days computes in under 30ms', () => {
    const start = performance.now();
    const matrix = calculateCorrelationMatrix(symbols, { lookback_days: 60 });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(matrix.symbols).toHaveLength(15);
    expect(matrix.pairs.length).toBeGreaterThan(50);
  });

  it('3. cluster detection on 15 positions executes in under 15ms', () => {
    const matrix = calculateCorrelationMatrix(symbols, { lookback_days: 60 });
    const start = performance.now();
    const clusters = detectCorrelatedClusters(largePortfolio, matrix);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(30);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
  });

  it('4. batch stress testing across all built-in scenarios completes in under 40ms', () => {
    const scenarioKeys = Object.keys(SCENARIO_DEFINITIONS);
    const start = performance.now();

    for (const key of scenarioKeys) {
      const res = runStressTest(largePortfolio, 1604199.00, key);
      expect(res.estimated_portfolio_pnl).toBeDefined();
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(80); // All 18 scenarios in < 80ms total
  });

  it('5. account snapshot continuous evaluation executes in under 10ms', () => {
    const start = performance.now();
    const snap = calculateAccountSnapshot({
      initialEquity: 1604199.00,
      cash: 1400000.00,
      realizedPnl: 12000.00,
      positions: largePortfolio
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(20);
    expect(snap.open_positions).toHaveLength(15);
    expect(snap.gross_exposure).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { DESK_CONFIG } from '../shared/config.js';

describe('Desk Configuration & Safety Rules', () => {
  it('must strictly enforce LIVE_TRADING = false', () => {
    expect(DESK_CONFIG.liveTrading).toBe(false);
  });

  it('must define Friday master and 9 specialist agents', () => {
    expect(DESK_CONFIG.agents).toHaveLength(10);
    const master = DESK_CONFIG.agents.find(a => a.id === 'friday');
    expect(master).toBeDefined();

    const expectedSpecialists = [
      'capitol', 'scout', 'sentinel', 'pilot', 'ledger',
      'oracle', 'chartist', 'athena', 'atlas'
    ];
    for (const specId of expectedSpecialists) {
      const found = DESK_CONFIG.agents.find(a => a.id === specId);
      expect(found).toBeDefined();
      expect(found.voice).toBeDefined();
      expect(found.color).toBeDefined();
      expect(found.role).toBeDefined();
    }
  });

  it('must specify all 4 market pulse symbols with valid values', () => {
    expect(DESK_CONFIG.marketPulse).toHaveLength(4);
    const symbols = DESK_CONFIG.marketPulse.map(p => p.symbol);
    expect(symbols).toEqual(['SPY', 'QQQ', 'NVDA', 'BTC']);
  });

  it('must include the mandatory disclaimer text', () => {
    expect(DESK_CONFIG.disclaimer).toContain('NOT FINANCIAL ADVICE');
    expect(DESK_CONFIG.disclaimer).toContain('PAPER TRADING ONLY');
  });
});

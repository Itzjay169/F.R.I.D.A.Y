/**
 * ArchiveManagerView — ARCHIVE HUD Panel
 * Phase 6.5: Research Library, Playbooks, Trade Reviews
 *
 * Three-panel layout:
 * 1. Research Library (search, browse, save)
 * 2. Playbooks (create, view, backtest)
 * 3. Trade Reviews (draft, browse, stats)
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─────────────────── STYLES ───────────────────

const panelStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-cyan)',
  borderRadius: '6px',
  padding: '12px',
  overflowY: 'auto'
};

const headerStyle = {
  fontFamily: 'var(--font-hud)',
  fontSize: '10px',
  letterSpacing: '2px',
  color: 'var(--neon-cyan)',
  marginBottom: '10px',
  textTransform: 'uppercase',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const itemCardStyle = {
  background: 'rgba(0, 240, 255, 0.04)',
  border: '1px solid rgba(0, 240, 255, 0.12)',
  borderRadius: '4px',
  padding: '8px 10px',
  marginBottom: '6px',
  cursor: 'pointer',
  transition: 'all 0.15s ease'
};

const tagStyle = {
  display: 'inline-block',
  fontFamily: 'var(--font-data)',
  fontSize: '8px',
  padding: '1px 5px',
  borderRadius: '2px',
  background: 'rgba(0, 240, 255, 0.12)',
  border: '1px solid rgba(0, 240, 255, 0.2)',
  color: 'var(--neon-cyan)',
  marginRight: '3px',
  marginTop: '3px'
};

const btnStyle = {
  fontFamily: 'var(--font-hud)',
  fontSize: '9px',
  padding: '3px 10px',
  background: 'rgba(0, 240, 255, 0.1)',
  border: '1px solid rgba(0, 240, 255, 0.3)',
  color: 'var(--neon-cyan)',
  borderRadius: '3px',
  cursor: 'pointer',
  letterSpacing: '1px'
};

const btnActiveStyle = {
  ...btnStyle,
  background: 'rgba(0, 240, 255, 0.25)',
  borderColor: 'var(--neon-cyan)'
};

const inputStyle = {
  fontFamily: 'var(--font-data)',
  fontSize: '11px',
  padding: '5px 8px',
  background: 'rgba(0, 0, 0, 0.3)',
  border: '1px solid rgba(0, 240, 255, 0.2)',
  borderRadius: '3px',
  color: '#e0f7fa',
  outline: 'none',
  flex: 1
};

const statBox = {
  background: 'rgba(0, 240, 255, 0.06)',
  border: '1px solid rgba(0, 240, 255, 0.15)',
  borderRadius: '4px',
  padding: '8px',
  textAlign: 'center'
};

const labelStyle = {
  fontFamily: 'var(--font-hud)',
  fontSize: '8px',
  letterSpacing: '1px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase'
};

const valueStyle = {
  fontFamily: 'var(--font-data)',
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--neon-cyan)'
};

// ─────────────────── FETCH HELPERS ───────────────────

async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    return await res.json();
  } catch (err) {
    console.warn('[ARCHIVE UI]', err.message);
    return { status: 'error', error: err.message };
  }
}

// ─────────────────── RESEARCH PANEL ───────────────────

function ResearchPanel({ onNotify }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [health, setHealth] = useState(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch('/api/archive/search?limit=30');
    if (data.items) setItems(data.items);
    setLoading(false);
  }, []);

  const loadHealth = useCallback(async () => {
    const data = await apiFetch('/api/archive/health');
    setHealth(data);
  }, []);

  useEffect(() => {
    loadItems();
    loadHealth();
  }, [loadItems, loadHealth]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return loadItems();
    setLoading(true);
    const data = await apiFetch(`/api/archive/search?q=${encodeURIComponent(searchQuery)}`);
    if (data.items) setItems(data.items);
    setLoading(false);
  };

  const handleDelete = async (itemId) => {
    await apiFetch('/api/archive/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', item_id: itemId })
    });
    setDetail(null);
    loadItems();
    loadHealth();
    if (onNotify) onNotify('ARCHIVE', `Deleted item ${itemId}`, 'var(--neon-cyan)');
  };

  return (
    <div style={{ ...panelStyle, height: '100%' }}>
      <div style={headerStyle}>
        <span>📚 RESEARCH LIBRARY</span>
        {health && (
          <span style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: 'var(--text-muted)' }}>
            {health.research_items || 0} items · {health.embeddings || 0} embedded
          </span>
        )}
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="Search research notes, theses, snapshots..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={inputStyle}
        />
        <button onClick={handleSearch} style={btnStyle}>SEARCH</button>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-data)', textAlign: 'center', padding: '20px' }}>
          Searching archive...
        </div>
      ) : detail ? (
        // Detail View
        <div>
          <button onClick={() => setDetail(null)} style={{ ...btnStyle, marginBottom: '8px' }}>← BACK</button>
          <div style={{ ...itemCardStyle, background: 'rgba(0, 240, 255, 0.08)' }}>
            <div style={{ fontFamily: 'var(--font-hud)', fontSize: '11px', color: '#e0f7fa', marginBottom: '4px' }}>
              {detail.title}
            </div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Kind: {detail.kind} · Symbol: {detail.symbol || '—'} · {detail.asset_class} · {detail.timeframe}
            </div>
            {detail.thesis && (
              <div style={{ fontFamily: 'var(--font-data)', fontSize: '10px', color: '#b2dfdb', marginBottom: '6px' }}>
                {detail.thesis}
              </div>
            )}
            {detail.body && (
              <pre style={{
                fontFamily: 'var(--font-data)', fontSize: '9px', color: '#90a4ae',
                whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: '6px',
                borderRadius: '3px', maxHeight: '200px', overflowY: 'auto'
              }}>
                {detail.body}
              </pre>
            )}
            {(detail.tags || []).length > 0 && (
              <div style={{ marginTop: '4px' }}>
                {detail.tags.map((t, i) => <span key={i} style={tagStyle}>{t}</span>)}
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: '8px', fontFamily: 'var(--font-data)', fontSize: '8px', color: 'var(--text-muted)'
            }}>
              <span>{detail.model_generated ? '🤖 Model-generated' : '👤 User-authored'}</span>
              <button onClick={() => handleDelete(detail.item_id)} style={{ ...btnStyle, color: '#ef4444', borderColor: '#ef4444' }}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-data)', textAlign: 'center', padding: '20px' }}>
          No research items yet. Use voice commands like "Save this NVDA thesis" to start building your library.
        </div>
      ) : (
        items.map(item => (
          <div
            key={item.item_id}
            onClick={() => setDetail(item)}
            style={itemCardStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--neon-cyan)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.12)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: '10px', color: '#e0f7fa', fontWeight: 600 }}>
                {item.title}
              </div>
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: '8px',
                color: item.kind === 'thesis' ? '#4ade80' : item.kind === 'trade_plan' ? '#facc15' : 'var(--text-muted)',
                textTransform: 'uppercase'
              }}>
                {item.kind}
              </span>
            </div>
            {item.thesis && (
              <div style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: '#90a4ae', marginTop: '2px' }}>
                {item.thesis.slice(0, 80)}{item.thesis.length > 80 ? '…' : ''}
              </div>
            )}
            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '3px' }}>
              {(item.tags || []).slice(0, 4).map((t, i) => <span key={i} style={tagStyle}>{t}</span>)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────── PLAYBOOKS PANEL ───────────────────

function PlaybooksPanel({ onNotify }) {
  const [playbooks, setPlaybooks] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadPlaybooks = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch('/api/archive/playbooks');
    if (data.playbooks) setPlaybooks(data.playbooks);
    setLoading(false);
  }, []);

  useEffect(() => { loadPlaybooks(); }, [loadPlaybooks]);

  return (
    <div style={{ ...panelStyle, height: '100%' }}>
      <div style={headerStyle}>
        <span>📋 PLAYBOOKS</span>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: 'var(--text-muted)' }}>
          {playbooks.length} playbooks
        </span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '10px', textAlign: 'center', padding: '20px' }}>
          Loading playbooks...
        </div>
      ) : detail ? (
        <div>
          <button onClick={() => setDetail(null)} style={{ ...btnStyle, marginBottom: '8px' }}>← BACK</button>
          <div style={{ ...itemCardStyle, background: 'rgba(0, 240, 255, 0.08)' }}>
            <div style={{ fontFamily: 'var(--font-hud)', fontSize: '11px', color: '#e0f7fa', marginBottom: '6px' }}>
              {detail.name}
            </div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: '#90a4ae', marginBottom: '8px' }}>
              {detail.description}
            </div>

            {/* Performance Grid */}
            {detail.performance_summary && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                <div style={statBox}>
                  <div style={labelStyle}>TRADES</div>
                  <div style={valueStyle}>{detail.performance_summary.trade_count}</div>
                </div>
                <div style={statBox}>
                  <div style={labelStyle}>WIN RATE</div>
                  <div style={{ ...valueStyle, color: detail.performance_summary.win_rate >= 0.5 ? '#4ade80' : '#ef4444' }}>
                    {(detail.performance_summary.win_rate * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={statBox}>
                  <div style={labelStyle}>AVG R</div>
                  <div style={{ ...valueStyle, color: detail.performance_summary.average_r >= 0 ? '#4ade80' : '#ef4444' }}>
                    {detail.performance_summary.average_r}R
                  </div>
                </div>
                <div style={statBox}>
                  <div style={labelStyle}>PROFIT FACTOR</div>
                  <div style={valueStyle}>{detail.performance_summary.profit_factor}</div>
                </div>
                <div style={statBox}>
                  <div style={labelStyle}>MAX DD</div>
                  <div style={{ ...valueStyle, color: '#ef4444' }}>{detail.performance_summary.max_drawdown}R</div>
                </div>
                <div style={statBox}>
                  <div style={labelStyle}>REGIME</div>
                  <div style={{ ...valueStyle, fontSize: '11px' }}>{detail.market_regime}</div>
                </div>
              </div>
            )}

            {/* Rules */}
            {['entry_rules', 'stop_rules', 'target_rules', 'invalidation_rules'].map(ruleKey => (
              (detail[ruleKey] || []).length > 0 && (
                <div key={ruleKey} style={{ marginBottom: '6px' }}>
                  <div style={{ ...labelStyle, marginBottom: '3px' }}>{ruleKey.replace(/_/g, ' ')}</div>
                  {detail[ruleKey].map((rule, i) => (
                    <div key={i} style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: '#b2dfdb', paddingLeft: '8px' }}>
                      • {rule}
                    </div>
                  ))}
                </div>
              )
            ))}
          </div>
        </div>
      ) : playbooks.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-data)', textAlign: 'center', padding: '20px' }}>
          No playbooks yet. Complete and review trades, then say "Create a playbook from my AAPL trades."
        </div>
      ) : (
        playbooks.map(pb => (
          <div
            key={pb.playbook_id}
            onClick={() => setDetail(pb)}
            style={itemCardStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--neon-cyan)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.12)'}
          >
            <div style={{ fontFamily: 'var(--font-data)', fontSize: '10px', color: '#e0f7fa', fontWeight: 600 }}>
              {pb.name}
            </div>
            <div style={{ display: 'flex', gap: '12px', fontFamily: 'var(--font-data)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {pb.performance_summary && (
                <>
                  <span>WR: {(pb.performance_summary.win_rate * 100).toFixed(0)}%</span>
                  <span>Avg R: {pb.performance_summary.average_r}</span>
                  <span>{pb.performance_summary.trade_count} trades</span>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────── REVIEWS PANEL ───────────────────

function ReviewsPanel({ onNotify }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [detail, setDetail] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list | stats
  const [loading, setLoading] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch('/api/archive/reviews');
    if (data.reviews) setReviews(data.reviews);
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    const data = await apiFetch('/api/archive/reviews/stats');
    setStats(data);
  }, []);

  useEffect(() => {
    loadReviews();
    loadStats();
  }, [loadReviews, loadStats]);

  const outcomeColor = (outcome) => {
    if (outcome === 'win') return '#4ade80';
    if (outcome === 'loss') return '#ef4444';
    if (outcome === 'scratch') return '#facc15';
    return 'var(--text-muted)';
  };

  return (
    <div style={{ ...panelStyle, height: '100%' }}>
      <div style={headerStyle}>
        <span>📝 TRADE REVIEWS</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setViewMode('list')} style={viewMode === 'list' ? btnActiveStyle : btnStyle}>LIST</button>
          <button onClick={() => setViewMode('stats')} style={viewMode === 'stats' ? btnActiveStyle : btnStyle}>STATS</button>
        </div>
      </div>

      {viewMode === 'stats' && stats ? (
        // Stats view
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
            <div style={statBox}>
              <div style={labelStyle}>TOTAL REVIEWS</div>
              <div style={valueStyle}>{stats.total_reviews || 0}</div>
            </div>
            <div style={statBox}>
              <div style={labelStyle}>AVG PROCESS</div>
              <div style={{ ...valueStyle, color: (stats.avg_process_score || 0) >= 70 ? '#4ade80' : '#ef4444' }}>
                {stats.avg_process_score || '—'}
              </div>
            </div>
            <div style={statBox}>
              <div style={labelStyle}>AVG DISCIPLINE</div>
              <div style={{ ...valueStyle, color: (stats.avg_discipline_score || 0) >= 70 ? '#4ade80' : '#ef4444' }}>
                {stats.avg_discipline_score || '—'}
              </div>
            </div>
          </div>

          {/* Outcome breakdown */}
          {stats.outcome_breakdown && Object.keys(stats.outcome_breakdown).length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ ...labelStyle, marginBottom: '4px' }}>OUTCOME BREAKDOWN</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {Object.entries(stats.outcome_breakdown).map(([outcome, count]) => (
                  <div key={outcome} style={{ fontFamily: 'var(--font-data)', fontSize: '10px' }}>
                    <span style={{ color: outcomeColor(outcome), fontWeight: 700 }}>{count}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '3px' }}>{outcome}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common mistakes */}
          {(stats.most_common_mistakes || []).length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ ...labelStyle, marginBottom: '4px' }}>⚠️ COMMON MISTAKES</div>
              {stats.most_common_mistakes.map((m, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: '#ef4444', paddingLeft: '8px', marginBottom: '2px' }}>
                  • {m.mistake} ({m.count}×)
                </div>
              ))}
            </div>
          )}

          {/* Top lessons */}
          {(stats.most_common_lessons || []).length > 0 && (
            <div>
              <div style={{ ...labelStyle, marginBottom: '4px' }}>💡 TOP LESSONS</div>
              {stats.most_common_lessons.map((l, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: '#4ade80', paddingLeft: '8px', marginBottom: '2px' }}>
                  • {l.lesson} ({l.count}×)
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '10px', textAlign: 'center', padding: '20px' }}>
          Loading reviews...
        </div>
      ) : detail ? (
        // Detail view
        <div>
          <button onClick={() => setDetail(null)} style={{ ...btnStyle, marginBottom: '8px' }}>← BACK</button>
          <div style={{ ...itemCardStyle, background: 'rgba(0, 240, 255, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'var(--font-hud)', fontSize: '11px', color: '#e0f7fa' }}>
                {detail.symbol} Trade Review
              </span>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: '10px', color: outcomeColor(detail.outcome), fontWeight: 700, textTransform: 'uppercase' }}>
                {detail.outcome} {detail.result_r !== null ? `(${detail.result_r}R)` : ''}
              </span>
            </div>

            {/* Scores */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <div style={statBox}>
                <div style={labelStyle}>PROCESS</div>
                <div style={{ ...valueStyle, color: detail.process_score >= 70 ? '#4ade80' : '#ef4444' }}>
                  {detail.process_score}/100
                </div>
              </div>
              <div style={statBox}>
                <div style={labelStyle}>DISCIPLINE</div>
                <div style={{ ...valueStyle, color: detail.discipline_score >= 70 ? '#4ade80' : '#ef4444' }}>
                  {detail.discipline_score}/100
                </div>
              </div>
            </div>

            {/* Details */}
            {(detail.what_went_right || []).length > 0 && (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ ...labelStyle, color: '#4ade80', marginBottom: '2px' }}>✓ WHAT WENT RIGHT</div>
                {detail.what_went_right.map((w, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: '#b2dfdb', paddingLeft: '8px' }}>• {w}</div>
                ))}
              </div>
            )}
            {(detail.what_went_wrong || []).length > 0 && (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ ...labelStyle, color: '#ef4444', marginBottom: '2px' }}>✗ WHAT WENT WRONG</div>
                {detail.what_went_wrong.map((w, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: '#fca5a5', paddingLeft: '8px' }}>• {w}</div>
                ))}
              </div>
            )}
            {(detail.lessons || []).length > 0 && (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ ...labelStyle, color: '#facc15', marginBottom: '2px' }}>💡 LESSONS</div>
                {detail.lessons.map((l, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-data)', fontSize: '9px', color: '#fef08a', paddingLeft: '8px' }}>• {l}</div>
                ))}
              </div>
            )}

            {detail.user_notes && (
              <div style={{ marginTop: '6px', fontFamily: 'var(--font-data)', fontSize: '9px', color: '#90a4ae' }}>
                <strong>Notes:</strong> {detail.user_notes}
              </div>
            )}
            {detail.model_notes && (
              <div style={{ fontFamily: 'var(--font-data)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                {detail.model_notes}
              </div>
            )}
          </div>
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-data)', textAlign: 'center', padding: '20px' }}>
          No trade reviews yet. Close paper trades and say "Review my last AAPL trade" to get started.
        </div>
      ) : (
        reviews.map(r => (
          <div
            key={r.review_id}
            onClick={() => setDetail(r)}
            style={itemCardStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--neon-cyan)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.12)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: '10px', color: '#e0f7fa', fontWeight: 600 }}>
                {r.symbol}
              </span>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: '10px', color: outcomeColor(r.outcome), fontWeight: 700 }}>
                {r.outcome.toUpperCase()} {r.result_r !== null ? `(${r.result_r}R)` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontFamily: 'var(--font-data)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span>Process: {r.process_score}</span>
              <span>Discipline: {r.discipline_score}</span>
              <span>{r.created_at?.slice(0, 10)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────── MAIN ARCHIVE VIEW ───────────────────

export default function ArchiveManagerView({ onNotify, onSpeak, onSendToChart }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '10px',
      height: '100%',
      padding: '4px 0'
    }}>
      <ResearchPanel onNotify={onNotify} />
      <PlaybooksPanel onNotify={onNotify} />
      <ReviewsPanel onNotify={onNotify} />
    </div>
  );
}

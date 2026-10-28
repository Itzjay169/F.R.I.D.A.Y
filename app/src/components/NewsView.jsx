import React, { useState, useEffect } from 'react';
import { fetchLiveNews, summarizeNewsArticle } from '../services/deskService.js';

export default function NewsView({ onSelectArticle, selectedArticle: initialSelected, speakArticle }) {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeArticle, setActiveArticle] = useState(initialSelected || null);
  const [articleSummary, setArticleSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLiveNews()
      .then(items => {
        if (active) {
          if (Array.isArray(items)) setNewsItems(items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (initialSelected) {
      handleOpenDetail(initialSelected);
    }
  }, [initialSelected]);

  const handleOpenDetail = async (item) => {
    setActiveArticle(item);
    setSummarizing(true);
    setArticleSummary(null);

    try {
      const summary = await summarizeNewsArticle(item);
      setArticleSummary(summary);
    } catch {
      // Handled in service
    } finally {
      setSummarizing(false);
    }
  };

  const handleSpeak = (item, summary) => {
    if (speakArticle) {
      const textToSpeak = summary?.briefing ||
        `News alert from ${item.source}. ${item.headline}. Market stance is assessed as ${summary?.impact || 'neutral'}.`;
      speakArticle(textToSpeak, item);
    }
  };

  return (
    <div className="hud-panel" style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Panel Header */}
      <div className="panel-header" style={{ margin: '-16px -16px 16px -16px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="panel-title">
          <span>NEWSROOM // REAL-TIME TRADING NEWS & FILINGS</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge badge-streaming">FINNHUB LIVE FEED</span>
          <span className="badge badge-live">REAL-TIME MONITORED</span>
          <button
            onClick={() => {
              setLoading(true);
              fetchLiveNews().then(items => { setNewsItems(items); setLoading(false); });
            }}
            style={{
              background: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid var(--border-cyan)',
              color: 'var(--neon-cyan)',
              fontFamily: 'var(--font-hud)',
              fontSize: '8px',
              padding: '3px 8px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '16px', overflow: 'hidden' }}>
        
        {/* News Feed Column */}
        <div style={{ flex: activeArticle ? '1 1 55%' : '1 1 100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
          {loading && (
            <div style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-data)', padding: '30px', textAlign: 'center', letterSpacing: '1px' }}>
              SYNCHRONIZING WIRE FEEDS FROM FINNHUB...
            </div>
          )}

          {!loading && newsItems.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-data)', padding: '30px', textAlign: 'center' }}>
              No recent wire items found. Wire monitoring is standing by.
            </div>
          )}

          {newsItems.map((n) => {
            const isSelected = activeArticle?.id === n.id;
            return (
              <div
                key={n.id}
                onClick={() => handleOpenDetail(n)}
                style={{
                  background: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'rgba(0, 0, 0, 0.4)',
                  border: isSelected
                    ? '1px solid var(--neon-cyan)'
                    : n.breaking
                      ? '1px solid rgba(239, 68, 68, 0.45)'
                      : '1px solid var(--border-cyan)',
                  borderRadius: '4px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {n.breaking && (
                      <span style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid var(--neon-red)',
                        color: 'var(--neon-red)',
                        fontSize: '8.5px',
                        fontFamily: 'var(--font-hud)',
                        padding: '1px 6px',
                        borderRadius: '2px',
                        letterSpacing: '0.5px'
                      }}>
                        🚨 BREAKING
                      </span>
                    )}
                    <span style={{ color: 'var(--neon-cyan)', fontSize: '10px', fontFamily: 'var(--font-data)', fontWeight: 600 }}>
                      {n.source}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontFamily: 'var(--font-data)' }}>
                      · {n.time}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {n.tickers?.map((t) => (
                      <span key={t} style={{
                        background: 'rgba(0, 240, 255, 0.12)',
                        color: 'var(--neon-cyan)',
                        fontSize: '9px',
                        fontFamily: 'var(--font-data)',
                        padding: '0 5px',
                        borderRadius: '2px'
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{
                  fontFamily: 'var(--font-hud)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#ffffff',
                  lineHeight: 1.4
                }}>
                  {n.headline}
                </div>

                <div style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {n.summary}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '4px',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                    CLICK TO VIEW DETAILS & AI BRIEFING
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(n);
                        handleSpeak(n, null);
                      }}
                      style={{
                        background: 'rgba(0, 240, 255, 0.15)',
                        border: '1px solid var(--neon-cyan)',
                        color: 'var(--neon-cyan)',
                        fontFamily: 'var(--font-hud)',
                        fontSize: '8px',
                        padding: '2px 8px',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                    >
                      🔊 READ ALOUD
                    </button>
                    {n.url && n.url !== '#' && (
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '9px',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-data)',
                          alignSelf: 'center'
                        }}
                      >
                        ORIGINAL ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected News Detail Breakdown Column */}
        {activeArticle && (
          <div style={{
            flex: '1 1 45%',
            background: 'rgba(6, 12, 24, 0.85)',
            border: '1px solid var(--border-cyan)',
            borderRadius: '4px',
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{
                  fontSize: '8.5px',
                  fontFamily: 'var(--font-hud)',
                  color: 'var(--neon-amber)',
                  letterSpacing: '1px'
                }}>
                  NEWSROOM // WIRE INTELLIGENCE DOSSIER
                </span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--neon-cyan)', fontSize: '11px', fontFamily: 'var(--font-data)', fontWeight: 600 }}>
                    {activeArticle.source}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontFamily: 'var(--font-data)' }}>
                    · {activeArticle.time}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveArticle(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '0 4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Headline */}
            <div style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '15px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.35
            }}>
              {activeArticle.headline}
            </div>

            {/* AI Trading Desk Briefing */}
            <div style={{
              background: 'rgba(0, 240, 255, 0.05)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: '4px',
              padding: '12px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-hud)', color: 'var(--neon-cyan)', letterSpacing: '1px' }}>
                  🧠 F.R.I.D.A.Y. DESK BRIEFING
                </span>
                {articleSummary?.impact && (
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-hud)',
                    padding: '2px 8px',
                    borderRadius: '2px',
                    background: articleSummary.impact === 'Bullish'
                      ? 'rgba(0, 240, 255, 0.2)'
                      : articleSummary.impact === 'Bearish'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(234, 179, 8, 0.2)',
                    color: articleSummary.impact === 'Bullish'
                      ? 'var(--neon-cyan)'
                      : articleSummary.impact === 'Bearish'
                        ? 'var(--neon-red)'
                        : 'var(--neon-amber)',
                    border: `1px solid ${
                      articleSummary.impact === 'Bullish'
                        ? 'var(--neon-cyan)'
                        : articleSummary.impact === 'Bearish'
                          ? 'var(--neon-red)'
                          : 'var(--neon-amber)'
                    }`
                  }}>
                    {articleSummary.impact.toUpperCase()}
                  </span>
                )}
              </div>

              {summarizing ? (
                <div style={{ color: 'var(--neon-cyan)', fontSize: '11px', fontFamily: 'var(--font-data)' }}>
                  Synthesizing market intelligence with Gemini Flash...
                </div>
              ) : (
                <div style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5
                }}>
                  {articleSummary?.briefing || activeArticle.summary}
                </div>
              )}

              {articleSummary?.takeaways && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {articleSummary.takeaways.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--neon-cyan)' }}>•</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleSpeak(activeArticle, articleSummary)}
                  style={{
                    background: 'rgba(0, 240, 255, 0.2)',
                    border: '1px solid var(--neon-cyan)',
                    color: 'var(--neon-cyan)',
                    fontFamily: 'var(--font-hud)',
                    fontSize: '9px',
                    padding: '5px 12px',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    letterSpacing: '1px'
                  }}
                >
                  🔊 SPEAK BRIEFING
                </button>
                {activeArticle.url && activeArticle.url !== '#' && (
                  <a
                    href={activeArticle.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontFamily: 'var(--font-data)',
                      fontSize: '9px',
                      padding: '5px 12px',
                      borderRadius: '2px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    OPEN ORIGINAL WIRE ↗
                  </a>
                )}
              </div>
            </div>

            {/* Wire Full Content / Raw Summary */}
            <div>
              <div style={{ fontSize: '9px', fontFamily: 'var(--font-hud)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                FILED WIRE TEXT
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '10px',
                borderRadius: '4px'
              }}>
                {activeArticle.summary}
              </div>
            </div>

            {/* Related Tickers */}
            {activeArticle.tickers && activeArticle.tickers.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-hud)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  ASSOCIATED TICKERS & SECTORS
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {activeArticle.tickers.map(t => (
                    <span
                      key={t}
                      style={{
                        background: 'rgba(0, 240, 255, 0.1)',
                        border: '1px solid var(--border-cyan)',
                        color: 'var(--neon-cyan)',
                        fontSize: '9px',
                        fontFamily: 'var(--font-data)',
                        padding: '2px 8px',
                        borderRadius: '2px'
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

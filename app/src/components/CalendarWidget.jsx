import React from 'react';

export default function CalendarWidget() {
  const days = [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 9, 10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19, 20, 21],
    [22, 23, 24, 25, 26, 27, 28],
    [29, 30, null, null, null, null, null]
  ];

  return (
    <div className="hud-panel" style={{ padding: '10px 12px' }}>
      <div className="panel-header" style={{ margin: '-10px -12px 10px -12px' }}>
        <div className="panel-title">
          <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--neon-cyan)', display: 'inline-block' }} />
          CALENDAR · SEPTEMBER 2026
        </div>
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: '9px',
          color: 'var(--text-muted)'
        }}>
          26 EVENTS
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: '10px',
        padding: '2px 0 4px 0'
      }}>
        {/* Days Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '9px',
          marginBottom: '4px'
        }}>
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>

        {/* Days Grid */}
        {days.map((row, rIdx) => (
          <div
            key={rIdx}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              lineHeight: '18px'
            }}
          >
            {row.map((day, cIdx) => {
              const isToday = day === 15;
              const isFomc = day === 16;
              const isOpex = day === 18;

              return (
                <div
                  key={cIdx}
                  style={{
                    position: 'relative',
                    color: isToday ? 'var(--neon-cyan)' : day ? 'var(--text-primary)' : 'transparent',
                    fontWeight: isToday ? 700 : 400
                  }}
                >
                  {isToday && (
                    <div style={{
                      position: 'absolute',
                      top: '1px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '16px',
                      height: '16px',
                      border: '1px solid var(--neon-cyan)',
                      borderRadius: '50%',
                      boxShadow: '0 0 6px rgba(0, 240, 255, 0.6)'
                    }} />
                  )}
                  {day}
                  {(isFomc || isOpex) && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-2px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      backgroundColor: isFomc ? 'var(--neon-amber)' : 'var(--neon-magenta)'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: '1px solid var(--border-cyan)',
          fontSize: '9px',
          color: 'var(--text-muted)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--neon-amber)' }} />
            FOMC
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--neon-magenta)' }} />
            OPEX
          </span>
        </div>
      </div>
    </div>
  );
}

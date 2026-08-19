export default function StatsPanel({ mode, matchMeta, aggregateStats, mapLabel }) {
  return (
    <div className="panel-col panel-col--right">
      <div className="filter-block">
        <div className="section-label">{mode === 'match' ? 'Match' : 'Selection'}</div>

        {mode === 'match' && matchMeta && (
          <div className="match-meta">
            <div>Map: <b>{mapLabel}</b></div>
            <div>Day: <b>{matchMeta.day.replace('February_', 'Feb ')}</b></div>
            <div>Humans: <b>{matchMeta.humans}</b> · Bots: <b>{matchMeta.bots}</b></div>
            <div>Duration: <b>{matchMeta.duration}</b> ticks</div>
            <div style={{ wordBreak: 'break-all', marginTop: 6, color: 'var(--text-dim)', fontSize: 10 }}>
              {matchMeta.id}
            </div>
          </div>
        )}

        {mode === 'aggregate' && aggregateStats && (
          <div className="stat-grid">
            <div className="stat-mini">
              <div className="stat-mini__label">Matches</div>
              <div className="stat-mini__value">{aggregateStats.matchCount}</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini__label">Avg duration</div>
              <div className="stat-mini__value">{aggregateStats.avgDuration}</div>
            </div>
          </div>
        )}
      </div>

      {mode === 'aggregate' && aggregateStats && (
        <div className="filter-block">
          <div className="section-label">Events</div>
          <div className="stat-card">
            <div className="stat-card__label">Kills</div>
            <div className="stat-card__value" style={{ color: 'var(--kill)' }}>{aggregateStats.kills}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Deaths</div>
            <div className="stat-card__value" style={{ color: 'var(--death)' }}>{aggregateStats.deaths}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Storm deaths</div>
            <div className="stat-card__value" style={{ color: 'var(--storm)' }}>{aggregateStats.storms}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Loot pickups</div>
            <div className="stat-card__value" style={{ color: 'var(--loot)' }}>{aggregateStats.loots}</div>
          </div>
        </div>
      )}

      {mode === 'match' && matchMeta && (
        <div className="filter-block">
          <div className="section-label">Events</div>
          <div className="stat-grid">
            <div className="stat-mini">
              <div className="stat-mini__label">Kills</div>
              <div className="stat-mini__value" style={{ color: 'var(--kill)' }}>{matchMeta.kills}</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini__label">Deaths</div>
              <div className="stat-mini__value" style={{ color: 'var(--death)' }}>{matchMeta.deaths}</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini__label">Storm</div>
              <div className="stat-mini__value" style={{ color: 'var(--storm)' }}>{matchMeta.storms}</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini__label">Loot</div>
              <div className="stat-mini__value" style={{ color: 'var(--loot)' }}>{matchMeta.loots}</div>
            </div>
          </div>
        </div>
      )}

      <div className="filter-block">
        <div className="section-label">Legend</div>
        <div className="legend">
          <div className="legend-item"><span className="legend-swatch" style={{ background: '#4fc3e8' }} /> Human player</div>
          <div className="legend-item"><span className="legend-swatch" style={{ background: '#8b96a3' }} /> Bot</div>
          <div className="legend-item"><span className="legend-swatch square" style={{ background: '#ff5c5c', borderRadius: 2, transform: 'rotate(45deg)' }} /> Kill (diamond)</div>
          <div className="legend-item">
            <svg width="11" height="11" viewBox="0 0 11 11" style={{ flexShrink: 0 }}>
              <line x1="1.5" y1="1.5" x2="9.5" y2="9.5" stroke="#c94a5a" strokeWidth="2" />
              <line x1="9.5" y1="1.5" x2="1.5" y2="9.5" stroke="#c94a5a" strokeWidth="2" />
            </svg>
            Death (✕)
          </div>
          <div className="legend-item"><span className="legend-swatch square" style={{ background: '#9b6bff', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: 0 }} /> Storm death</div>
          <div className="legend-item"><span className="legend-swatch square" style={{ background: '#f2c744' }} /> Loot pickup</div>
        </div>
      </div>
    </div>
  )
}

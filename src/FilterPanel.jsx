const MAP_ORDER = ['AmbroseValley', 'GrandRift', 'Lockdown']
const MAP_LABEL = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
}

function Toggle({ checked, onChange, label, swatch }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" />
      {label}
      {swatch && <span className="toggle-swatch" style={{ background: swatch }} />}
    </label>
  )
}

export default function FilterPanel({
  manifest,
  selectedMap,
  onSelectMap,
  mapMatchCounts,
  day,
  onSelectDay,
  dayOptions,
  matches,
  selectedMatchId,
  onSelectMatch,
  layers,
  onLayersChange,
}) {
  return (
    <div className="panel-col">
      <div className="filter-block">
        <div className="section-label">Map</div>
        <div className="map-tabs">
          {MAP_ORDER.map((m) => (
            <button
              key={m}
              className={`map-tab ${selectedMap === m ? 'active' : ''}`}
              onClick={() => onSelectMap(m)}
            >
              <span>{MAP_LABEL[m]}</span>
              <span className="map-tab__count">{mapMatchCounts[m] ?? '—'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="filter-block">
        <div className="section-label">Date</div>
        <div className="select-wrap">
          <select value={day} onChange={(e) => onSelectDay(e.target.value)}>
            <option value="all">All days ({dayOptions.reduce((a, d) => a + d.count, 0)} matches)</option>
            {dayOptions.map((d) => (
              <option key={d.day} value={d.day}>
                {d.day.replace('February_', 'Feb ')} ({d.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-block">
        <div className="section-label">Match</div>
        <div className="match-list">
          <div
            className={`aggregate-row ${!selectedMatchId ? 'active' : ''}`}
            onClick={() => onSelectMatch(null)}
          >
            <span>▦ All matches (heatmap)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{matches.length}</span>
          </div>
          {matches.map((m) => (
            <div
              key={m.id}
              className={`match-row ${selectedMatchId === m.id ? 'active' : ''}`}
              onClick={() => onSelectMatch(m.id)}
              title={m.id}
            >
              <span className="match-row__id">{m.id.slice(0, 8)}… · {m.humans}H/{m.bots}B</span>
              <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {m.kills + m.deaths > 0 && (
                  <span title={`${m.kills} kills, ${m.deaths} deaths`} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--kill)', display: 'inline-block' }} />
                )}
                {m.storms > 0 && (
                  <span title={`${m.storms} storm deaths`} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--storm)', display: 'inline-block' }} />
                )}
              </span>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="match-row" style={{ cursor: 'default' }}>
              No matches for this filter
            </div>
          )}
        </div>
      </div>

      <div className="filter-block">
        <div className="section-label">Layers</div>
        <Toggle
          checked={layers.showHumans}
          onChange={(v) => onLayersChange({ ...layers, showHumans: v })}
          label="Human players"
          swatch="#4fc3e8"
        />
        <Toggle
          checked={layers.showBots}
          onChange={(v) => onLayersChange({ ...layers, showBots: v })}
          label="Bots"
          swatch="#8b96a3"
        />
        {selectedMatchId && (
          <Toggle
            checked={layers.showPaths}
            onChange={(v) => onLayersChange({ ...layers, showPaths: v })}
            label="Movement paths"
          />
        )}
      </div>

      <div className="filter-block">
        <div className="section-label">Heatmap</div>
        <div className="select-wrap">
          <select
            value={layers.heatmap}
            onChange={(e) => onLayersChange({ ...layers, heatmap: e.target.value })}
          >
            <option value="off">Off</option>
            <option value="traffic">Traffic density</option>
            <option value="kills">Kill zones</option>
            <option value="deaths">Death zones</option>
          </select>
        </div>
      </div>
    </div>
  )
}

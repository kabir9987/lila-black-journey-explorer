import { useEffect, useMemo, useState, useCallback } from 'react'
import FilterPanel from './FilterPanel.jsx'
import StatsPanel from './StatsPanel.jsx'
import MapCanvas from './MapCanvas.jsx'
import Timeline from './Timeline.jsx'

const MAP_LABEL = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
}

export default function App() {
  const [manifest, setManifest] = useState(null)
  const [selectedMap, setSelectedMap] = useState('AmbroseValley')
  const [mapDataCache, setMapDataCache] = useState({})
  const [day, setDay] = useState('all')
  const [selectedMatchId, setSelectedMatchId] = useState(null)
  const [layers, setLayers] = useState({
    showHumans: true,
    showBots: true,
    showPaths: true,
    heatmap: 'off',
  })
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  // Load manifest once
  useEffect(() => {
    fetch('/data/manifest.json')
      .then((r) => r.json())
      .then((m) => {
        setManifest(m)
        const counts = {}
        m.matches.forEach((x) => (counts[x.map] = (counts[x.map] || 0) + 1))
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
        if (best) setSelectedMap(best[0])
      })
  }, [])

  // Lazily load per-map data bundle
  useEffect(() => {
    if (!manifest) return
    if (mapDataCache[selectedMap]) return
    const cfg = manifest.maps[selectedMap]
    fetch(cfg.dataFile)
      .then((r) => r.json())
      .then((data) => {
        setMapDataCache((prev) => ({ ...prev, [selectedMap]: data }))
      })
  }, [manifest, selectedMap, mapDataCache])

  // Reset selection when map changes
  const handleSelectMap = useCallback((m) => {
    setSelectedMap(m)
    setDay('all')
    setSelectedMatchId(null)
    setCurrentTime(0)
    setIsPlaying(false)
  }, [])

  const handleSelectDay = useCallback((d) => {
    setDay(d)
    setSelectedMatchId(null)
    setCurrentTime(0)
    setIsPlaying(false)
  }, [])

  const handleSelectMatch = useCallback((id) => {
    setSelectedMatchId(id)
    setCurrentTime(0)
    setIsPlaying(false)
  }, [])

  const mapMatchCounts = useMemo(() => {
    if (!manifest) return {}
    const counts = {}
    manifest.matches.forEach((x) => (counts[x.map] = (counts[x.map] || 0) + 1))
    return counts
  }, [manifest])

  const matchesForMap = useMemo(() => {
    if (!manifest) return []
    return manifest.matches.filter((x) => x.map === selectedMap)
  }, [manifest, selectedMap])

  const dayOptions = useMemo(() => {
    const byDay = {}
    matchesForMap.forEach((x) => (byDay[x.day] = (byDay[x.day] || 0) + 1))
    return Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => ({ day, count }))
  }, [matchesForMap])

  const filteredMatches = useMemo(() => {
    if (day === 'all') return matchesForMap
    return matchesForMap.filter((x) => x.day === day)
  }, [matchesForMap, day])

  const mapBundle = mapDataCache[selectedMap]
  const mapCfg = manifest?.maps[selectedMap]
  const mode = selectedMatchId ? 'match' : 'aggregate'

  const matchData = mode === 'match' && mapBundle ? mapBundle.matches[selectedMatchId] : null
  const matchMetaRaw = mode === 'match' ? manifest?.matches.find((x) => x.id === selectedMatchId) : null
  const matchMeta = matchMetaRaw && matchData ? { ...matchMetaRaw } : null

  const aggregatePoints = useMemo(() => {
    if (mode !== 'aggregate' || !mapBundle || !mapCfg) return null
    const ids = new Set(filteredMatches.map((m) => m.id))
    const out = { traffic: [], kills: [], deaths: [], storms: [], loots: [] }
    for (const mid in mapBundle.matches) {
      if (!ids.has(mid)) continue
      const match = mapBundle.matches[mid]
      for (const uid in match.players) {
        const p = match.players[uid]
        if (p.bot && !layers.showBots) continue
        if (!p.bot && !layers.showHumans) continue
        p.pts.forEach(([, x, z]) => out.traffic.push([x, z]))
        p.evts.forEach(([, x, z, type]) => {
          if (type === 'kill') out.kills.push([x, z])
          else if (type === 'death') out.deaths.push([x, z])
          else if (type === 'storm_death') out.storms.push([x, z])
          else if (type === 'loot') out.loots.push([x, z])
        })
      }
    }
    return out
  }, [mode, mapBundle, mapCfg, filteredMatches, layers.showBots, layers.showHumans])

  const aggregateStats = useMemo(() => {
    if (mode !== 'aggregate') return null
    const n = filteredMatches.length
    const sum = (k) => filteredMatches.reduce((a, m) => a + m[k], 0)
    return {
      matchCount: n,
      avgDuration: n ? Math.round(sum('duration') / n) : 0,
      kills: sum('kills'),
      deaths: sum('deaths'),
      storms: sum('storms'),
      loots: sum('loots'),
    }
  }, [mode, filteredMatches])

  if (!manifest) {
    return (
      <div className="app">
        <div className="map-loading" style={{ padding: 60 }}>INITIALIZING TELEMETRY FEED…</div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__mark"><span className="dot" /> LILA BLACK</div>
        <div className="topbar__sub">PLAYER JOURNEY EXPLORER</div>
        <div className="topbar__spacer" />
        <div className="topbar__stat">
          <div><b>{manifest.matches.length}</b> matches indexed</div>
          <div>Feb 10 – Feb 14, 2026</div>
        </div>
      </header>

      <div className="layout">
        <FilterPanel
          manifest={manifest}
          selectedMap={selectedMap}
          onSelectMap={handleSelectMap}
          mapMatchCounts={mapMatchCounts}
          day={day}
          onSelectDay={handleSelectDay}
          dayOptions={dayOptions}
          matches={filteredMatches}
          selectedMatchId={selectedMatchId}
          onSelectMatch={handleSelectMatch}
          layers={layers}
          onLayersChange={setLayers}
        />

        <div className="center-col">
          {mapCfg && (
            <MapCanvas
              mapCfg={mapCfg}
              mode={mode}
              matchData={matchData}
              aggregatePoints={aggregatePoints}
              layers={layers}
              currentTime={currentTime}
            />
          )}
          <Timeline
            duration={matchData ? matchData.endTs : 0}
            currentTime={currentTime}
            isPlaying={isPlaying}
            speed={speed}
            onSeek={setCurrentTime}
            onTogglePlay={setIsPlaying}
            onSpeedChange={setSpeed}
            disabled={mode !== 'match' || !matchData}
          />
          {mode === 'aggregate' && (
            <div className="empty-hint">
              Select a match from the left panel to scrub its timeline and watch the round unfold.
              Currently showing an aggregate view across <b>{filteredMatches.length}</b> matches.
            </div>
          )}
        </div>

        <StatsPanel
          mode={mode}
          matchMeta={matchMeta}
          aggregateStats={aggregateStats}
          mapLabel={MAP_LABEL[selectedMap]}
        />
      </div>
    </div>
  )
}

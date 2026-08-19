import { useEffect, useRef, useState } from 'react'
import { worldToPixel, EVENT_COLORS, renderHeatmap } from './mapMath.js'

const MARKER_R = 4.2

export default function MapCanvas({
  mapCfg,
  mode,          // 'match' | 'aggregate' | 'empty'
  matchData,     // for 'match' mode: { players: {...} }
  aggregatePoints, // for 'aggregate' mode: { traffic: [[x,z]], kills:[[x,z]], deaths:[[x,z]], storms:[[x,z]] }
  layers,        // { showHumans, showBots, showPaths, heatmap: 'off'|'traffic'|'kills'|'deaths' }
  currentTime,   // ms, for match playback scrubbing
}) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const heatmapCacheRef = useRef({ key: null, canvas: null })
  const markersRef = useRef([]) // for hover picking
  const [tooltip, setTooltip] = useState(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Load / swap minimap image
  useEffect(() => {
    setImgLoaded(false)
    const img = new Image()
    img.src = mapCfg.image
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
  }, [mapCfg.image])

  useEffect(() => {
    if (!imgLoaded) return
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = mapCfg
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(imgRef.current, 0, 0, width, height)

    markersRef.current = []

    // ---- Heatmap layer ----
    if (layers.heatmap !== 'off') {
      let srcPoints = []
      if (mode === 'match' && matchData) {
        srcPoints = collectMatchPoints(matchData, layers.heatmap, layers, mapCfg)
      } else if (mode === 'aggregate' && aggregatePoints) {
        srcPoints = (aggregatePoints[layers.heatmap] || []).map(([x, z]) =>
          worldToPixel(mapCfg, x, z)
        )
      }
      const cacheKey = `${mode}-${layers.heatmap}-${srcPoints.length}-${mapCfg.image}`
      let heat
      if (heatmapCacheRef.current.key === cacheKey) {
        heat = heatmapCacheRef.current.canvas
      } else {
        heat = renderHeatmap(srcPoints, width, height)
        heatmapCacheRef.current = { key: cacheKey, canvas: heat }
      }
      ctx.globalAlpha = 0.85
      ctx.drawImage(heat, 0, 0)
      ctx.globalAlpha = 1
    }

    // ---- Match mode: paths + markers ----
    if (mode === 'match' && matchData) {
      const players = matchData.players
      const t = currentTime

      for (const uid in players) {
        const p = players[uid]
        if (p.bot && !layers.showBots) continue
        if (!p.bot && !layers.showHumans) continue

        const pathPts = p.pts.filter((pt) => pt[0] <= t)
        if (layers.showPaths && pathPts.length > 1) {
          ctx.beginPath()
          ctx.strokeStyle = p.bot ? 'rgba(139,150,163,0.55)' : 'rgba(79,195,232,0.85)'
          ctx.lineWidth = p.bot ? 1.1 : 1.6
          for (let i = 0; i < pathPts.length; i++) {
            const [, x, z] = pathPts[i]
            const [px, py] = worldToPixel(mapCfg, x, z)
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.stroke()
        }

        // current position dot
        if (pathPts.length > 0) {
          const [, x, z] = pathPts[pathPts.length - 1]
          const [px, py] = worldToPixel(mapCfg, x, z)
          ctx.beginPath()
          ctx.fillStyle = p.bot ? '#8b96a3' : '#4fc3e8'
          ctx.arc(px, py, p.bot ? 3 : 4, 0, Math.PI * 2)
          ctx.fill()
          if (!p.bot) {
            ctx.strokeStyle = 'rgba(79,195,232,0.5)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(px, py, 7, 0, Math.PI * 2)
            ctx.stroke()
          }
          markersRef.current.push({ px, py, r: 8, label: `${p.bot ? 'Bot' : 'Player'} ${uid}` })
        }

        // event markers up to current time
        for (const ev of p.evts) {
          const [et, x, z, type] = ev
          if (et > t) continue
          const [px, py] = worldToPixel(mapCfg, x, z)
          drawEventMarker(ctx, px, py, type)
          markersRef.current.push({ px, py, r: 6, label: `${labelForEvent(type)} — ${uid} @ t=${et}` })
        }
      }
    }

    // ---- Aggregate mode: event markers (no paths, no playback) ----
    if (mode === 'aggregate' && aggregatePoints) {
      if (layers.showKillMarkers !== false) {
        ;(aggregatePoints.kills || []).forEach(([x, z]) => {
          const [px, py] = worldToPixel(mapCfg, x, z)
          drawEventMarker(ctx, px, py, 'kill', 2.4)
        })
      }
      if (layers.showDeathMarkers !== false) {
        ;(aggregatePoints.deaths || []).forEach(([x, z]) => {
          const [px, py] = worldToPixel(mapCfg, x, z)
          drawEventMarker(ctx, px, py, 'death', 2.4)
        })
      }
      if (layers.showStormMarkers !== false) {
        ;(aggregatePoints.storms || []).forEach(([x, z]) => {
          const [px, py] = worldToPixel(mapCfg, x, z)
          drawEventMarker(ctx, px, py, 'storm_death', 2.6)
        })
      }
      if (layers.showLootMarkers !== false) {
        ;(aggregatePoints.loots || []).forEach(([x, z]) => {
          const [px, py] = worldToPixel(mapCfg, x, z)
          drawEventMarker(ctx, px, py, 'loot', 2)
        })
      }
    }
  }, [imgLoaded, mode, matchData, aggregatePoints, layers, currentTime, mapCfg])

  function handleMouseMove(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY

    let hit = null
    for (const m of markersRef.current) {
      const d = Math.hypot(m.px - mx, m.py - my)
      if (d <= m.r + 3) {
        hit = m
        break
      }
    }
    if (hit) {
      setTooltip({ x: e.clientX, y: e.clientY, label: hit.label })
    } else {
      setTooltip(null)
    }
  }

  return (
    <div className="map-frame">
      {!imgLoaded && <div className="map-loading">LOADING MINIMAP…</div>}
      <div className="map-frame__inner" style={{ display: imgLoaded ? 'block' : 'none' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        />
        <div className="storm-edge" />
      </div>
      {tooltip && (
        <div className="tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          {tooltip.label}
        </div>
      )}
    </div>
  )
}

function collectMatchPoints(matchData, kind, layers, mapCfg) {
  const out = []
  for (const uid in matchData.players) {
    const p = matchData.players[uid]
    if (p.bot && !layers.showBots) continue
    if (!p.bot && !layers.showHumans) continue
    if (kind === 'traffic') {
      p.pts.forEach(([, x, z]) => out.push([x, z]))
    } else {
      const wantType = kind === 'kills' ? 'kill' : kind === 'deaths' ? 'death' : kind
      p.evts.forEach(([, x, z, type]) => {
        if (type === wantType) out.push([x, z])
      })
    }
  }
  return out.map(([x, z]) => worldToPixel(mapCfg, x, z))
}

function drawEventMarker(ctx, px, py, type, scale = 1) {
  const color = EVENT_COLORS[type] || '#fff'
  ctx.save()
  ctx.translate(px, py)
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 1

  const r = MARKER_R * scale
  if (type === 'kill') {
    // diamond
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(r, 0)
    ctx.lineTo(0, r)
    ctx.lineTo(-r, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (type === 'death') {
    // X
    ctx.strokeStyle = color
    ctx.lineWidth = 1.8 * scale
    ctx.beginPath()
    ctx.moveTo(-r, -r)
    ctx.lineTo(r, r)
    ctx.moveTo(r, -r)
    ctx.lineTo(-r, r)
    ctx.stroke()
  } else if (type === 'storm_death') {
    // triangle
    ctx.beginPath()
    ctx.moveTo(0, -r * 1.1)
    ctx.lineTo(r, r * 0.8)
    ctx.lineTo(-r, r * 0.8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (type === 'loot') {
    // small square
    ctx.beginPath()
    ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

function labelForEvent(type) {
  if (type === 'kill') return 'Kill'
  if (type === 'death') return 'Death'
  if (type === 'storm_death') return 'Storm death'
  if (type === 'loot') return 'Loot'
  return type
}

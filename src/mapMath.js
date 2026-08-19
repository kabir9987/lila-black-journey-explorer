// World (x, z) -> minimap pixel space, per the README's documented formula:
//   u = (x - originX) / scale
//   v = (z - originZ) / scale
//   px = u * width
//   py = (1 - v) * height   (image origin is top-left, so v is flipped)
//
// Crucially, width/height here are the DISPLAYED minimap image's actual
// pixel dimensions -- not a hardcoded constant. The three source images
// shipped at wildly different native resolutions (4320x4320, 2160x2158,
// 9000x9000), not the 1024x1024 the brief's README describes, and
// GrandRift isn't even square. We resize each to a web-friendly size while
// preserving its native aspect ratio, then read the *rendered* width/height
// straight out of the manifest so the projection is always correct for
// whatever we actually draw.
export function worldToPixel(mapCfg, x, z) {
  const u = (x - mapCfg.originX) / mapCfg.scale
  const v = (z - mapCfg.originZ) / mapCfg.scale
  return [u * mapCfg.width, (1 - v) * mapCfg.height]
}

export const EVENT_COLORS = {
  kill: '#ff5c5c',
  death: '#c94a5a',
  storm_death: '#9b6bff',
  loot: '#f2c744',
}

// Simple additive-blob heatmap, computed once per selection change (not per
// frame). Draws low-alpha radial blobs with 'lighter' compositing so density
// accumulates in the alpha channel, then remaps alpha -> a blue/green/amber/red
// ramp. For very large point sets we stride-sample down to a cap; at this
// data's density that preserves the shape of the distribution while keeping
// the draw call count reasonable.
export function renderHeatmap(points, width, height, radius = 22) {
  const cap = 18000
  let pts = points
  if (pts.length > cap) {
    const stride = Math.ceil(pts.length / cap)
    pts = pts.filter((_, i) => i % stride === 0)
  }

  const blob = document.createElement('canvas')
  blob.width = width
  blob.height = height
  const bctx = blob.getContext('2d')
  bctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < pts.length; i++) {
    const [px, py] = pts[i]
    const g = bctx.createRadialGradient(px, py, 0, px, py, radius)
    g.addColorStop(0, 'rgba(255,255,255,0.10)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    bctx.fillStyle = g
    bctx.beginPath()
    bctx.arc(px, py, radius, 0, Math.PI * 2)
    bctx.fill()
  }

  const img = bctx.getImageData(0, 0, width, height)
  const data = img.data

  // Color ramp stops (t: 0..1) -> [r,g,b]
  const stops = [
    [0.0, [15, 20, 40]],
    [0.15, [40, 90, 200]],
    [0.35, [40, 190, 190]],
    [0.55, [90, 210, 90]],
    [0.75, [240, 200, 60]],
    [1.0, [255, 70, 70]],
  ]
  function ramp(t) {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1]
        const [t1, c1] = stops[i]
        const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
        return [
          c0[0] + (c1[0] - c0[0]) * f,
          c0[1] + (c1[1] - c0[1]) * f,
          c0[2] + (c1[2] - c0[2]) * f,
        ]
      }
    }
    return stops[stops.length - 1][1]
  }

  for (let p = 0; p < data.length; p += 4) {
    const a = data[p + 3]
    if (a === 0) continue
    const t = Math.min(1, a / 130)
    const [r, g, b] = ramp(t)
    data[p] = r
    data[p + 1] = g
    data[p + 2] = b
    data[p + 3] = Math.min(230, a * 2.1)
  }
  bctx.putImageData(img, 0, 0)
  return blob
}

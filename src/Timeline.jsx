import { useEffect, useRef } from 'react'

export default function Timeline({ duration, currentTime, isPlaying, speed, onSeek, onTogglePlay, onSpeedChange, disabled }) {
  const rafRef = useRef(null)
  const lastTickRef = useRef(null)

  useEffect(() => {
    if (!isPlaying || disabled) return
    lastTickRef.current = performance.now()

    function tick(now) {
      const dt = now - lastTickRef.current
      lastTickRef.current = now
      // Playback maps the match's relative tick-range onto real seconds:
      // the underlying `ts` values in this dataset span well under a
      // second per match (a compressed/synthetic time index rather than
      // true wall-clock ms -- see ARCHITECTURE.md), so we scale by `speed`
      // to make scrubbing feel natural instead of replaying at "real" speed.
      const next = currentTime + dt * speed
      if (next >= duration) {
        onSeek(duration)
        onTogglePlay(false)
      } else {
        onSeek(next)
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, disabled])

  function fmt(ms) {
    return `${Math.round(ms)} / ${Math.round(duration)}`
  }

  return (
    <div className={`timeline ${disabled ? 'disabled' : ''}`}>
      <button
        className="play-btn"
        onClick={() => onTogglePlay(!isPlaying)}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        disabled={disabled}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={1}
        value={Math.min(currentTime, duration || 1)}
        onChange={(e) => onSeek(Number(e.target.value))}
        disabled={disabled}
      />
      <div className="timeline__time">{fmt(currentTime)}</div>
      <div className="speed-select">
        <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))} disabled={disabled}>
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>
    </div>
  )
}

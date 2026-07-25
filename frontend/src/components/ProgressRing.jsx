import { useEffect, useRef, useState } from 'react'
import './ProgressRing.css'

/**
 * Animated progress ring with thicker stroke, subtle glow at arc tip, and
 * synchronized count-up number animation.
 */
export default function ProgressRing({ percent, amount, goal, loading = false, size = 'lg' }) {
  const hasGoal = goal != null && percent != null
  const effectivePercent = hasGoal ? percent : 0
  const [animatedPercent, setAnimatedPercent] = useState(0)
  const prevPercent = useRef(0)
  const animFrame = useRef(null)

  const dimensions = size === 'lg' ? { svgSize: 260, strokeWidth: 18 } : { svgSize: 130, strokeWidth: 10 }
  const { svgSize, strokeWidth } = dimensions
  const radius = (svgSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = svgSize / 2

  useEffect(() => {
    if (loading) return

    const start = prevPercent.current
    const end = Math.min(effectivePercent, 100)
    const duration = 900
    const startTime = performance.now()

    function animate(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (end - start) * eased
      setAnimatedPercent(current)

      if (progress < 1) {
        animFrame.current = requestAnimationFrame(animate)
      } else {
        prevPercent.current = end
      }
    }

    animFrame.current = requestAnimationFrame(animate)
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current) }
  }, [effectivePercent, loading])

  const strokeDashoffset = circumference - (animatedPercent / 100) * circumference

  // Glow filter ID
  const glowId = `ring-glow-${size}`

  return (
    <div className={`progress-ring progress-ring--${size} ${loading ? 'progress-ring--loading' : ''}`}>
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="progress-ring__svg"
        role="progressbar"
        aria-valuenow={Math.round(animatedPercent)}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label={`Progreso: ${Math.round(animatedPercent)}%`}
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="var(--color-surface)" strokeWidth={strokeWidth}
          opacity="0.6"
        />

        {/* Progress arc with glow */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="var(--color-accent)" strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="progress-ring__arc"
          transform={`rotate(-90 ${center} ${center})`}
          filter={animatedPercent > 0 ? `url(#${glowId})` : undefined}
        />
      </svg>

      <div className="progress-ring__content">
        {loading ? (
          <div className="progress-ring__loader">
            <div className="progress-ring__pulse" />
          </div>
        ) : hasGoal ? (
          <>
            <span className="progress-ring__percent mono">
              {Math.round(animatedPercent)}%
            </span>
            {amount && (
              <span className="progress-ring__amount mono">{formatMoney(amount)}</span>
            )}
            {goal && (
              <span className="progress-ring__goal">
                de <span className="mono">{formatMoney(goal)}</span>
              </span>
            )}
          </>
        ) : (
          <>
            <span className="progress-ring__amount mono" style={{ fontSize: size === 'lg' ? '1.5rem' : '0.9rem' }}>
              {amount ? formatMoney(amount) : '$0'}
            </span>
            <span className="progress-ring__goal">Acumulado total</span>
          </>
        )}
      </div>
    </div>
  )
}

function formatMoney(value) {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(num)
}

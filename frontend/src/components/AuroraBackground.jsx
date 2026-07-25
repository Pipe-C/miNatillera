import './AuroraBackground.css'

/**
 * Ambient aurora/mesh-gradient background.
 * 3 large blurred color blobs drifting slowly in different paths.
 * Purely decorative — lives at App level, never remounts.
 *
 * Performance:
 * - Static filter:blur() (not animated)
 * - Only transform animated (translate via @keyframes)
 * - will-change:transform on each blob
 * - prefers-reduced-motion: static, no drift
 */
export default function AuroraBackground({ variant = 'home' }) {
  return (
    <div className={`aurora aurora--${variant}`} aria-hidden="true">
      <div className="aurora__blob aurora__blob--1" />
      <div className="aurora__blob aurora__blob--2" />
      <div className="aurora__blob aurora__blob--3" />
    </div>
  )
}

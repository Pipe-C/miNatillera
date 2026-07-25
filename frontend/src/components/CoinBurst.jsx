import { useEffect, useState } from 'react'

/**
 * Coin burst micro-interaction.
 * Renders a small coin SVG that arcs up and fades out at the click position.
 * Respects prefers-reduced-motion (shows a brief color flash instead).
 */
export default function CoinBurst({ x, y, onComplete }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 500)
    return () => clearTimeout(timer)
  }, [onComplete])

  if (!visible) return null

  // Check reduced motion preference
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReduced) {
    return (
      <div style={{
        position: 'fixed', left: x - 12, top: y - 12, width: 24, height: 24,
        borderRadius: '50%', background: 'var(--color-accent)', opacity: 0.4,
        pointerEvents: 'none', zIndex: 9999,
        animation: 'coinFlash 0.3s ease-out forwards'
      }} />
    )
  }

  return (
    <div style={{
      position: 'fixed', left: x - 12, top: y - 12,
      pointerEvents: 'none', zIndex: 9999,
      animation: 'coinArc 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#FBBF77" />
        <circle cx="12" cy="12" r="8" fill="#E8A54A" />
        <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0D0B14">$</text>
      </svg>
    </div>
  )
}

/**
 * Hook to manage coin burst state.
 * Returns [coins, triggerCoin] — call triggerCoin(event) on primary action clicks.
 */
export function useCoinBurst() {
  const [coins, setCoins] = useState([])

  function triggerCoin(e) {
    const id = Date.now() + Math.random()
    const rect = e?.currentTarget?.getBoundingClientRect?.()
    const x = rect ? rect.left + rect.width / 2 : e?.clientX || 0
    const y = rect ? rect.top + rect.height / 2 : e?.clientY || 0
    setCoins(prev => [...prev, { id, x, y }])
  }

  function removeCoin(id) {
    setCoins(prev => prev.filter(c => c.id !== id))
  }

  return [coins, triggerCoin, removeCoin]
}

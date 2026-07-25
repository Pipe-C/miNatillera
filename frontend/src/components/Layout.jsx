import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Home, Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

export default function Layout({ children }) {
  const location = useLocation()
  const { theme, toggle } = useTheme()
  const isDashboard = location.pathname.includes('/group/')

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        {isDashboard ? (
          /* Dashboard: logo is decorative only, not a link */
          <span className="header-brand header-brand--decorative">
            <Home size={18} strokeWidth={1.8} color="#7C5CFC" />
            miNatillera
          </span>
        ) : (
          /* Other views: logo navigates home */
          <a href="/" className="header-brand">
            <Home size={18} strokeWidth={1.8} color="#7C5CFC" />
            miNatillera
          </a>
        )}
        <div className="flex items-center gap-3">
          {isDashboard && <LiveClock />}
          <button
            onClick={toggle}
            className="p-2 rounded-lg transition-all duration-200 hover:bg-surface"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Cambiar tema"
            title="Cambiar tema"
          >
            <div className="theme-toggle-icon">
              {theme === 'dark' ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
            </div>
          </button>
        </div>
      </header>
      <main className={`flex-1 flex flex-col items-center px-4 py-10 sm:py-16 w-full mx-auto ${isDashboard ? 'max-w-4xl' : 'max-w-xl'}`}>
        {children}
      </main>
    </div>
  )
}

function LiveClock() {
  const [time, setTime] = useState(formatTime())

  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 30000)
    return () => clearInterval(interval)
  }, [])

  return <span className="micro-label" style={{ fontSize: '0.6rem', letterSpacing: '0.08em' }}>{time}</span>
}

function formatTime() {
  const now = new Date()
  const day = now.toLocaleDateString('es-CO', { weekday: 'short' })
  const date = now.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  const hours = String(now.getHours()).padStart(2, '0')
  const mins = String(now.getMinutes()).padStart(2, '0')
  return `${day} ${date} · ${hours}:${mins}`
}

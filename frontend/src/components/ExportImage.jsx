import { useRef, useState } from 'react'
import { Image, Check, AlertCircle } from 'lucide-react'

/**
 * Generates a shareable JPG summary card of the group's progress.
 * Uses html-to-image (dynamic import) on a hidden dedicated card component.
 */
export default function ExportImage({ progress, disabled }) {
  const cardRef = useRef(null)
  const [state, setState] = useState('idle') // idle | generating | success | error

  async function handleExport() {
    if (disabled) return
    setState('generating')
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        backgroundColor: '#0D0B14',
        pixelRatio: 2
      })

      // Always download directly — no share dialog
      const link = document.createElement('a')
      link.download = sanitizeFilename(progress.name) + '-dashboard.png'
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setState('success')
      setTimeout(() => setState('idle'), 2000)
    } catch (err) {
      console.error('Image export failed:', err)
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const percent = progress?.goalAmount ? (progress?.progressPercent || 0) : 0
  const hasGoal = !!progress?.goalAmount

  return (
    <>
      <button className="btn btn--secondary" onClick={handleExport} disabled={state === 'generating' || disabled} title={disabled ? 'Registrá al menos un aporte para exportar' : ''}>
        {state === 'generating' && 'Generando...'}
        {state === 'success' && <><Check size={16} /> Descargado</>}
        {state === 'error' && <><AlertCircle size={16} /> Error</>}
        {state === 'idle' && <><Image size={16} /> Descargar imagen</>}
      </button>

      {/* Hidden card for capture — infographic style */}
      <div style={{ position: 'fixed', left: 0, top: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
        <div ref={cardRef} style={{
          width: '440px', padding: '36px',
          background: '#0D0B14', color: '#F5F3F7',
          fontFamily: "'Geist Sans', system-ui, sans-serif",
          display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#665E73', marginBottom: 6 }}>Resumen de natillera</div>
            <div style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em' }}>{progress?.name}</div>
          </div>

          {/* Progress ring */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="60" fill="none" stroke="#1C1826" strokeWidth="10" />
              <circle cx="70" cy="70" r="60" fill="none" stroke="#7C5CFC" strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 60}`}
                strokeDashoffset={`${2 * Math.PI * 60 * (1 - percent / 100)}`}
                strokeLinecap="round" transform="rotate(-90 70 70)" />
              <text x="70" y="75" textAnchor="middle" fontSize="24" fontWeight="700" fill="#F5F3F7">
                {hasGoal ? `${percent}%` : formatMoney(progress?.accumulatedAmount)}
              </text>
            </svg>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <StatBlock label="Acumulado" value={formatMoney(progress?.accumulatedAmount)} />
            {hasGoal && <StatBlock label="Meta" value={formatMoney(progress?.goalAmount)} />}
            {hasGoal && <StatBlock label="Faltante" value={formatMoney(progress?.remainingAmount)} />}
            <StatBlock label="Miembros" value={String(progress?.memberCount || 0)} />
            <StatBlock label="Fecha objetivo" value={progress?.targetDate || '—'} />
            <StatBlock label="Estado" value={progress?.status === 'COMPLETADO' ? 'Completado' : 'Activo'} />
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2A2435', paddingTop: 12 }}>
            <span style={{ fontSize: '10px', color: '#665E73' }}>miNatillera</span>
            <span style={{ fontSize: '10px', color: '#665E73' }}>{new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </>
  )
}

function StatBlock({ label, value }) {
  return (
    <div style={{ background: '#15121E', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#F5F3F7', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#665E73' }}>{label}</div>
    </div>
  )
}

function formatMoney(value) {
  const num = parseFloat(value)
  if (isNaN(num)) return value || '$0'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
}

function sanitizeFilename(name) {
  return (name || 'grupo').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 50)
}

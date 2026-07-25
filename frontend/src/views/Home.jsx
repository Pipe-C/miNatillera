import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Download, Copy } from 'lucide-react'
import MoneyInput from '../components/MoneyInput'
import DatePicker from '../components/DatePicker'
import {
  createGroup, lookupGroupByCode,
  setInviteCode, setStoredGroupId, setCreatorToken,
  getRecentGroups, addRecentGroup, verifyManager, removeRecentGroup
} from '../lib/api'

export default function Home() {
  const [tab, setTab] = useState('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createdGroup, setCreatedGroup] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Check if redirected from revocation
  const [revokedMsg, setRevokedMsg] = useState(location.state?.revoked || false)

  useEffect(() => {
    if (revokedMsg) setTimeout(() => setRevokedMsg(false), 6000)
  }, [revokedMsg])

  return (
    <div className="w-full flex flex-col items-center gap-12 animate-fade-up">
      {/* Revocation notice */}
      {revokedMsg && (
        <div className="w-full p-3 rounded-lg border border-warm/30 bg-[rgba(251,191,119,0.08)] text-center" style={{ color: 'var(--color-text-primary)' }}>
          <p className="text-sm font-medium">El administrador revocó tu acceso como co-gestor.</p>
        </div>
      )}

      <div className="text-center space-y-3 pt-4">
        <h1 className="tracking-tight leading-[1.1]" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)' }}>
          <span className="font-bold">Comienza tu </span>
          <span className="editorial-serif text-accent font-normal">natillera</span>
        </h1>
        <p className="text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Crea un grupo nuevo o únete a uno existente.
        </p>
      </div>

      {createdGroup ? (
        <GroupCreatedCard group={createdGroup} />
      ) : (
        <>
          {/* Recent groups — persistent sessions */}
          <RecentGroupsSection />

          {/* Tabs */}
          <div className="flex w-full rounded-lg bg-elevated border border-border overflow-hidden">
            <button
              role="tab"
              aria-selected={tab === 'create'}
              onClick={() => { setTab('create'); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors duration-150 ${
                tab === 'create' ? 'bg-surface text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Crear grupo
            </button>
            <button
              role="tab"
              aria-selected={tab === 'join'}
              onClick={() => { setTab('join'); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors duration-150 ${
                tab === 'join' ? 'bg-surface text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Unirse
            </button>
          </div>

          {error && <p className="text-sm text-warm text-center" role="alert">{error}</p>}

          {tab === 'create' ? (
            <CreateForm loading={loading} onSubmit={async (data) => {
              setLoading(true); setError(null)
              try {
                const group = await createGroup(data)
                setInviteCode(group.inviteCode)
                setStoredGroupId(group.groupId)
                if (group.creatorToken) setCreatorToken(group.groupId, group.creatorToken)
                addRecentGroup(group.groupId, group.name, 'owner')
                setCreatedGroup(group)
              } catch (err) { setError(err.message) }
              finally { setLoading(false) }
            }} />
          ) : (
            <JoinForm loading={loading} onError={setError} />
          )}
        </>
      )}
    </div>
  )
}

function CreateForm({ loading, onSubmit }) {
  const [name, setName] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [hasGoal, setHasGoal] = useState(true)

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !creatorName.trim() || !date) return
    if (hasGoal && !amount) return
    onSubmit({
      name: name.trim(),
      goalAmount: hasGoal ? amount : null,
      targetDate: date,
      creatorName: creatorName.trim()
    })
  }

  return (
    <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
      <Field label="Tu nombre (gestor)" htmlFor="creator-name">
        <input id="creator-name" type="text" placeholder="Tu nombre"
          value={creatorName} onChange={e => setCreatorName(e.target.value)} maxLength={60} required
          className="input-base" />
      </Field>
      <Field label="Nombre del grupo" htmlFor="group-name">
        <input id="group-name" type="text" placeholder="Natillera Navidad 2026"
          value={name} onChange={e => setName(e.target.value)} maxLength={100} required
          className="input-base" />
      </Field>
      <Field label="Monto meta (COP)" htmlFor="goal-amount">
        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer mb-1">
          <input type="checkbox" checked={hasGoal} onChange={e => setHasGoal(e.target.checked)} className="checkbox-custom" />
          Definir monto meta
        </label>
        {hasGoal && (
          <MoneyInput id="goal-amount" value={amount} onChange={setAmount} placeholder="2.500.000" required />
        )}
        {!hasGoal && (
          <p className="text-xs text-text-muted">El grupo acumulará sin un tope definido.</p>
        )}
      </Field>
      <Field label="Fecha objetivo" htmlFor="target-date">
        <DatePicker id="target-date" value={date} onChange={setDate} min={minDate} placeholder="dd/mm/aaaa" required />
      </Field>
      <button type="submit" disabled={loading}
        className="mt-2 w-full py-3 bg-accent text-white font-semibold rounded-lg transition-all duration-150 hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? 'Creando...' : 'Crear grupo'}
      </button>
    </form>
  )
}

function JoinForm({ loading, onError }) {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const sharedGroupId = params.get('g')
  const sharedCode = params.get('c')

  async function handleSubmit(e) {
    e.preventDefault()
    const effectiveCode = code.trim().toUpperCase() || sharedCode
    if (!effectiveCode) return
    setInviteCode(effectiveCode)
    if (sharedGroupId) {
      setStoredGroupId(sharedGroupId)
      navigate(`/group/${sharedGroupId}`)
    } else {
      // No groupId in URL — lookup by code
      try {
        const resolvedGroupId = await lookupGroupByCode(effectiveCode)
        setInviteCode(effectiveCode)
        setStoredGroupId(resolvedGroupId)
        navigate(`/group/${resolvedGroupId}`)
      } catch (err) {
        if (err.status === 401) onError('Código de invitación inválido.')
        else onError(err.message || 'No se pudo encontrar el grupo.')
      }
    }
  }

  return (
    <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
      <Field label="Código de invitación" htmlFor="invite-code">
        <input id="invite-code" type="text" placeholder="A3F9K2BX" maxLength={8}
          value={code || sharedCode || ''} onChange={e => setCode(e.target.value)} required
          className="input-base text-center tracking-[0.15em] uppercase font-mono text-lg" />
        <span className="text-xs text-text-muted">8 caracteres. Lo encuentra quien creó el grupo.</span>
      </Field>
      <button type="submit" disabled={loading}
        className="mt-2 w-full py-3 bg-accent text-white font-semibold rounded-lg transition-all duration-150 hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? 'Buscando...' : 'Ver el grupo'}
      </button>
      <p className="text-xs text-text-muted text-center">Los invitados pueden ver el progreso y los aportes del grupo.</p>
      <RecoverManagerAccess />
    </form>
  )
}

function GroupCreatedCard({ group }) {
  const navigate = useNavigate()
  const [downloaded, setDownloaded] = useState(false)
  const inviteUrl = `${window.location.origin}/home?g=${group.groupId}&c=${group.inviteCode}`

  const [codeCopied, setCodeCopied] = useState(false)

  async function handleCopyCode() {
    await navigator.clipboard.writeText(group.inviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: `Únete a ${group.name}`, text: `Únete a nuestra natillera "${group.name}".`, url: inviteUrl }) }
      catch { navigator.clipboard.writeText(inviteUrl) }
    } else { navigator.clipboard.writeText(inviteUrl) }
  }

  function handleDownloadAccess() {
    const content = `miNatillera — Acceso a tu grupo\n\nGrupo: ${group.name}\nID del grupo: ${group.groupId}\nCódigo de invitación: ${group.inviteCode}\nClave de gestor: ${group.creatorToken}\n\nGuardá este archivo en un lugar seguro.\nSi perdés acceso a tu navegador, podés recuperar el control\ningresando el ID del grupo y la clave de gestor en la opción\n"¿Perdiste el acceso de gestor?".\n`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `minatillera-${group.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-acceso.txt`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  return (
    <div className="w-full bg-elevated border border-border rounded-xl p-6 flex flex-col items-center gap-4 text-center">
      <p className="text-lg font-semibold">Grupo creado</p>
      <span className="text-3xl font-bold tracking-[0.1em] text-accent mono">{group.inviteCode}</span>
      <button onClick={handleCopyCode} className="flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: codeCopied ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
        <Copy size={14} /> {codeCopied ? '¡Copiado!' : 'Copiar código'}
      </button>
      <p className="text-sm text-text-secondary">Comparte este código para que otros se unan.</p>
      <div className="flex gap-3 w-full">
        <button onClick={handleShare} className="flex-1 py-2.5 bg-surface border border-border rounded-lg text-sm font-medium text-text-primary transition-colors hover:bg-border">Compartir</button>
      </div>

      {/* Prominent token download banner */}
      <div className="w-full p-4 rounded-lg border-2 border-[#FBBF77] bg-[rgba(251,191,119,0.08)]">
        <div className="flex items-start gap-2 mb-2">
          <AlertTriangle size={18} color="#FBBF77" className="flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-primary font-medium text-left">Descargá tu archivo de acceso</p>
        </div>
        <p className="text-xs text-text-secondary text-left mb-3">Este token no se mostrará de nuevo. Es tu única forma de recuperar el control del grupo si cambiás de dispositivo o borrás el caché del navegador.</p>
        <button onClick={handleDownloadAccess} className="w-full py-2.5 bg-accent text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors">
          <Download size={16} /> Descargar mi acceso
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
        <input type="checkbox" checked={downloaded} onChange={e => {
          if (e.target.checked && !downloaded) handleDownloadAccess()
          setDownloaded(e.target.checked)
        }} className="checkbox-custom" />
        Ya descargué y guardé mi acceso
      </label>

      <button
        onClick={() => navigate(`/group/${group.groupId}`)}
        disabled={!downloaded}
        className="w-full py-3 bg-accent text-white font-semibold rounded-lg transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Ir al grupo
      </button>
    </div>
  )
}

function RecoverManagerAccess() {
  const [show, setShow] = useState(false)
  const [groupId, setGroupId] = useState('')
  const [token, setToken] = useState('')
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  function handleRecover(e) {
    e.preventDefault()
    if (!groupId.trim() || !token.trim() || !code.trim()) return
    localStorage.setItem(`manager_token_${groupId.trim()}`, token.trim())
    localStorage.setItem('inviteCode', code.trim().toUpperCase())
    localStorage.setItem('groupId', groupId.trim())
    navigate(`/group/${groupId.trim()}`)
  }

  if (!show) {
    return (
      <button type="button" onClick={() => setShow(true)} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-elevated border border-border rounded-lg text-xs text-text-secondary hover:text-accent hover:border-accent/30 transition-all duration-150 cursor-pointer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        ¿Perdiste el acceso como gestor?
      </button>
    )
  }

  return (
    <div className="w-full flex flex-col gap-3 mt-3 p-3 bg-elevated border border-border rounded-lg">
      <p className="text-xs text-text-secondary">Ingresá los datos de tu archivo de respaldo:</p>
      <input type="text" placeholder="ID del grupo (UUID)" value={groupId} onChange={e => setGroupId(e.target.value)} className="input-base" style={{ fontSize: '0.8rem' }} />
      <input type="text" placeholder="Código de invitación (8 chars)" value={code} onChange={e => setCode(e.target.value)} className="input-base" style={{ fontSize: '0.8rem' }} maxLength={8} />
      <input type="text" placeholder="Token de gestor" value={token} onChange={e => setToken(e.target.value)} className="input-base" style={{ fontSize: '0.8rem' }} />
      <button type="button" onClick={handleRecover} className="btn btn--primary" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>Recuperar acceso</button>
    </div>
  )
}

function RecentGroupsSection() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState(getRecentGroups())
  const [expanded, setExpanded] = useState(false)

  if (groups.length === 0) return null

  function handleGoToGroup(g) {
    if (g.inviteCode) setInviteCode(g.inviteCode)
    setStoredGroupId(g.groupId)
    navigate(`/group/${g.groupId}`)
  }

  function timeAgo(ts) {
    if (!ts) return ''
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Hace un momento'
    if (mins < 60) return `Hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Hace ${hours}h`
    const days = Math.floor(hours / 24)
    return `Hace ${days}d`
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <button onClick={() => setExpanded(!expanded)} className="recent-groups__toggle">
        <span className="micro-label" style={{ margin: 0 }}>Tus grupos</span>
        <span className="recent-groups__toggle-action">
          <span className="recent-groups__toggle-text">{expanded ? 'Ocultar' : 'Mostrar'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="recent-groups__chevron" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div className="recent-groups__content" style={{ maxHeight: expanded ? '2000px' : '0' }}>
        <div className="flex flex-col gap-2 pt-1">
          {groups.map(g => (
            <button
              key={g.groupId}
              onClick={() => handleGoToGroup(g)}
              className="w-full flex items-center justify-between p-4 bg-elevated border border-border rounded-xl hover:border-accent/30 hover:shadow-[0_2px_12px_rgba(124,92,252,0.06)] transition-all duration-150 cursor-pointer text-left"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{g.groupName || 'Mi natillera'}</span>
                <div className="flex items-center gap-2">
                  {g.inviteCode && <span className="text-xs mono" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>{g.inviteCode}</span>}
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{g.role === 'owner' ? 'Administrador' : 'Co-gestor'}</span>
                </div>
                {g.updatedAt && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(g.updatedAt)}</span>}
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>Continuar →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  )
}

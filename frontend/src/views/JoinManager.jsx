import { useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ShieldCheck, AlertTriangle, Download } from 'lucide-react'
import { acceptManagerInvite, setManagerToken, setStoredGroupId, setInviteCode, addRecentGroup } from '../lib/api'

export default function JoinManager() {
  const { groupId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const inviteToken = searchParams.get('token') || ''

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [downloaded, setDownloaded] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !inviteToken) return
    setLoading(true); setError(null)
    try {
      const res = await acceptManagerInvite(groupId, inviteToken, name.trim())
      setManagerToken(groupId, res.managerToken)
      setStoredGroupId(groupId)
      if (res.inviteCode) {
        setInviteCode(res.inviteCode)
      }
      addRecentGroup(groupId, groupId, 'co-manager')
      setResult({ managerToken: res.managerToken, name: name.trim() })
    } catch (err) {
      setError(err.message || 'No se pudo aceptar la invitación.')
    } finally { setLoading(false) }
  }

  function handleDownload() {
    const invCode = localStorage.getItem('inviteCode') || ''
    const content = `miNatillera — Acceso de co-gestor\n\nGrupo (ID): ${groupId}\nCódigo de invitación: ${invCode}\nRol: Co-gestor\nNombre: ${result.name}\nClave de gestor: ${result.managerToken}\n\nGuardá este archivo en un lugar seguro.\nSi perdés acceso a tu navegador, podés recuperar el control\ningresando el ID del grupo y la clave de gestor en la opción\n"¿Perdiste el acceso de gestor?".\n`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `minatillera-cogestor-${result.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-acceso.txt`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  if (result) {
    return (
      <div className="w-full flex flex-col items-center gap-6 animate-fade-up">
        <ShieldCheck size={48} color="#7C5CFC" />
        <h1 className="text-xl font-bold text-center">¡Sos co-gestor!</h1>
        <p className="text-sm text-text-secondary text-center">Ya podés agregar miembros, registrar aportes y gestionar préstamos.</p>

        <div className="w-full p-4 rounded-lg border-2 border-[#FBBF77] bg-[rgba(251,191,119,0.08)]">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={18} color="#FBBF77" className="flex-shrink-0 mt-0.5" />
            <p className="text-sm text-text-primary font-medium">Descargá tu archivo de acceso</p>
          </div>
          <p className="text-xs text-text-secondary mb-3">Este token no se mostrará de nuevo. Guardá el archivo — es tu única forma de recuperar el control si cambiás de dispositivo o borrás el caché.</p>
          <button onClick={handleDownload} className="w-full py-2.5 bg-accent text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors">
            <Download size={16} /> Descargar mi acceso
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
          <input type="checkbox" checked={downloaded} onChange={e => setDownloaded(e.target.checked)} className="checkbox-custom" />
          Ya descargué y guardé mi acceso
        </label>

        <button
          onClick={() => navigate(`/group/${groupId}`)}
          disabled={!downloaded}
          className="w-full py-3 bg-accent text-white font-semibold rounded-lg transition-all hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Ir al grupo
        </button>
      </div>
    )
  }

  if (!inviteToken) {
    return (
      <div className="w-full flex flex-col items-center gap-6 animate-fade-up">
        <p className="text-text-secondary">Link de invitación inválido o faltante.</p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col items-center gap-6 animate-fade-up">
      <ShieldCheck size={48} color="#7C5CFC" />
      <h1 className="text-xl font-bold text-center">Unirse como co-gestor</h1>
      <p className="text-sm text-text-secondary text-center">Te invitaron a gestionar este grupo. Ingresá tu nombre para continuar.</p>

      {error && <p className="text-sm text-warm text-center" role="alert">{error}</p>}

      <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mgr-name" className="text-xs font-medium text-text-secondary">Tu nombre</label>
          <input id="mgr-name" type="text" placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} maxLength={60} required className="input-base" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-accent text-white font-semibold rounded-lg transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Aceptando...' : 'Aceptar invitación'}
        </button>
      </form>
    </div>
  )
}

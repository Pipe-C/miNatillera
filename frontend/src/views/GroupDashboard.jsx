import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Copy, Share2, History, Users, Receipt, UserPlus, Crown, Banknote, ShieldCheck, X, Star, Eye, LogOut, Wallet, CalendarClock, Trash2, Pencil } from 'lucide-react'
import ProgressRing from '../components/ProgressRing'
import ExcelImport from '../components/ExcelImport'
import ExportXlsx from '../components/ExportXlsx'
import ExportImage from '../components/ExportImage'
import MonthlyChart from '../components/MonthlyChart'
import MoneyInput from '../components/MoneyInput'
import DatePicker from '../components/DatePicker'
import CoinBurst, { useCoinBurst } from '../components/CoinBurst'
import '../components/ExcelImport.css'
import { getProgress, listContributions, listMembers, listLoans, createLoan, registerRepayment, createManagerInvite, removeMember as apiRemoveMember, removeMemberWithOptions, updateMember as apiUpdateMember, deleteContribution as apiDeleteContribution, updateContribution as apiUpdateContribution, getStoredGroupId, setInviteCode, addMember, getCreatorToken, getManagerToken, verifyManager, addRecentGroup, logoutGroup, forgetGroup, removeRecentGroup } from '../lib/api'
import { requestNotificationPermission, scheduleTargetDateReminder, checkInactivityReminder } from '../lib/notifications'
import { getRandomQuote } from '../lib/quotes'
import { formatCOP } from '../lib/formatMoney'
import './GroupDashboard.css'

export default function GroupDashboard() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [progress, setProgress] = useState(null)
  const [contributions, setContributions] = useState([])
  const [members, setMembers] = useState([])
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [motivation, setMotivation] = useState(null)
  const [activeModule, setActiveModule] = useState(null) // null=overview, 'aportes', 'miembros', 'prestamos'
  const [copied, setCopied] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [receiptModal, setReceiptModal] = useState(null)
  const [editingContribution, setEditingContribution] = useState(null)
  const [visibleAportes, setVisibleAportes] = useState(15)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [sortOrder, setSortOrder] = useState('newest')
  const [coins, triggerCoin, removeCoin] = useCoinBurst()
  const [welcomeMsg, setWelcomeMsg] = useState(null)
  const [verifiedManager, setVerifiedManager] = useState(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => { loadData() }, [groupId])

  useEffect(() => {
    if (!progress || loading) return
    // Verify manager + welcome banner (initial)
    if (getManagerToken(groupId)) {
      verifyManager(groupId).then(info => {
        addRecentGroup(groupId, info.groupName, info.isOwner ? 'owner' : 'co-manager')
        setVerifiedManager(info)
        setWelcomeMsg(info)
        setTimeout(() => setWelcomeMsg(null), 4000)
      }).catch(() => handleRevocation())
    }
    // Set motivational quote
    setMotivation(getRandomQuote())
    requestNotificationPermission().then(permission => {
      if (permission === 'granted') {
        scheduleTargetDateReminder(progress.name, progress.targetDate)
        if (progress.status === 'ACTIVO') checkInactivityReminder(progress.name, progress.lastContributionDate)
      }
    })
    const daysLeft = Math.max(0, Math.ceil((new Date(progress.targetDate) - new Date()) / 86400000))
  }, [progress, loading])

  // Continuous permission validation + data sync (polling every 30s)
  useEffect(() => {
    if (!progress || loading) return
    const interval = setInterval(() => {
      // Verify permissions first
      if (getManagerToken(groupId)) {
        verifyManager(groupId).catch(() => handleRevocation())
      }
      // Refresh data silently (no loading spinner)
      Promise.all([getProgress(groupId), listContributions(groupId, 50), listMembers(groupId), listLoans(groupId)])
        .then(([p, c, m, l]) => {
          setProgress(p); setContributions(c.contributions || []); setMembers(m.members || []); setLoans(l || [])
        })
        .catch(() => { /* silent — network hiccup */ })
    }, 30000)
    return () => clearInterval(interval)
  }, [progress, loading, groupId])

  function handleRevocation() {
    localStorage.removeItem(`manager_token_${groupId}`)
    localStorage.removeItem(`creator_token_${groupId}`)
    removeRecentGroup(groupId)
    // Navigate with state to show revocation message
    navigate('/home', { replace: true, state: { revoked: true } })
  }

  async function loadData() {
    setLoading(true); setError(null)
    try {
      const [p, c, m, l] = await Promise.all([getProgress(groupId), listContributions(groupId, 50), listMembers(groupId), listLoans(groupId)])
      setProgress(p); setContributions(c.contributions || []); setMembers(m.members || []); setLoans(l || [])
    } catch (err) {
      if (err.status === 401) { navigate('/', { replace: true }); return }
      setError(err.message || 'No se pudo cargar la información.')
    } finally { setLoading(false) }
  }

  const inviteCode = localStorage.getItem('inviteCode') || ''
  const isManager = !!getManagerToken(groupId)

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function shareGroup() {
    const url = `${window.location.origin}/home?g=${groupId}&c=${inviteCode}`
    try {
      if (navigator.share) {
        await navigator.share({ title: progress?.name, text: `Únete a "${progress?.name}" en miNatillera`, url })
        return
      }
    } catch (e) { /* share cancelled */ }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleDeleteContribution(contributionId) {
    setConfirmDeleteId(contributionId)
  }

  async function executeDeleteContribution() {
    if (!confirmDeleteId) return
    try {
      await apiDeleteContribution(groupId, confirmDeleteId)
      setConfirmDeleteId(null)
      loadData()
    } catch (err) { setConfirmDeleteId(null) }
  }

  if (error) return (
    <div className="dashboard"><div className="dashboard__error"><p>{error}</p><button className="btn btn--primary" onClick={loadData}>Reintentar</button></div></div>
  )

  if (loading) return (
    <div className="dashboard">
      <LoadingDots />
    </div>
  )

  const daysUntilTarget = progress ? Math.max(0, Math.ceil((new Date(progress.targetDate) - new Date()) / 86400000)) : 0

  return (
    <div className="dashboard">
      {/* Coin bursts */}
      {coins.map(c => <CoinBurst key={c.id} x={c.x} y={c.y} onComplete={() => removeCoin(c.id)} />)}

      {/* Receipt modal */}
      {receiptModal && (
        <div className="receipt-modal" onClick={() => setReceiptModal(null)}>
          <div className="receipt-modal__content" onClick={e => e.stopPropagation()}>
            <button className="receipt-modal__close" onClick={() => setReceiptModal(null)}><X size={20} /></button>
            <img src={receiptModal} alt="Comprobante" className="receipt-modal__img" />
          </div>
        </div>
      )}

      {/* ═══ Module: Overview ═══ */}
      {!activeModule && progress && (
        <div className="dashboard__overview animate-fade-up">
          {/* Welcome banner */}
          {welcomeMsg && (
            <div className="dashboard__welcome">
              {welcomeMsg.isOwner ? <Crown size={16} color="#FBBF77" /> : <Star size={16} color="var(--color-accent)" />}
              <span>Bienvenido de nuevo, <strong>{welcomeMsg.name}</strong></span>
            </div>
          )}

          {/* Invite chip — floating top-right */}
          {inviteCode && (
            <div className="dashboard__invite-chip">
              <span className="dashboard__invite-code mono">{inviteCode}</span>
              <button className="dashboard__invite-btn" onClick={copyCode} title="Copiar código">
                <Copy size={14} />{copied && <span className="dashboard__copied">¡Copiado!</span>}
              </button>
              <button className="dashboard__invite-btn" onClick={shareGroup} title="Compartir">
                <Share2 size={14} />
              </button>
            </div>
          )}

          {/* Logout — separate from chip */}
          {isManager && (
            <div className="dashboard__logout-area">
              <button className="dashboard__logout-btn" onClick={() => setShowLogoutConfirm(true)} title="Cerrar sesión">
                <LogOut size={14} />
              </button>
            </div>
          )}

          {/* Logout confirmation — overlay */}
          {showLogoutConfirm && (
            <div className="dialog-overlay" onClick={() => setShowLogoutConfirm(false)}>
              <div className="dialog-panel" onClick={e => e.stopPropagation()}>
                <h3 className="dialog-panel__title">Salir del grupo</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button className="btn btn--secondary" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }} onClick={() => { logoutGroup(groupId); navigate('/home') }}>
                    <div><strong style={{ fontSize: '0.82rem' }}>Cerrar sesión</strong><br /><span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Podés retomar el grupo desde este dispositivo sin token.</span></div>
                  </button>
                  <button className="btn btn--secondary" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px', borderColor: 'rgba(238,85,85,0.3)' }} onClick={() => { forgetGroup(groupId); navigate('/home') }}>
                    <div><strong style={{ fontSize: '0.82rem', color: '#E55' }}>Olvidar este dispositivo</strong><br /><span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Borra el acceso guardado. Solo podrás volver con el token descargado.</span></div>
                  </button>
                  <button className="btn btn--secondary" style={{ fontSize: '0.78rem' }} onClick={() => setShowLogoutConfirm(false)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* Progress ring */}
          <div className="dashboard__ring-section">
            <ProgressRing percent={progress.goalAmount ? (progress.progressPercent || 0) : null} amount={progress.accumulatedAmount} goal={progress.goalAmount || null} loading={false} />
          </div>

          <h1 className="dashboard__group-name">{progress.name}</h1>
          {progress.status === 'COMPLETADO' && progress.goalAmount && <div className="dashboard__badge dashboard__badge--success">Meta alcanzada</div>}

          {/* Editorial Stats — card treatment */}
          <div className="dashboard__identity-card">
            <div className="dashboard__stats">
              {progress.goalAmount && (
                <div className="stat-editorial stat-stagger">
                  <Wallet size={16} style={{ color: 'var(--color-accent)', opacity: 0.7 }} />
                  <span className="stat-editorial__value mono">{formatCOP(progress.remainingAmount)}</span>
                  <span className="stat-editorial__label">Faltante</span>
                </div>
              )}
              <div className="stat-editorial stat-stagger">
                <Users size={16} style={{ color: 'var(--color-accent)', opacity: 0.7 }} />
                <span className="stat-editorial__value mono">{members.length}</span>
                <span className="stat-editorial__label">Miembros</span>
              </div>
              <div className="stat-editorial stat-stagger">
                <CalendarClock size={16} style={{ color: 'var(--color-accent)', opacity: 0.7 }} />
                <span className="stat-editorial__value mono">{daysUntilTarget}</span>
                <span className="stat-editorial__label">Días restantes</span>
              </div>
            </div>
          </div>

          {/* CTAs — managers */}
          {isManager && progress.status === 'ACTIVO' && (
            <div className="dashboard__cta-stack">
              <Link to={`/group/${groupId}/contribute`} className="btn btn--primary btn--full" onClick={triggerCoin}>Registrar aporte</Link>
            </div>
          )}

          {/* Motivational quote */}
          {motivation && (
            <div className="dashboard__quote">
              <p className="dashboard__quote-text">{"\u201C"}{motivation.text}{"\u201D"}</p>
              <span className="dashboard__quote-author">— {motivation.author || 'Anónimo'}</span>
            </div>
          )}

          {/* Module navigation cards */}
          <div className="dashboard__modules">
            <button className="module-card" onClick={() => setActiveModule('aportes')}>
              <Eye size={20} style={{ color: 'var(--color-accent)' }} />
              <span className="module-card__title">Ver aportes</span>
              <span className="module-card__count">{contributions.length}</span>
            </button>
            <button className="module-card" onClick={() => setActiveModule('miembros')}>
              <Users size={20} style={{ color: 'var(--color-accent)' }} />
              <span className="module-card__title">Miembros</span>
              <span className="module-card__count">{members.length}</span>
            </button>
            <button className="module-card" onClick={() => setActiveModule('prestamos')}>
              <Banknote size={20} style={{ color: 'var(--color-accent)' }} />
              <span className="module-card__title">Préstamos</span>
              <span className="module-card__count">{loans.length}</span>
            </button>
          </div>

          {/* Actions row */}
          <div className="dashboard__actions-row">
            <ExcelImport members={members} groupId={groupId} onImportComplete={loadData} />
            <ExportXlsx progress={progress} contributions={contributions} members={members} disabled={contributions.length === 0} />
            <ExportImage progress={progress} disabled={contributions.length === 0} />
          </div>
        </div>
      )}

      {/* ═══ Module: Aportes ═══ */}
      {activeModule === 'aportes' && (
        <section className="dashboard__module animate-fade-up">
          <button className="dashboard__back btn btn--secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => setActiveModule(null)}>← Volver</button>
          <span className="micro-label">Aportes</span>
          <h2 className="dashboard__module-title">Historial de aportes</h2>
          {contributions.length > 0 && <MonthlyChart contributions={contributions} />}
          {contributions.length === 0 ? (
            <div className="dashboard__empty"><Receipt size={32} strokeWidth={1.2} color="#665E73" /><p>Aún no hay aportes registrados.</p></div>
          ) : (
            <>
              {/* Filters — two rows: months then person + sort */}
              <div className="dashboard__filters-stack">
                <MonthFilterChips contributions={contributions} selected={selectedMonth} onSelect={m => { setSelectedMonth(m); setVisibleAportes(15) }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select className="dashboard__person-select" value={selectedPerson || ''} onChange={e => { setSelectedPerson(e.target.value || null); setVisibleAportes(15) }}>
                    <option value="">Todos los miembros</option>
                    {members.map(m => <option key={m.memberId} value={m.name}>{m.name}</option>)}
                  </select>
                  <select className="dashboard__person-select" value={sortOrder} onChange={e => { setSortOrder(e.target.value); setVisibleAportes(15) }}>
                    <option value="newest">Más reciente</option>
                    <option value="oldest">Más antiguo</option>
                    <option value="highest">Mayor monto</option>
                    <option value="lowest">Menor monto</option>
                  </select>
                </div>
              </div>

              {/* Pending detection banner */}
              {selectedPerson && <PendingBanner contributions={contributions} personName={selectedPerson} selectedMonth={selectedMonth} progress={progress} />}

              <ul className="dashboard__list">
                {(() => {
                  const filtered = contributions.filter(c => {
                    let match = true
                    if (selectedMonth) { const d = new Date(c.date + 'T00:00:00'); match = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === selectedMonth }
                    if (selectedPerson) { match = match && c.memberName === selectedPerson }
                    return match
                  })
                  // Sort
                  const sorted = [...filtered].sort((a, b) => {
                    switch (sortOrder) {
                      case 'oldest': return a.date.localeCompare(b.date)
                      case 'highest': return parseFloat(b.amount) - parseFloat(a.amount)
                      case 'lowest': return parseFloat(a.amount) - parseFloat(b.amount)
                      default: return b.date.localeCompare(a.date) // newest
                    }
                  })
                  const visible = sorted.slice(0, visibleAportes)
                  const hasMore = sorted.length > visibleAportes
                  return (
                    <>
                      {visible.map((c, i) => {
                        const receiptUrl = c.receiptImageUrl || null
                        return (
                          <li key={c.contributionId} className={`contribution-item ${receiptUrl ? 'contribution-item--clickable' : ''}`} style={{ animationDelay: `${i * 40}ms` }} onClick={() => receiptUrl && setReceiptModal(receiptUrl)}>
                            <div className="contribution-item__info">
                              <span className="contribution-item__name">{c.memberName}</span>
                              <span className="contribution-item__date">{formatDate(c.date)}</span>
                            </div>
                            <div className="contribution-item__right">
                              {receiptUrl && <button className="contribution-item__receipt-btn" onClick={e => { e.stopPropagation(); setReceiptModal(receiptUrl) }}>Ver comprobante</button>}
                              <span className="contribution-item__amount mono">+{formatCOP(c.amount)}</span>
                              {isManager && <button className="contribution-item__edit" onClick={e => { e.stopPropagation(); setEditingContribution(c) }} title="Editar aporte"><Pencil size={13} /></button>}
                              {isManager && <button className="contribution-item__delete" onClick={e => { e.stopPropagation(); handleDeleteContribution(c.contributionId) }} title="Eliminar aporte"><Trash2 size={13} /></button>}
                            </div>
                          </li>
                        )
                      })}
                      {hasMore && (
                        <li className="dashboard__load-more">
                          <button className="btn btn--secondary" style={{ width: '100%', fontSize: '0.8rem' }} onClick={() => setVisibleAportes(prev => prev + 15)}>
                            Ver más ({sorted.length - visibleAportes} restantes)
                          </button>
                        </li>
                      )}
                    </>
                  )
                })()}
              </ul>
              {editingContribution && (
                <EditContributionModal contribution={editingContribution} groupId={groupId} onSaved={() => { setEditingContribution(null); loadData() }} onClose={() => setEditingContribution(null)} />
              )}
              {confirmDeleteId && (
                <div className="dialog-overlay" onClick={() => setConfirmDeleteId(null)}>
                  <div className="dialog-panel" onClick={e => e.stopPropagation()}>
                    <h3 className="dialog-panel__title">Eliminar aporte</h3>
                    <p className="dialog-panel__subtitle" style={{ lineHeight: 1.5 }}>¿Estás seguro que querés eliminar este aporte? Las estadísticas del grupo se actualizarán automáticamente.</p>
                    <div className="dialog-panel__actions" style={{ marginTop: 16 }}>
                      <button className="btn btn--primary" style={{ flex: 1, background: '#E55' }} onClick={executeDeleteContribution}>Eliminar</button>
                      <button className="btn btn--secondary" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ═══ Module: Miembros ═══ */}
      {activeModule === 'miembros' && (
        <section className="dashboard__module animate-fade-up">
          <button className="dashboard__back btn btn--secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => setActiveModule(null)}>← Volver</button>
          <span className="micro-label">Miembros</span>
          <h2 className="dashboard__module-title">Equipo del grupo</h2>
          <p className="dashboard__section-hint" style={{ color: 'var(--color-text-secondary)' }}>{isManager ? 'Podés agregar miembros manualmente.' : 'Solo los gestores pueden agregar miembros.'}</p>
          {isManager && <AddMemberForm groupId={groupId} onAdded={loadData} />}
          {isManager && <InviteManagerButton groupId={groupId} />}
          {members.length === 0 ? (
            <div className="dashboard__empty"><UserPlus size={32} strokeWidth={1.2} color="#665E73" /><p>No hay miembros todavía.</p></div>
          ) : (
            <div className="dashboard__members-grid">
              {members.map(m => <MemberCard key={m.memberId} member={m} groupId={groupId} currentUserIsOwner={!!verifiedManager?.isOwner} onRemoved={loadData} onEdited={loadData} />)}
            </div>
          )}
        </section>
      )}

      {/* ═══ Module: Préstamos ═══ */}
      {activeModule === 'prestamos' && (
        <section className="dashboard__module animate-fade-up">
          <button className="dashboard__back btn btn--secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => setActiveModule(null)}>← Volver</button>
          <LoansModule groupId={groupId} loans={loans} members={members} progress={progress} onChanged={loadData} triggerCoin={triggerCoin} />
        </section>
      )}
    </div>
  )
}

/* ─── Loading Dots ─── */
function LoadingDots() {
  return <div className="loading-dots"><span className="loading-dots__dot" /><span className="loading-dots__dot" /><span className="loading-dots__dot" /></div>
}

/* ─── Sub-components ─── */

function AddMemberForm({ groupId, onAdded }) {
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  async function handleAdd(e) {
    e.preventDefault(); if (!name.trim()) return; setAdding(true)
    try { await addMember(groupId, name.trim()); setName(''); onAdded() } catch {}
    setAdding(false)
  }
  return (
    <form className="dashboard__add-member" onSubmit={handleAdd}>
      <input type="text" placeholder="Nombre del miembro" value={name} onChange={e => setName(e.target.value)} className="input-base" style={{ flex: 1 }} maxLength={60} />
      <button type="submit" className="btn btn--primary" disabled={adding} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>{adding ? '...' : '+ Agregar'}</button>
    </form>
  )
}

function MemberCard({ member: m, groupId, currentUserIsOwner, onRemoved, onEdited }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(m.name)
  const [savingName, setSavingName] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try { await apiRemoveMember(groupId, m.memberId); onRemoved() } catch {}
    setRemoving(false); setConfirmRemove(false)
  }

  async function handleSaveName(e) {
    e.preventDefault()
    if (!editName.trim() || editName.trim() === m.name) { setEditing(false); return }
    setSavingName(true)
    try { await apiUpdateMember(groupId, m.memberId, editName.trim()); onEdited(); setEditing(false) } catch {}
    setSavingName(false)
  }

  const canManage = currentUserIsOwner && !m.isOwner

  if (editing) {
    return (
      <div className="member-card">
        <form onSubmit={handleSaveName} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="input-base" style={{ fontSize: '0.78rem', padding: '6px 8px' }} maxLength={60} autoFocus />
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="submit" className="member-card__confirm-yes" disabled={savingName} style={{ flex: 1 }}>{savingName ? '...' : 'Guardar'}</button>
            <button type="button" className="member-card__confirm-no" onClick={() => { setEditing(false); setEditName(m.name) }} style={{ flex: 1 }}>Cancelar</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="member-card">
      <div className="member-card__avatar">
        {m.isOwner && <Crown size={12} className="member-card__crown" />}
        {!m.isOwner && m.isManager && <Star size={12} className="member-card__star" />}
        {m.name.charAt(0).toUpperCase()}
      </div>
      <span className="member-card__name">{m.name}</span>
      {canManage && !confirmRemove && (
        <div className="member-card__actions">
          <button className="member-card__edit" onClick={() => setEditing(true)} title="Editar"><Pencil size={11} /></button>
          <button className="member-card__remove" onClick={() => setConfirmRemove(true)} title="Retirar"><X size={12} /></button>
        </div>
      )}
      {confirmRemove && (
        <div className="member-card__confirm">
          <span className="member-card__confirm-text">{m.isManager ? '¿Quitar co-gestor?' : '¿Quitar miembro?'}</span>
          <button className="member-card__confirm-yes" onClick={handleRemove} disabled={removing}>{removing ? '...' : 'Quitar'}</button>
          <button className="member-card__confirm-no" onClick={() => setConfirmRemove(false)}>Cancelar</button>
        </div>
      )}
    </div>
  )
}

function RecoverAccessForm({ groupId, onRecovered }) {
  const [show, setShow] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleRecover(e) {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true); setError(null)
    // Temporarily store token to verify it
    localStorage.setItem(`manager_token_${groupId}`, token.trim())
    try {
      await verifyManager(groupId)
      onRecovered()
    } catch {
      localStorage.removeItem(`manager_token_${groupId}`)
      setError('Token inválido. Verificá que corresponda a este grupo.')
    } finally { setLoading(false) }
  }

  if (!show) return <button className="dashboard__recover-link" onClick={() => setShow(true)}>¿Perdiste el acceso de gestor?</button>

  return (
    <form className="dashboard__add-member" onSubmit={handleRecover} style={{ flexDirection: 'column', gap: 8 }}>
      {error && <p className="text-xs" style={{ color: 'var(--color-warm)' }}>{error}</p>}
      <input type="text" placeholder="Pega tu clave de gestor" value={token} onChange={e => setToken(e.target.value)} className="input-base" style={{ fontSize: '0.8rem' }} />
      <button type="submit" className="btn btn--secondary" disabled={loading} style={{ padding: '8px 12px', fontSize: '0.8rem', width: '100%' }}>{loading ? 'Verificando...' : 'Recuperar acceso'}</button>
    </form>
  )
}

function InviteManagerButton({ groupId }) {
  const [loading, setLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  async function handleInvite() {
    setLoading(true)
    try { const result = await createManagerInvite(groupId); const link = `${window.location.origin}/group/${groupId}/join-manager?token=${encodeURIComponent(result.inviteToken)}`; setInviteLink(link); await navigator.clipboard.writeText(link); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) } catch {}
    finally { setLoading(false) }
  }
  async function handleCopy() { if (!inviteLink) return; await navigator.clipboard.writeText(inviteLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) }
  if (inviteLink) return <div className="invite-manager-result"><div className="invite-manager-result__row"><span className="invite-manager-result__text">Link generado (24h)</span><button className="invite-manager-result__copy" onClick={handleCopy}><Copy size={14} /> {linkCopied ? '¡Copiado!' : 'Copiar'}</button></div></div>
  return <button className="btn btn--secondary" style={{ fontSize: '0.8rem', marginBottom: 12, width: '100%', gap: '8px' }} onClick={handleInvite} disabled={loading}><ShieldCheck size={14} /> {loading ? 'Generando...' : 'Invitar co-gestor'}</button>
}

function LoansModule({ groupId, loans, members, progress, onChanged, triggerCoin }) {
  const isManager = !!getManagerToken(groupId)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [repayingLoanId, setRepayingLoanId] = useState(null)
  const accumulated = parseFloat(progress?.accumulatedAmount || '0')
  const totalOutstanding = loans.reduce((sum, l) => sum + parseFloat(l.outstandingBalance || '0'), 0)
  const availableBalance = accumulated - totalOutstanding

  return (
    <>
      <span className="micro-label">Préstamos</span>
      <h2 className="dashboard__module-title">Gestión de préstamos</h2>
      {isManager && (
        <>
          <p className="dashboard__section-hint">Saldo disponible: <span className="mono" style={{ color: 'var(--color-accent)' }}>{formatCOP(String(Math.max(0, availableBalance)))}</span></p>
          {!showCreateForm ? (
            <button className="btn btn--secondary" style={{ marginBottom: 12, fontSize: '0.85rem', width: '100%' }} onClick={() => setShowCreateForm(true)}>+ Nuevo préstamo</button>
          ) : (
            <CreateLoanForm groupId={groupId} members={members} availableBalance={availableBalance} onCreated={(e) => { setShowCreateForm(false); triggerCoin?.(e); onChanged() }} onCancel={() => setShowCreateForm(false)} />
          )}
        </>
      )}
      {loans.length === 0 ? (
        <div className="dashboard__empty"><Banknote size={32} strokeWidth={1.2} color="#665E73" /><p>No hay préstamos registrados.</p></div>
      ) : (
        <ul className="dashboard__list">
          {loans.map((loan, i) => (
            <li key={loan.loanId} className="loan-item" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="loan-item__header"><span className="loan-item__name">{loan.memberName}</span><span className={`loan-item__badge ${loan.status === 'Pagado' ? 'loan-item__badge--paid' : 'loan-item__badge--pending'}`}>{loan.status}</span></div>
              <div className="loan-item__details"><span className="mono">{formatCOP(loan.principalAmount)}</span><span className="loan-item__date">{formatDate(loan.dateIssued)}</span></div>
              {loan.status === 'Pendiente' && <div className="loan-item__outstanding">Pendiente: <span className="mono">{formatCOP(loan.outstandingBalance)}</span></div>}
              {loan.notes && <p className="loan-item__notes">{loan.notes}</p>}
              {isManager && loan.status === 'Pendiente' && (
                repayingLoanId === loan.loanId
                  ? <RepaymentForm groupId={groupId} loanId={loan.loanId} onDone={(e) => { setRepayingLoanId(null); triggerCoin?.(e); onChanged() }} onCancel={() => setRepayingLoanId(null)} />
                  : <button className="btn btn--secondary loan-item__repay-styled" onClick={() => setRepayingLoanId(loan.loanId)}>Registrar pago</button>
              )}
              {loan.repayments?.length > 0 && <div className="loan-item__repayments">{loan.repayments.map(r => <span key={r.repaymentId} className="loan-item__repayment">{formatDate(r.date)}: <span className="mono">{formatCOP(r.amount)}</span></span>)}</div>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function CreateLoanForm({ groupId, members, availableBalance, onCreated, onCancel }) {
  const [memberId, setMemberId] = useState(''); const [amount, setAmount] = useState(''); const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0]); const [notes, setNotes] = useState(''); const [error, setError] = useState(null); const [loading, setLoading] = useState(false)
  async function handleSubmit(e) { e.preventDefault(); if (!memberId || !amount) return; const n = parseFloat(amount); if (n > availableBalance) { setError(`Supera saldo disponible.`); return }; setLoading(true); setError(null); try { await createLoan(groupId, { memberId, amount: n, dateIssued, notes: notes || null }); onCreated(e) } catch (err) { setError(err.message) } finally { setLoading(false) } }
  return (
    <form className="loan-form" onSubmit={handleSubmit}>
      {error && <p className="loan-form__error">{error}</p>}
      <select value={memberId} onChange={e => setMemberId(e.target.value)} className="input-base" required><option value="">Seleccionar miembro</option>{members.map(m => <option key={m.memberId} value={m.memberId}>{m.name}</option>)}</select>
      <MoneyInput value={amount} onChange={setAmount} placeholder="Monto del préstamo" required />
      <DatePicker value={dateIssued} onChange={setDateIssued} max={new Date().toISOString().split('T')[0]} placeholder="Fecha" required />
      <input type="text" placeholder="Nota (opcional)" value={notes} onChange={e => setNotes(e.target.value)} className="input-base" maxLength={200} />
      <div className="loan-form__actions"><button type="submit" className="btn btn--primary" disabled={loading} style={{ fontSize: '0.8rem', padding: '8px 12px' }}>{loading ? '...' : 'Crear'}</button><button type="button" className="btn btn--secondary" onClick={onCancel} style={{ fontSize: '0.8rem', padding: '8px 12px' }}>Cancelar</button></div>
    </form>
  )
}

function RepaymentForm({ groupId, loanId, onDone, onCancel }) {
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(new Date().toISOString().split('T')[0]); const [loading, setLoading] = useState(false); const [error, setError] = useState(null)
  async function handleSubmit(e) { e.preventDefault(); if (!amount) return; setLoading(true); setError(null); try { await registerRepayment(groupId, loanId, { amount: parseFloat(amount), date }); onDone(e) } catch (err) { setError(err.message) } finally { setLoading(false) } }
  return (
    <form className="loan-form loan-form--inline" onSubmit={handleSubmit}>
      {error && <p className="loan-form__error">{error}</p>}
      <MoneyInput value={amount} onChange={setAmount} placeholder="Monto pago" required style={{ flex: 1 }} />
      <DatePicker value={date} onChange={setDate} max={new Date().toISOString().split('T')[0]} placeholder="Fecha" required />
      <button type="submit" className="btn btn--primary" disabled={loading} style={{ fontSize: '0.75rem', padding: '6px 10px' }}>{loading ? '...' : 'Pagar'}</button>
      <button type="button" className="btn btn--secondary" onClick={onCancel} style={{ fontSize: '0.75rem', padding: '6px 10px' }}>×</button>
    </form>
  )
}

function MonthFilterChips({ contributions, selected, onSelect }) {
  const months = [...new Set(contributions.map(c => { const d = new Date(c.date + 'T00:00:00'); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }))].sort().reverse()
  function label(key) { const [y, m] = key.split('-'); return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) }
  return <div className="month-chips"><button className={`month-chip ${!selected ? 'month-chip--active' : ''}`} onClick={() => onSelect(null)}>Todos</button>{months.map(m => <button key={m} className={`month-chip ${selected === m ? 'month-chip--active' : ''}`} onClick={() => onSelect(m)}>{label(m)}</button>)}</div>
}

function EditContributionModal({ contribution, groupId, onSaved, onClose }) {
  const initialAmount = String(Math.round(parseFloat(contribution.amount || '0')))
  const [amount, setAmount] = useState(initialAmount)
  const [date, setDate] = useState(contribution.date || '')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(contribution.receiptImageUrl || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const hasChanges = amount !== initialAmount || date !== contribution.date || receiptFile !== null

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no debe superar 5MB.'); return }
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!hasChanges) return
    setSaving(true); setError(null)
    try {
      let finalReceiptUrl = contribution.receiptImageUrl || null

      // Upload new receipt if file selected
      if (receiptFile) {
        try {
          const { getPresignedUrl } = await import('../lib/api')
          const presigned = await getPresignedUrl(groupId, receiptFile.type)
          await fetch(presigned.uploadUrl, { method: 'PUT', headers: { 'Content-Type': receiptFile.type }, body: receiptFile })
          finalReceiptUrl = presigned.publicUrl
        } catch { /* S3 not available in local dev — continue without */ }
      }

      await apiUpdateContribution(groupId, contribution.contributionId, { amount: parseFloat(amount), date, receiptImageUrl: finalReceiptUrl })
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-panel" onClick={e => e.stopPropagation()}>
        <h3 className="dialog-panel__title">Editar aporte</h3>
        <p className="dialog-panel__subtitle">Miembro: {contribution.memberName}</p>
        {error && <p className="dialog-panel__error">{error}</p>}
        <form onSubmit={handleSave} className="dialog-panel__form">
          <MoneyInput value={amount} onChange={setAmount} placeholder="Monto" required />
          <DatePicker value={date} onChange={setDate} max={new Date().toISOString().split('T')[0]} placeholder="Fecha" required />

          {/* Receipt upload — compact */}
          <div className="dialog-panel__receipt">
            {receiptPreview ? (
              <div className="dialog-panel__receipt-preview">
                <img src={receiptPreview} alt="Comprobante" />
                <button type="button" className="dialog-panel__receipt-remove" onClick={() => { setReceiptFile(null); setReceiptPreview(null) }}>×</button>
              </div>
            ) : (
              <label className="dialog-panel__receipt-upload">
                <span>📎 {contribution.receiptImageUrl ? 'Reemplazar comprobante' : 'Adjuntar comprobante'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          <div className="dialog-panel__actions">
            <button type="submit" className="btn btn--primary" disabled={saving || !hasChanges} style={{ flex: 1 }}>{saving ? '...' : 'Guardar cambios'}</button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PendingBanner({ contributions, personName, selectedMonth, progress }) {
  // Determine which months the person has contributed
  const personContribs = contributions.filter(c => c.memberName === personName)
  const personMonths = new Set(personContribs.map(c => {
    const d = new Date(c.date + 'T00:00:00')
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }))

  // Get all months that have any contribution in the group
  const allMonths = [...new Set(contributions.map(c => {
    const d = new Date(c.date + 'T00:00:00')
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }))].sort()

  // Find missing months
  const missing = allMonths.filter(m => !personMonths.has(m))

  if (selectedMonth) {
    if (personMonths.has(selectedMonth)) return null
    const label = formatMonthKey(selectedMonth)
    return <div className="dashboard__pending-banner">{personName} está pendiente en <strong>{label}</strong></div>
  }

  if (missing.length === 0) {
    return <div className="dashboard__pending-banner dashboard__pending-banner--ok">{personName} está al día en todos sus aportes.</div>
  }

  return (
    <div className="dashboard__pending-banner">
      <span>{personName} está pendiente en:</span>
      <div className="dashboard__pending-months">
        {missing.map(m => <span key={m} className="dashboard__pending-chip">{formatMonthKey(m)}</span>)}
      </div>
    </div>
  )
}

function formatMonthKey(key) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

function formatDate(dateStr) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }

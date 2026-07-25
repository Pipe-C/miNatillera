import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { listMembers, registerContribution, generateIdempotencyKey, getStoredMemberId, getPresignedUrl } from '../lib/api'
import MoneyInput from '../components/MoneyInput'
import DatePicker from '../components/DatePicker'
import ProgressRing from '../components/ProgressRing'
import './Contribute.css'

export default function Contribute() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [memberId, setMemberId] = useState(getStoredMemberId() || '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)

  useEffect(() => {
    listMembers(groupId)
      .then(data => setMembers(data.members || []))
      .catch(() => {})
  }, [groupId])

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar 5MB.')
      return
    }
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!memberId || !amount || !date) return

    setLoading(true)
    setError(null)

    const idempotencyKey = generateIdempotencyKey()
    let receiptImageUrl = null

    try {
      // Upload receipt to S3 if file selected
      if (receiptFile) {
        try {
          const presigned = await getPresignedUrl(groupId, receiptFile.type)
          await fetch(presigned.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': receiptFile.type },
            body: receiptFile
          })
          receiptImageUrl = presigned.publicUrl
        } catch (uploadErr) {
          // S3 upload failed (may not be available in local dev) — continue without receipt
          console.warn('Receipt upload skipped:', uploadErr.message)
          // Note: receipt won't be saved but contribution will still register
        }
      }

      const res = await registerContribution(groupId, {
        memberId,
        amount,
        date,
        idempotencyKey,
        receiptImageUrl
      })

      setResult(res)
    } catch (err) {
      setError(err.message || 'No se pudo registrar el aporte.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="contribute">
        <div className="contribute__success">
          <div className="contribute__success-icon">✓</div>
          <p className="contribute__success-title">Aporte registrado</p>
          <span className="contribute__success-amount mono">
            +{formatMoney(result.amount)}
          </span>
          {result.group && (
            <>
              <ProgressRing
                percent={result.group.progressPercent}
                amount={result.group.accumulatedAmount}
                goal={result.group.goalAmount}
                size="sm"
              />
              <p className="contribute__success-progress">
                {result.group.status === 'COMPLETADO'
                  ? '¡Meta alcanzada!'
                  : `${result.group.progressPercent}% completado`}
              </p>
            </>
          )}
          <Link to={`/group/${groupId}`} className="btn btn--primary btn--full">
            Volver al grupo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="contribute">
      <Link to={`/group/${groupId}`} className="contribute__back">
        ← Volver
      </Link>
      <h1 className="contribute__title">Registrar aporte</h1>

      {error && <p className="contribute__error" role="alert">{error}</p>}

      <form className="contribute__form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="contrib-member">Miembro</label>
          <select
            id="contrib-member"
            className="contribute__select"
            value={memberId}
            onChange={e => setMemberId(e.target.value)}
            required
          >
            <option value="">Seleccionar miembro</option>
            {members.map(m => (
              <option key={m.memberId} value={m.memberId}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="contrib-amount">Monto (COP)</label>
          <MoneyInput
            id="contrib-amount"
            value={amount}
            onChange={setAmount}
            placeholder="50.000"
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="contrib-date">Fecha del aporte</label>
          <DatePicker
            id="contrib-date"
            value={date}
            onChange={setDate}
            max={todayISO()}
            placeholder="dd/mm/aaaa"
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="contrib-receipt">Comprobante (opcional)</label>
          <div className="contribute__upload">
            {receiptPreview ? (
              <div className="contribute__preview">
                <img src={receiptPreview} alt="Comprobante" className="contribute__preview-img" />
                <button type="button" className="contribute__preview-remove" onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}>×</button>
              </div>
            ) : (
              <label htmlFor="contrib-receipt" className="contribute__upload-label">
                <span>📎 Adjuntar imagen</span>
                <span className="contribute__upload-hint">JPG, PNG o WebP — máx 5MB</span>
              </label>
            )}
            <input
              id="contrib-receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="contribute__upload-input"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar aporte'}
        </button>
      </form>
    </div>
  )
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function formatMoney(value) {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num)
}

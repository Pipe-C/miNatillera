import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'

/**
 * Excel import component for bulk contribution registration.
 * Parses .xlsx in the browser, shows preview table, lets user confirm.
 * Uses dynamic import of 'xlsx' to avoid bloating the main bundle.
 */
export default function ExcelImport({ members, groupId, onImportComplete }) {
  const [rows, setRows] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.xlsx')) {
      setError('Solo se aceptan archivos .xlsx')
      return
    }
    setParsing(true)
    setError(null)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(sheet)

      if (data.length === 0) {
        setError('El archivo está vacío.')
        setParsing(false)
        return
      }
      if (data.length > 200) {
        setError('Máximo 200 filas permitidas.')
        setParsing(false)
        return
      }

      // Validate expected columns with intelligent mapping
      const first = data[0]
      const colKeys = Object.keys(first)

      // Column synonyms mapping
      const nameAliases = ['nombre', 'cliente', 'persona', 'participante', 'socio', 'miembro']
      const amountAliases = ['monto', 'valor', 'aporte', 'pago', 'cantidad', 'importe']
      const dateAliases = ['fecha', 'día', 'dia', 'registro', 'date']

      function findColumn(aliases) {
        return colKeys.find(k => aliases.includes(k.toLowerCase().trim()))
      }

      const nameCol = findColumn(nameAliases)
      const amountCol = findColumn(amountAliases)
      const dateCol = findColumn(dateAliases)

      const missing = []
      if (!nameCol) missing.push('Nombre')
      if (!amountCol) missing.push('Monto')
      if (!dateCol) missing.push('Fecha')

      if (missing.length > 0) {
        setError(`No se encontraron las columnas: ${missing.join(', ')}. Columnas detectadas: ${colKeys.join(', ')}`)
        setParsing(false)
        return
      }

      // Process rows using detected column names
      const processed = data.map((row, i) => {
        const name = String(row[nameCol] || '').trim()
        const monto = parseFloat(String(row[amountCol] || '').replace(/[^0-9.-]/g, ''))
        const fecha = parseDate(row[dateCol])
        const member = members.find(m => m.name.toLowerCase() === name.toLowerCase())
        return {
          index: i,
          name,
          amount: isNaN(monto) ? null : monto,
          date: fecha,
          memberId: member?.memberId || null,
          memberExists: !!member,
          valid: name.length > 0 && !isNaN(monto) && monto > 0 && fecha !== null
        }
      })
      setRows(processed)
    } catch (err) {
      setError('Error al leer el archivo: ' + err.message)
    }
    setParsing(false)
  }

  async function handleConfirm() {
    if (!rows) return
    setImporting(true)
    setError(null)
    const { registerContribution, addMember, generateIdempotencyKey } = await import('../lib/api')

    const importResults = []
    for (const row of rows.filter(r => r.valid)) {
      try {
        let memberId = row.memberId
        if (!memberId) {
          // Create member if doesn't exist
          const newMember = await addMember(groupId, row.name)
          memberId = newMember.memberId
        }
        await registerContribution(groupId, {
          memberId,
          amount: String(row.amount),
          date: row.date,
          idempotencyKey: generateIdempotencyKey()
        })
        importResults.push({ ...row, status: 'ok' })
      } catch (err) {
        importResults.push({ ...row, status: 'error', error: err.message })
      }
    }
    setResults(importResults)
    setImporting(false)
    if (onImportComplete) onImportComplete()
  }

  if (results) {
    const ok = results.filter(r => r.status === 'ok').length
    const fail = results.filter(r => r.status === 'error').length
    return (
      <div className="excel-import__results">
        <p className="excel-import__summary">
          ✓ {ok} aportes importados{fail > 0 ? `, ${fail} fallaron` : ''}
        </p>
        <button className="btn btn--primary" onClick={() => { setRows(null); setResults(null); }}>
          Cerrar
        </button>
      </div>
    )
  }

  if (rows) {
    const validCount = rows.filter(r => r.valid).length
    return (
      <div className="excel-import__preview">
        <h3 className="excel-import__title">Vista previa ({validCount} válidos de {rows.length})</h3>
        <div className="excel-import__table-wrap">
          <table className="excel-import__table">
            <thead>
              <tr><th>Nombre</th><th>Fecha</th><th>Monto</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.index} className={row.valid ? '' : 'excel-import__row--invalid'}>
                  <td>{row.name || '—'}</td>
                  <td>{row.date || 'Inválida'}</td>
                  <td className="mono">{row.amount ? `$${row.amount.toLocaleString()}` : 'Inválido'}</td>
                  <td>{row.valid ? (row.memberExists ? '✓' : '⚠ Nuevo') : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.some(r => r.valid && !r.memberExists) && (
          <p className="excel-import__warn">⚠ Se crearán miembros nuevos para los nombres no encontrados.</p>
        )}
        <div className="excel-import__actions">
          <button className="btn btn--secondary" onClick={() => setRows(null)}>Cancelar</button>
          <button className="btn btn--primary" onClick={handleConfirm} disabled={importing || validCount === 0}>
            {importing ? 'Importando...' : `Importar ${validCount} aportes`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="excel-import">
      {error && <p className="excel-import__error">{error}</p>}
      <label className="excel-import__upload-label">
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{parsing ? 'Leyendo...' : <><FileSpreadsheet size={16} /> Importar desde Excel</>}</span>
        <span className="excel-import__hint">Archivo .xlsx con columnas: Nombre, Fecha, Monto</span>
        <input type="file" accept=".xlsx" onChange={handleFile} disabled={parsing} style={{ display: 'none' }} />
      </label>
    </div>
  )
}

function parseDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  }
  const d = new Date(val)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

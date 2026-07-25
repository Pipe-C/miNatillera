import { useState } from 'react'
import { Download } from 'lucide-react'

/**
 * Exports group data as a multi-sheet .xlsx file.
 * Dynamic imports xlsx to avoid bundling in main chunk.
 */
export default function ExportXlsx({ progress, contributions, members, disabled }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (disabled || exporting) return
    setExporting(true)
    try {
      const XLSX = await import('xlsx')

      // Sheet 1: Summary
      const summaryData = [
        ['Grupo', progress.name],
        ['Monto Meta', progress.goalAmount ? Number(progress.goalAmount) : 'Sin definir'],
        ['Monto Acumulado', Number(progress.accumulatedAmount)],
        ['Faltante', progress.remainingAmount ? Number(progress.remainingAmount) : 'N/A'],
        ['Progreso', progress.goalAmount ? `${progress.progressPercent}%` : 'Sin meta'],
        ['Miembros', progress.memberCount],
        ['Fecha Objetivo', progress.targetDate],
        ['Estado', progress.status],
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)

      // Sheet 2: All contributions (raw detail)
      const contribHeaders = ['Nombre', 'Fecha', 'Monto', 'Comprobante']
      const contribRows = contributions.map(c => [
        c.memberName || 'Desconocido',
        c.date,
        Number(c.amount),
        c.receiptImageUrl ? 'Sí' : 'No'
      ])
      const contribSheet = XLSX.utils.aoa_to_sheet([contribHeaders, ...contribRows])
      // Format money column as numbers
      const range1 = XLSX.utils.decode_range(contribSheet['!ref'] || 'A1')
      for (let r = 1; r <= range1.e.r; r++) {
        const cell = contribSheet[XLSX.utils.encode_cell({ r, c: 2 })]
        if (cell) cell.t = 'n'
      }

      // Sheet 3: Per-member summary with monthly breakdown
      const memberMap = {}
      const monthSet = new Set()
      contributions.forEach(c => {
        const name = c.memberName || 'Desconocido'
        const d = new Date(c.date + 'T00:00:00')
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthSet.add(monthKey)
        if (!memberMap[name]) memberMap[name] = { total: 0, months: {} }
        memberMap[name].total += Number(c.amount)
        memberMap[name].months[monthKey] = (memberMap[name].months[monthKey] || 0) + Number(c.amount)
      })

      const sortedMonths = [...monthSet].sort()
      const monthLabels = sortedMonths.map(m => {
        const [y, mo] = m.split('-')
        const d = new Date(parseInt(y), parseInt(mo) - 1, 1)
        return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
      })

      const pivotHeaders = ['Miembro', 'Total aportado', ...monthLabels]
      const pivotRows = Object.entries(memberMap).map(([name, data]) => [
        name,
        data.total,
        ...sortedMonths.map(m => data.months[m] || 0)
      ])
      const pivotSheet = XLSX.utils.aoa_to_sheet([pivotHeaders, ...pivotRows])
      // Format number columns
      const range2 = XLSX.utils.decode_range(pivotSheet['!ref'] || 'A1')
      for (let r = 1; r <= range2.e.r; r++) {
        for (let c = 1; c <= range2.e.c; c++) {
          const cell = pivotSheet[XLSX.utils.encode_cell({ r, c })]
          if (cell) cell.t = 'n'
        }
      }

      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen')
      XLSX.utils.book_append_sheet(wb, contribSheet, 'Aportes')
      XLSX.utils.book_append_sheet(wb, pivotSheet, 'Por miembro')

      // Download
      const filename = sanitizeFilename(progress.name) + '-natillera.xlsx'
      XLSX.writeFile(wb, filename)
    } catch (err) {
      console.error('Export failed:', err)
    }
    setExporting(false)
  }

  return (
    <button className="btn btn--secondary" onClick={handleExport} disabled={exporting || disabled} title={disabled ? 'Registrá al menos un aporte para exportar' : ''}>
      {exporting ? 'Generando...' : <><Download size={16} /> Descargar Excel</>}
    </button>
  )
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 50)
}

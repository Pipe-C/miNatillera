import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function MonthlyChart({ contributions }) {
  // Extract available years
  const years = useMemo(() => {
    const set = new Set(contributions.map(c => new Date(c.date + 'T00:00:00').getFullYear()))
    return [...set].sort().reverse()
  }, [contributions])

  const [selectedYear, setSelectedYear] = useState(years[0] || new Date().getFullYear())

  const data = useMemo(() => {
    const map = {}
    contributions.forEach(c => {
      const d = new Date(c.date + 'T00:00:00')
      if (d.getFullYear() !== selectedYear) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-CO', { month: 'short' })
      if (!map[key]) map[key] = { month: label, total: 0, key }
      map[key].total += parseFloat(c.amount)
    })
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
  }, [contributions, selectedYear])

  const maxMonth = data.reduce((max, d) => d.total > (max?.total || 0) ? d : max, null)

  if (data.length === 0) return null

  return (
    <div className="monthly-chart">
      <div className="monthly-chart__header">
        <span className="micro-label">Aportes por mes</span>
        <div className="monthly-chart__controls">
          {maxMonth && <span className="monthly-chart__best">Mejor: <strong>{maxMonth.month}</strong></span>}
          {years.length > 1 && (
            <select className="monthly-chart__year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--color-text-primary)' }}
            itemStyle={{ color: 'var(--color-accent)' }}
            formatter={(value) => [formatCOP(String(value)), 'Total']}
            cursor={{ fill: 'rgba(124,92,252,0.08)' }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} animationDuration={800} animationBegin={100}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.key === maxMonth?.key ? '#7C5CFC' : '#9478FF'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatCOP(value) {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
}

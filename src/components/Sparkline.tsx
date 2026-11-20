import type { PricePoint } from '../lib/types'

export function Sparkline({
  points,
  color = '#0E7C6B',
  width = 86,
  height = 30,
}: {
  points: PricePoint[]
  color?: string
  width?: number
  height?: number
}) {
  if (points.length < 2) return null
  const values = points.map((p) => p.price)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (points.length - 1)
  const coords = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)])
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const id = `sp-${color.replace('#', '')}-${width}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
}

export default function Sparkline({ values, width = 96, height = 30 }: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1={4} x2={width - 4} y1={height / 2} y2={height / 2} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="3 3" />
      </svg>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 4
  const points = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return [x, y] as const
  })
  const line = points.map((p) => p.join(',')).join(' ')
  const area = `M${points[0][0]},${height} L${line.replace(/ /g, ' L')} L${points[points.length - 1][0]},${height} Z`
  const last = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={area} fill="var(--indigo-500)" opacity={0.12} />
      <polyline points={line} fill="none" stroke="var(--indigo-600)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill="var(--indigo-600)" />
    </svg>
  )
}

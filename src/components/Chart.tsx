import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export const palette = ['#0E7C6B', '#3B6FF5', '#E5484D', '#8B5CF6', '#F59E0B', '#0EA5E9']

export const baseTheme = {
  textStyle: {
    fontFamily: '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    color: '#64748B',
  },
  grid: { left: 8, right: 12, top: 28, bottom: 4, containLabel: true },
  tooltip: {
    backgroundColor: 'rgba(10, 18, 32, 0.94)',
    borderWidth: 0,
    padding: [10, 12],
    textStyle: { color: '#E6EDF7', fontSize: 12 },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(10,18,32,.18);',
  },
  axisLabel: { color: '#8A97A8', fontSize: 11 },
  axisLine: { lineStyle: { color: '#E6EAF0' } },
  splitLine: { lineStyle: { color: '#EEF1F6', type: [3, 4] } },
}

export function Chart({
  option,
  height = 280,
  className,
}: {
  option: echarts.EChartsOption
  height?: number | string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inst = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    inst.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      chart.dispose()
      inst.current = null
    }
  }, [])

  useEffect(() => {
    inst.current?.setOption(option, true)
  }, [option])

  return <div ref={ref} className={className} style={{ height, width: '100%' }} />
}

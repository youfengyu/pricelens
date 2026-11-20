import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { Chart, baseTheme, palette } from '../components/Chart'
import { PageHead, Skeleton, ErrorNote } from '../components/PageHead'
import { useJson, useHashQuery } from '../lib/data'
import { yuan } from '../lib/format'
import type { FlightsData } from '../lib/types'

export function Flights() {
  const { data, error } = useJson<FlightsData>('flights')
  const [routeId, setRouteId] = useState<string | null>(null)
  const [dateSel, setDateSel] = useState<string | null>(null)

  // 支持从搜索页深链跳转：#/flights?r=pek-sha&d=2026-11-25
  const query = useHashQuery()
  const deepRoute = query.get('r')
  const deepDate = query.get('d')
  useEffect(() => {
    if (deepRoute && data?.routes.some((r) => r.id === deepRoute)) setRouteId(deepRoute)
    if (deepDate) setDateSel(deepDate)
  }, [deepRoute, deepDate, data])

  const route = data?.routes.find((r) => r.id === routeId) ?? data?.routes[0]
  const cells = data?.calendar.filter((c) => c.routeId === route?.id) ?? []
  const cheapest = cells.reduce((a, b) => (b.minPrice < a.minPrice ? b : a), cells[0])
  const activeDate = cells.find((c) => c.date === dateSel) ?? cheapest

  const routeOffers = data?.offers.filter((o) => o.routeId === route?.id) ?? []
  const dayOffers = routeOffers.filter((o) => o.date === activeDate?.date).sort((a, b) => a.price - b.price)

  const trendOption = useMemo<EChartsOption>(() => {
    const dates = data?.dates ?? []
    const minSeries = dates.map((d) => {
      const list = routeOffers.filter((o) => o.date === d.full)
      return list.length ? Math.min(...list.map((o) => o.price)) : null
    })
    const avgSeries = dates.map((d) => {
      const list = routeOffers.filter((o) => o.date === d.full)
      return list.length ? Math.round(list.reduce((a, b) => a + b.price, 0) / list.length) : null
    })
    return {
      ...baseTheme,
      grid: { left: 4, right: 12, top: 36, bottom: 0, containLabel: true },
      tooltip: {
        ...baseTheme.tooltip,
        trigger: 'axis',
        valueFormatter: (v) => (v == null ? '—' : yuan(Number(v))),
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 3,
        textStyle: { color: '#5C6B7F', fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: dates.map((d) => d.date),
        boundaryGap: false,
        axisTick: { show: false },
        axisLabel: { interval: 1 },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitNumber: 3,
        axisLabel: { formatter: (v: number) => `${v}` },
      },
      series: [
        {
          name: '当日最低价',
          type: 'line',
          data: minSeries,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { width: 2, color: palette[0] },
          itemStyle: { color: palette[0] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(14,124,107,0.18)' },
                { offset: 1, color: 'rgba(14,124,107,0)' },
              ],
            },
          },
          markPoint: {
            symbol: 'pin',
            symbolSize: 34,
            symbolOffset: [0, -14],
            itemStyle: { color: '#0B1220' },
            label: { color: '#fff', fontSize: 9.5, formatter: '低价' },
            data: [{ type: 'min', name: '最低价' }],
          },
        },
        {
          name: '当日均价',
          type: 'line',
          data: avgSeries,
          smooth: 0.3,
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#9FB0C5', type: 'dashed' },
        },
      ],
    }
  }, [data, routeOffers])

  const carrierOption = useMemo<EChartsOption>(() => {
    const list = [...dayOffers].sort((a, b) => a.price - b.price)
    return {
      ...baseTheme,
      grid: { left: 4, right: 52, top: 8, bottom: 0, containLabel: true },
      tooltip: {
        ...baseTheme.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => yuan(Number(v)),
      },
      xAxis: { type: 'value', show: false, max: (list[list.length - 1]?.price ?? 1000) * 1.18 },
      yAxis: {
        type: 'category',
        data: list.map((o) => o.carrier).reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#41506A', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          barWidth: 13,
          data: [...list].reverse().map((o, i) => ({
            value: o.price,
            itemStyle: {
              color: i === list.length - 1 ? '#0E7C6B' : '#C9D6E4',
              borderRadius: 6,
            },
          })),
          label: {
            show: true,
            position: 'right',
            formatter: (p) => yuan(Number(p.value)),
            color: '#41506A',
            fontSize: 11,
            fontWeight: 600,
          },
        },
      ],
    }
  }, [dayOffers])

  if (error) return <ErrorNote message={error} />
  if (!data || !route || !activeDate) return <Skeleton height={560} />

  const offset = (new Date(data.dates[0].full + 'T00:00:00').getDay() + 6) % 7

  return (
    <>
      <PageHead
        eyebrow="Flight fares"
        title="机票比价"
        desc="未来 14 天低价日历、航司横向比价与价格趋势，帮助锁定最省钱的出发日期。"
        meta={`更新于 ${data.updatedAt} · ${data.routes.length} 条航线`}
        actions={<span className="badge green">已接入携程 / 飞猪 / 去哪儿演示数据</span>}
      />

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="chips">
            {data.routes.map((r) => {
              const low = data.calendar
                .filter((c) => c.routeId === r.id)
                .reduce((a, b) => (b.minPrice < a.minPrice ? b : a)).minPrice
              return (
                <button
                  key={r.id}
                  className={`chip ${route.id === r.id ? 'active' : ''}`}
                  onClick={() => {
                    setRouteId(r.id)
                    setDateSel(null)
                  }}
                >
                  {r.from} → {r.to}
                  <span style={{ opacity: 0.66, fontWeight: 500 }}>{yuan(low)}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="toolbar-right">
          <span className="legend">
            <span><i style={{ background: '#E9F8F1' }} />低价</span>
            <span><i style={{ background: '#F4FAF6' }} />较低</span>
            <span><i style={{ background: '#FFF8EC' }} />偏高</span>
            <span><i style={{ background: '#FDF0F0' }} />高价</span>
          </span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <p className="card-title">{route.from} → {route.to} · 低价日历</p>
            <p className="card-sub">点击日期查看当日航班，颜色按该航线价格分位计算</p>
          </div>
          <span className="badge ink">最低 {yuan(cheapest.minPrice)} · {cheapest.dateShort}</span>
        </div>
        <div className="cal-head">
          {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="calendar">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {cells.map((c) => (
            <button
              key={c.date}
              className={`cal-cell lv${c.level} ${c.date === activeDate.date ? 'active' : ''}`}
              onClick={() => setDateSel(c.date)}
            >
              <span className="cal-week">
                <span>{c.weekday}</span>
                {c.minPrice === cheapest.minPrice && <span>最低</span>}
              </span>
              <span className="cal-date">{c.dateShort}</span>
              <span className="cal-price">{yuan(c.minPrice)}</span>
              <span className="cal-tag">{c.level === 0 ? '建议入手' : c.level === 3 ? '价格高位' : '观望'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid split-57" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">价格趋势</p>
              <p className="card-sub">当日最低价与均价对比，临近出发通常上行</p>
            </div>
            <span className="badge">{route.code}</span>
          </div>
          <Chart option={trendOption} height={250} />
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">航司比价</p>
              <p className="card-sub">{activeDate.dateShort} · 经济舱含税价</p>
            </div>
            <span className="badge green">{dayOffers.length} 个航班</span>
          </div>
          <Chart option={carrierOption} height={250} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <p className="card-title">{activeDate.dateShort} 航班明细</p>
            <p className="card-sub">{route.from} → {route.to} · 直飞 · 按价格排序</p>
          </div>
          <span className="badge ink">最低 {yuan(dayOffers[0]?.price ?? 0)}</span>
        </div>
        <div>
          {dayOffers.map((o, i) => (
            <div className="flight-row" key={o.flightNo}>
              <div className="carrier">
                <span className="carrier-logo" style={{ background: palette[i % palette.length] }}>
                  {o.carrierCode}
                </span>
                <div>
                  <b>{o.carrier}</b>
                  <em>{o.flightNo} · {o.aircraft}</em>
                </div>
              </div>
              <div className="times">
                <div>
                  <b>{o.dep}</b>
                  <span style={{ display: 'block' }}>出发</span>
                </div>
                <div>
                  <span>直飞</span>
                  <i />
                  <span>2h 10m</span>
                </div>
                <div>
                  <b>{o.arr}</b>
                  <span style={{ display: 'block' }}>到达</span>
                </div>
              </div>
              <span className={`badge ${i === 0 ? 'green' : ''}`}>
                {i === 0 ? '全场最低' : `余 ${o.seats} 座`}
              </span>
              <div className="flight-price">
                <b>{yuan(o.price)}</b>
                <em>含税 · 经济舱</em>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

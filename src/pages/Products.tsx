import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { Chart, baseTheme, palette } from '../components/Chart'
import { PageHead, Skeleton, ErrorNote } from '../components/PageHead'
import { Sparkline } from '../components/Sparkline'
import { useJson, useHashQuery } from '../lib/data'
import { pct, yuan, dir } from '../lib/format'
import type { ProductsData } from '../lib/types'

const brandColors: Record<string, string> = {
  京东: '#E5484D',
  天猫: '#F59E0B',
  拼多多: '#EF6C4D',
  苏宁: '#2F5FE0',
}

const categories = ['全部', '智能穿戴', '食品生鲜', '电脑办公', '手机通讯']

export function Products() {
  const { data, error } = useJson<ProductsData>('products')
  const [category, setCategory] = useState('全部')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [subscribed, setSubscribed] = useState(false)

  const products = data?.products ?? []
  const list = category === '全部' ? products : products.filter((p) => p.category === category)
  const current = products.find((p) => p.id === selectedId) ?? list[0] ?? products[0]

  // 支持从搜索页深链跳转：#/products?p=item-id
  const query = useHashQuery()
  const deepId = query.get('p')
  useEffect(() => {
    if (deepId && products.some((p) => p.id === deepId)) {
      setSelectedId(deepId)
      setCategory('全部')
    }
  }, [deepId, products])

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!current) return null
    const dates = current.platforms[0].history.map((h) => h.date)
    const all = current.platforms.flatMap((p) => p.history.map((h) => h.price))
    const min = Math.min(...all)
    const max = Math.max(...all)
    return {
      ...baseTheme,
      grid: { left: 4, right: 12, top: 40, bottom: 0, containLabel: true },
      tooltip: {
        ...baseTheme.tooltip,
        trigger: 'axis',
        valueFormatter: (v) => yuan(Number(v)),
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 3,
        itemGap: 14,
        textStyle: { color: '#5C6B7F', fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisTick: { show: false },
        axisLabel: { interval: 4 },
      },
      yAxis: {
        type: 'value',
        min: Math.floor(min * 0.97),
        max: Math.ceil(max * 1.02),
        scale: true,
        splitNumber: 3,
        axisLabel: {
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`),
        },
      },
      series: current.platforms.map((p, i) => ({
        name: p.platform,
        type: 'line',
        data: p.history.map((h) => h.price),
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        emphasis: { focus: 'series' as const },
        lineStyle: { width: 2, color: palette[i] },
        itemStyle: { color: palette[i] },
      })),
    }
  }, [current])

  if (error) return <ErrorNote message={error} />
  if (!data || !current) return <Skeleton height={560} />

  const lowest = current.platforms.reduce((a, b) => (b.finalPrice < a.finalPrice ? b : a))
  const lowestRow = current.platforms.find((p) => p.platform === current.lowestPlatform) ?? lowest
  const min30 = Math.min(...current.platforms.map((p) => p.min30))
  const max30 = Math.max(...current.platforms.map((p) => p.max30))

  return (
    <>
      <PageHead
        eyebrow="Products"
        title="商品比价"
        desc="华为手环 11、伊利金典牛奶、联想电脑、苹果手机的多平台实时价格与 30 天历史走势。"
        meta={`更新于 ${data.updatedAt}`}
        actions={
          <button
            className={`btn ${subscribed ? '' : 'primary'}`}
            onClick={() => setSubscribed((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" strokeLinejoin="round" />
              <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
            </svg>
            {subscribed ? '已订阅降价提醒' : '订阅降价提醒'}
          </button>
        }
      />

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="chips">
            {categories.map((c) => (
              <button
                key={c}
                className={`chip ${category === c ? 'active' : ''}`}
                onClick={() => {
                  setCategory(c)
                  setSelectedId(null)
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-right">
          <span className="legend">
            <span><i style={{ background: '#0E9F6E' }} />较昨日降价</span>
            <span><i style={{ background: '#E5484D' }} />较昨日涨价</span>
          </span>
        </div>
      </div>

      <div className="product-grid">
        {list.map((p) => (
          <button
            key={p.id}
            className={`product-card ${current.id === p.id ? 'active' : ''}`}
            onClick={() => setSelectedId(p.id)}
          >
            <img src={p.image} alt={p.name} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            <div className="product-info">
              <b>{p.name}</b>
              <em>{p.spec}</em>
              <div className="product-price">
                <b>{yuan(p.lowestPrice)}</b>
                <span>{p.lowestPlatform}最低</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="detail-head">
          <div className="detail-title">
            <img src={current.image} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            <div>
              <b>{current.name}</b>
              <span>{current.spec} · {current.category}</span>
            </div>
            <span className="badge green">{current.lowestPlatform} 最低价</span>
            {current.tags.slice(1).map((t) => (
              <span className="badge" key={t}>{t}</span>
            ))}
          </div>
          <Sparkline points={lowestRow.history} width={150} height={38} color="#0E7C6B" />
        </div>

        <div className="grid split-57">
          <div>
            <div className="card-head" style={{ marginBottom: 8 }}>
              <div>
                <p className="card-title">多平台到手价</p>
                <p className="card-sub">到手价 = 标价 − 优惠券，含当前库存状态</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>平台</th>
                    <th className="num">标价</th>
                    <th className="num">优惠券</th>
                    <th className="num">到手价</th>
                    <th className="num">日变动</th>
                  </tr>
                </thead>
                <tbody>
                  {current.platforms.map((p) => (
                    <tr key={p.platform} className={p.finalPrice === lowest.finalPrice ? 'lowest-row' : ''}>
                      <td>
                        <span className="platform" style={{ color: brandColors[p.platform] ?? '#334155' }}>
                          <i />
                          {p.platform}
                        </span>
                        <span className="shop">{p.shop}</span>
                      </td>
                      <td className="num">{yuan(p.price)}</td>
                      <td className="num">{p.coupon ? `−${yuan(p.coupon)}` : '—'}</td>
                      <td className="num strong">{yuan(p.finalPrice)}</td>
                      <td className="num">
                        <span className={`delta ${dir(p.change)}`}>{pct(p.change)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="notice" style={{ marginTop: 12 }}>
              <span>
                <b>比价结论：</b>在 {current.platforms.length} 个平台中，{lowest.platform} 到手价
                {yuan(lowest.finalPrice)} 最低，与最高价平台相差 {yuan(current.spread)}。
              </span>
            </div>
          </div>

          <div>
            <div className="card-head" style={{ marginBottom: 4 }}>
              <div>
                <p className="card-title">{current.name} · 30 天价格走势</p>
                <p className="card-sub">按平台记录每日到手价，悬浮查看具体数值</p>
              </div>
              <span className="badge">{data.days} 个数据点</span>
            </div>
            {chartOption && <Chart option={chartOption} height={252} />}
          </div>
        </div>

        <div className="stat-strip">
          <div>
            <em>30 天最低价</em>
            <b>{yuan(min30)}</b>
          </div>
          <div>
            <em>30 天最高价</em>
            <b>{yuan(max30)}</b>
          </div>
          <div>
            <em>平台价差</em>
            <b>{yuan(current.spread)}</b>
          </div>
          <div>
            <em>当前最低较昨日</em>
            <b className={`delta ${dir(lowest.change)}`} style={{ fontSize: 17 }}>{pct(lowest.change)}</b>
          </div>
        </div>
      </div>
    </>
  )
}

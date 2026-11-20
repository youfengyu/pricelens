import { useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { Chart, baseTheme, palette } from '../components/Chart'
import { PageHead, Skeleton, ErrorNote } from '../components/PageHead'
import { Sparkline } from '../components/Sparkline'
import { useJson, useHashQuery } from '../lib/data'
import { yuan, pct, dir } from '../lib/format'
import type { ProductsData, MoviesData, FlightsData, Product } from '../lib/types'

const HOT = ['华为手环', '苹果', '牛奶', '联想', '深海回声', '万达', '北京', '上海', '低价机票']

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')

function hit(text: (string | number)[], keyword: string) {
  if (!keyword) return true
  return normalize(text.join(' ')).includes(normalize(keyword))
}

const cheapestPlatform = (p: Product) =>
  p.platforms.reduce((a, b) => (b.finalPrice < a.finalPrice ? b : a))

export function Search() {
  const products = useJson<ProductsData>('products')
  const movies = useJson<MoviesData>('movies')
  const flights = useJson<FlightsData>('flights')
  const query = useHashQuery()
  const [keyword, setKeyword] = useState(() => query.get('q') ?? '')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  const error = products.error || movies.error || flights.error
  const loading = !products.data || !movies.data || !flights.data

  const productList = products.data?.products ?? []
  const movieList = movies.data?.movies ?? []
  const cinemaList = movies.data?.cinemas ?? []
  const routeList = flights.data?.routes ?? []

  const k = keyword.trim()
  const productHits = productList.filter((p) =>
    hit([p.name, p.category, p.spec, p.id, ...p.tags, ...p.platforms.map((x) => `${x.platform}${x.shop}`)], k)
  )

  const movieHits = k ? movieList.filter((m) => hit([m.title, m.genre, m.id], k)) : []

  const cinemaHits = k
    ? cinemaList.filter((c) => hit([c.name, c.brand, c.district], k))
    : []

  const routeHits = k
    ? routeList.filter((r) => hit([r.from, r.to, r.code, r.id], k))
    : []

  const movieMin = (movieId: string) => {
    const offers = movies.data?.offers.filter((o) => o.movieId === movieId) ?? []
    if (!offers.length) return null
    return offers.reduce((a, b) => (b.price < a.price ? b : a))
  }

  const cinemaMin = (cinemaName: string) => {
    const offers = movies.data?.offers.filter((o) => o.cinema === cinemaName) ?? []
    if (!offers.length) return null
    return offers.reduce((a, b) => (b.price < a.price ? b : a))
  }

  const routeMin = (routeId: string) => {
    const cells = flights.data?.calendar.filter((c) => c.routeId === routeId) ?? []
    if (!cells.length) return null
    return cells.reduce((a, b) => (b.minPrice < a.minPrice ? b : a))
  }

  const totalHits =
    productHits.length + movieHits.length + cinemaHits.length + routeHits.length

  const toggleCompare = (id: string) => {
    setNotice('')
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) {
        setNotice('最多同时对比 3 个商品，先移除一个再添加')
        return prev
      }
      return [...prev, id]
    })
  }

  const picked = compareIds
    .map((id) => productList.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))

  const compareOption = useMemo<EChartsOption | null>(() => {
    if (picked.length < 2) return null
    const series = picked.map((p) => {
      const pl = cheapestPlatform(p)
      return { name: p.name, history: pl.history, base: pl.history[0]?.price ?? 0 }
    })
    const dates = [...new Set(series.flatMap((s) => s.history.map((h) => h.date)))].sort()
    return {
      ...baseTheme,
      grid: { left: 4, right: 14, top: 40, bottom: 0, containLabel: true },
      tooltip: {
        ...baseTheme.tooltip,
        trigger: 'axis',
        valueFormatter: (v) => (v == null ? '—' : `${Number(v).toFixed(1)}`),
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
        scale: true,
        splitNumber: 3,
        axisLabel: { formatter: (v: number) => `${v}` },
      },
      series: series.map((s, i) => {
        const map = new Map(s.history.map((h) => [h.date, s.base ? (h.price / s.base) * 100 : null]))
        return {
          name: s.name,
          type: 'line' as const,
          data: dates.map((d) => (map.has(d) ? Number((map.get(d) as number).toFixed(2)) : null)),
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 4,
          showSymbol: false,
          connectNulls: true,
          emphasis: { focus: 'series' as const },
          lineStyle: { width: 2, color: palette[i] },
          itemStyle: { color: palette[i] },
        }
      }),
    }
  }, [picked])

  if (error) return <ErrorNote message={error} />
  if (loading) return <Skeleton height={560} />

  const best = [...picked].sort((a, b) => a.lowestPrice - b.lowestPrice)[0]

  return (
    <>
      <PageHead
        eyebrow="Search & compare"
        title="搜索比价"
        desc="一次检索商品、影片、影院与航线，选中 2–3 个商品即可按价格指数横向对比 30 天走势。"
        meta={`已索引 ${productList.length} 商品 · ${movieList.length} 影片 · ${cinemaList.length} 影院 · ${routeList.length} 航线`}
        actions={<span className="badge green">跨品类检索</span>}
      />

      <div className="search-panel">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.2 4.2" strokeLinecap="round" />
          </svg>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索商品、影片、影院或航线，如「华为」「深海」「万达」「北京 上海」"
            aria-label="搜索商品、影片、影院或航线"
            autoFocus
          />
          {keyword && (
            <button className="search-clear" onClick={() => setKeyword('')} aria-label="清空">
              ×
            </button>
          )}
          <span className="search-kbd">实时</span>
        </div>
        <div className="hot-row">
          <span>热门搜索</span>
          {HOT.map((h) => (
            <button key={h} className={`hot-chip ${keyword === h ? 'active' : ''}`} onClick={() => setKeyword(h)}>
              {h}
            </button>
          ))}
        </div>
        <p className="search-hint">
          {k
            ? `“${k}” 命中 ${totalHits} 条结果，商品可加入下方对比区`
            : '当前展示全部商品；输入关键词可同时检索影片、影院与航线'}
        </p>
      </div>

      {k && totalHits === 0 && (
        <div className="card search-empty">
          <b>没有找到「{k}」</b>
          <span>换个关键词试试，或点击上方热门搜索。支持商品名称、品类、平台、影片、影院和航线城市。</span>
        </div>
      )}

      {productHits.length > 0 && (
        <section className="card result-block">
          <div className="result-head">
            <p className="card-title">商品 <span>{productHits.length}</span></p>
            <span className="card-sub">到手价 = 标价 − 优惠券</span>
          </div>
          <div className="result-list">
            {productHits.map((p) => {
              const pl = cheapestPlatform(p)
              const on = compareIds.includes(p.id)
              return (
                <div className="result-row" key={p.id}>
                  <span className="result-thumb">
                    <img src={p.image} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                  </span>
                  <div className="result-main">
                    <b>{p.name}</b>
                    <em>{p.category} · {p.spec}</em>
                    <span className="result-tags">
                      {p.platforms.map((x) => (
                        <i key={x.platform}>{x.platform} {yuan(x.finalPrice)}</i>
                      ))}
                    </span>
                  </div>
                  <div className="result-side">
                    <b>{yuan(p.lowestPrice)}</b>
                    <em>{pl.platform}最低 · 价差 {yuan(p.spread)}</em>
                  </div>
                  <Sparkline points={pl.history} width={92} height={30} color={on ? '#0E7C6B' : '#9FB0C5'} />
                  <div className="result-actions">
                    <button
                      className={`btn small ${on ? 'primary' : ''}`}
                      onClick={() => toggleCompare(p.id)}
                      aria-pressed={on}
                    >
                      {on ? '已加入' : '加入对比'}
                    </button>
                    <a className="btn small ghost" href={`#/products?p=${p.id}`}>详情</a>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {movieHits.length > 0 && (
        <section className="card result-block">
          <div className="result-head">
            <p className="card-title">影片 <span>{movieHits.length}</span></p>
            <span className="card-sub">按全城最低票价排序</span>
          </div>
          <div className="result-list">
            {movieHits.map((m) => {
              const min = movieMin(m.id)
              return (
                <div className="result-row" key={m.id}>
                  <span className="result-thumb poster">
                    <img src={m.poster} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                  </span>
                  <div className="result-main">
                    <b>{m.title}</b>
                    <em>{m.genre} · {m.duration} 分钟 · 评分 {m.score.toFixed(1)}</em>
                  </div>
                  <div className="result-side">
                    <b>{min ? yuan(min.price) : '—'}</b>
                    <em>{min ? `${min.city} · ${min.time} 场最低` : '暂无场次'}</em>
                  </div>
                  <div className="result-actions">
                    <a className="btn small ghost" href={`#/movies?m=${m.id}${min ? `&city=${encodeURIComponent(min.city)}` : ''}`}>
                      查影院
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {cinemaHits.length > 0 && (
        <section className="card result-block">
          <div className="result-head">
            <p className="card-title">影院 <span>{cinemaHits.length}</span></p>
            <span className="card-sub">含品牌与商圈匹配</span>
          </div>
          <div className="result-list">
            {cinemaHits.map((c) => {
              const min = cinemaMin(c.name)
              return (
                <div className="result-row" key={c.id}>
                  <span className="result-thumb text">影</span>
                  <div className="result-main">
                    <b>{c.name}</b>
                    <em>{c.brand} · {c.district}</em>
                  </div>
                  <div className="result-side">
                    <b>{min ? yuan(min.price) : '—'}</b>
                    <em>{min ? `${min.city} · ${min.time} 场最低` : '暂无场次'}</em>
                  </div>
                  <div className="result-actions">
                    <a className="btn small ghost" href={`#/movies${min ? `?city=${encodeURIComponent(min.city)}` : ''}`}>
                      查看场次
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {routeHits.length > 0 && (
        <section className="card result-block">
          <div className="result-head">
            <p className="card-title">航线 <span>{routeHits.length}</span></p>
            <span className="card-sub">未来 14 天最低价</span>
          </div>
          <div className="result-list">
            {routeHits.map((r) => {
              const min = routeMin(r.id)
              return (
                <div className="result-row" key={r.id}>
                  <span className="result-thumb text">飞</span>
                  <div className="result-main">
                    <b>{r.from} → {r.to}</b>
                    <em>{r.code} · 约 {r.distance} 公里</em>
                  </div>
                  <div className="result-side">
                    <b>{min ? yuan(min.minPrice) : '—'}</b>
                    <em>{min ? `最低日 ${min.dateShort}` : '暂无报价'}</em>
                  </div>
                  <div className="result-actions">
                    <a className="btn small ghost" href={`#/flights?r=${r.id}${min ? `&d=${min.date}` : ''}`}>
                      低价日历
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="card compare-card">
        <div className="card-head">
          <div>
            <p className="card-title">商品对比 <span className="badge">{picked.length}/3</span></p>
            <p className="card-sub">曲线以各自 30 天首个价格为 100 归一化，便于不同价位的商品同图比较</p>
          </div>
          {picked.length > 0 && (
            <button className="btn small ghost" onClick={() => setCompareIds([])}>清空</button>
          )}
        </div>

        {notice && <p className="compare-notice">{notice}</p>}

        {picked.length < 2 ? (
          <div className="compare-empty">
            <b>再选 {2 - picked.length} 个商品开始对比</b>
            <span>在搜索结果里点「加入对比」，最多 3 个；对比当前最低价、平台价差与 30 天走势。</span>
            <div className="chips" style={{ marginTop: 10 }}>
              {productList
                .filter((p) => !compareIds.includes(p.id))
                .slice(0, 3)
                .map((p) => (
                  <button key={p.id} className="chip" onClick={() => toggleCompare(p.id)}>
                    + {p.name}
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <>
            <div className="compare-table-wrap">
              <table className="table compare-table">
                <thead>
                  <tr>
                    <th>对比项</th>
                    {picked.map((p) => (
                      <th key={p.id}>
                        <span className="compare-col-head">
                          <b>{p.name}</b>
                          <button onClick={() => toggleCompare(p.id)} aria-label={`移除 ${p.name}`}>×</button>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>当前最低到手价</td>
                    {picked.map((p) => (
                      <td key={p.id} className={`num ${p.id === best?.id ? 'strong compare-best' : 'strong'}`}>
                        {yuan(p.lowestPrice)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>最低平台</td>
                    {picked.map((p) => (
                      <td key={p.id}>{p.lowestPlatform}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>平台价差</td>
                    {picked.map((p) => (
                      <td key={p.id} className="num">{yuan(p.spread)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>30 天最低 / 最高</td>
                    {picked.map((p) => {
                      const pl = cheapestPlatform(p)
                      return (
                        <td key={p.id} className="num">
                          {yuan(pl.min30)} / {yuan(pl.max30)}
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td>30 天均价</td>
                    {picked.map((p) => {
                      const h = cheapestPlatform(p).history
                      const avg = h.reduce((a, b) => a + b.price, 0) / (h.length || 1)
                      return <td key={p.id} className="num">{yuan(avg)}</td>
                    })}
                  </tr>
                  <tr>
                    <td>最低平台较昨日</td>
                    {picked.map((p) => {
                      const ch = cheapestPlatform(p).change
                      return (
                        <td key={p.id} className="num">
                          <span className={`delta ${dir(ch)}`}>{pct(ch)}</span>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td>各平台到手价</td>
                    {picked.map((p) => (
                      <td key={p.id}>
                        <span className="compare-platforms">
                          {p.platforms.map((x) => (
                            <i key={x.platform}>{x.platform} {yuan(x.finalPrice)}</i>
                          ))}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {compareOption && (
              <div className="compare-chart">
                {compareOption && <Chart option={compareOption} height={300} />}
              </div>
            )}

            {best && (
              <p className="compare-conclusion">
                <b>对比结论：</b>{best.name} 当前到手价最低（{yuan(best.lowestPrice)}，{best.lowestPlatform}），
                在 {picked.length} 个对比商品中价格优势最明显；购买前可再确认优惠券有效期与库存。
              </p>
            )}
          </>
        )}
      </section>
    </>
  )
}

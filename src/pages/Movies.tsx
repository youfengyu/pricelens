import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { Chart, baseTheme } from '../components/Chart'
import { PageHead, Skeleton, ErrorNote } from '../components/PageHead'
import { useJson, useHashQuery } from '../lib/data'
import { yuan } from '../lib/format'
import type { MoviesData } from '../lib/types'

const showOrder = ['13:30', '16:10', '19:20', '21:50']

export function Movies() {
  const { data, error } = useJson<MoviesData>('movies')
  const [city, setCity] = useState('北京')
  const [movieId, setMovieId] = useState<string | null>(null)

  // 支持从搜索页深链跳转：#/movies?m=film-id&city=上海
  const query = useHashQuery()
  const deepMovie = query.get('m')
  const deepCity = query.get('city')
  useEffect(() => {
    if (deepMovie && data?.movies.some((m) => m.id === deepMovie)) setMovieId(deepMovie)
    if (deepCity && data?.cities.includes(deepCity)) setCity(deepCity)
  }, [deepMovie, deepCity, data])

  const movie = data?.movies.find((m) => m.id === movieId) ?? data?.movies[0]
  const offers = data?.offers.filter((o) => o.city === city && o.movieId === movie?.id) ?? []

  const cinemaStats = useMemo(() => {
    const map = new Map<string, { name: string; district: string; prices: number[] }>()
    offers.forEach((o) => {
      const item = map.get(o.cinema) ?? { name: o.cinema, district: o.district, prices: [] }
      item.prices.push(o.price)
      map.set(o.cinema, item)
    })
    return [...map.values()]
      .map((c) => ({
        name: c.name,
        district: c.district,
        avg: c.prices.reduce((a, b) => a + b, 0) / c.prices.length,
        min: Math.min(...c.prices),
      }))
      .sort((a, b) => a.avg - b.avg)
  }, [offers])

  const times = showOrder.filter((t) => offers.some((o) => o.time === t))
  const prices = offers.map((o) => o.price)
  const lowPrice = prices.length ? Math.min(...prices) : 0
  const highPrice = prices.length ? Math.max(...prices) : 0

  const barOption = useMemo<EChartsOption>(() => {
    const names = cinemaStats.map((c) => c.name).reverse()
    const values = [...cinemaStats].reverse()
    return {
      ...baseTheme,
      grid: { left: 4, right: 46, top: 8, bottom: 0, containLabel: true },
      tooltip: {
        ...baseTheme.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => yuan(Number(v)),
      },
      xAxis: { type: 'value', show: false, max: Math.max(...cinemaStats.map((c) => c.avg)) * 1.16 },
      yAxis: {
        type: 'category',
        data: names,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#41506A', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          barWidth: 13,
          data: values.map((c) => ({
            value: Number(c.avg.toFixed(1)),
            itemStyle: {
              color: c.avg === Math.min(...cinemaStats.map((x) => x.avg)) ? '#0E7C6B' : '#C9D6E4',
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
  }, [cinemaStats, highPrice])

  const heatOption = useMemo<EChartsOption>(() => {
    const shortName = (name: string) =>
      name.replace(/国际影城|电影城|影城/g, '').replace('（', ' ').replace(/店）|）/g, '').trim()
    const cinemaNames = cinemaStats.map((c) => shortName(c.name))
    const points: [number, number, number][] = []
    cinemaStats.forEach((c, idx) => {
      showOrder.forEach((t, ti) => {
        const offer = offers.find((o) => o.cinema === c.name && o.time === t)
        if (offer) points.push([ti, idx, offer.price])
      })
    })
    return {
      ...baseTheme,
      grid: { left: 4, right: 14, top: 8, bottom: 42, containLabel: true },
      tooltip: {
        ...baseTheme.tooltip,
        formatter: (p: unknown) => {
          const item = p as { data: [number, number, number] }
          return `${cinemaNames[item.data[1]]}<br/>${showOrder[item.data[0]]} 场 · ${yuan(item.data[2])}`
        },
      },
      xAxis: {
        type: 'category',
        data: times,
        splitArea: { show: true },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'category',
        data: cinemaNames,
        splitArea: { show: true },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#41506A', fontSize: 10.5, width: 76, overflow: 'truncate' },
      },
      visualMap: {
        min: lowPrice,
        max: highPrice,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 70,
        textStyle: { color: '#8A97A8', fontSize: 10 },
        text: [yuan(highPrice), yuan(lowPrice)],
        inRange: { color: ['#DDF3E9', '#F3F8E4', '#FBE7C0', '#F3B9A6', '#E5484D'] },
      },
      series: [
        {
          type: 'heatmap',
          data: points,
          label: {
            show: true,
            formatter: (p: unknown) => {
              const item = p as { data: [number, number, number] }
              return yuan(item.data[2])
            },
            fontSize: 10,
            color: '#243043',
          },
          itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(11,18,32,.18)' } },
        },
      ],
    }
  }, [cinemaStats, offers, times, lowPrice, highPrice])

  if (error) return <ErrorNote message={error} />
  if (!data || !movie) return <Skeleton height={560} />

  const minFor = (id: string) => {
    const list = data.offers.filter((o) => o.city === city && o.movieId === id).map((o) => o.price)
    return list.length ? Math.min(...list) : 0
  }

  const lowCinema = cinemaStats[0]
  const cityAvg = data.cityAvg

  return (
    <>
      <PageHead
        eyebrow="Movie tickets"
        title="电影票比价"
        desc="按城市、影片与场次对比影院票价，找出同一场电影的最优购票方案。"
        meta={`更新于 ${data.updatedAt} · 已覆盖 ${data.cities.length} 城`}
        actions={<span className="badge green">已接入猫眼 / 淘票票演示数据</span>}
      />

      <div className="movie-strip">
        {data.movies.map((m) => (
          <button
            key={m.id}
            className={`movie-card ${movie.id === m.id ? 'active' : ''}`}
            onClick={() => setMovieId(m.id)}
          >
            <img src={m.poster} alt={m.title} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            <div className="movie-card-body">
              <b>{m.title}</b>
              <em>{m.genre}</em>
              <em>{m.duration} 分钟</em>
              <div className="movie-score">
                {m.score.toFixed(1)}
                <span>分</span>
              </div>
              <div className="movie-start">
                {yuan(minFor(m.id))}
                <span>起</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="chips">
            {data.cities.map((c) => {
              const avg = cityAvg.find((x) => x.city === c)?.avg ?? 0
              return (
                <button key={c} className={`chip ${city === c ? 'active' : ''}`} onClick={() => setCity(c)}>
                  {c}
                  <span style={{ opacity: 0.66, fontWeight: 500 }}>{yuan(avg)}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="toolbar-right">
          <span className="legend">
            <span><i style={{ background: '#DDF3E9' }} />低价</span>
            <span><i style={{ background: '#E5484D' }} />高价</span>
          </span>
        </div>
      </div>

      <div className="grid split-57" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">影院均价对比</p>
              <p className="card-sub">{city} · {movie.title} · 四场次平均票价</p>
            </div>
            <span className="badge green">最低 {lowCinema ? yuan(lowCinema.min) : '—'}</span>
          </div>
          <Chart option={barOption} height={248} />
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">场次价格热力图</p>
              <p className="card-sub">横轴场次、纵轴影院，颜色越深价格越高</p>
            </div>
            <span className="badge">{offers.length} 个场次</span>
          </div>
          <Chart option={heatOption} height={248} />
        </div>
      </div>

      <div className="grid split-75">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">场次明细</p>
              <p className="card-sub">按票价从低到高排序，含影厅格式与余座</p>
            </div>
            <span className="badge">{city}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>影院</th>
                  <th>场次</th>
                  <th>影厅</th>
                  <th className="num">余座</th>
                  <th className="num">票价</th>
                  <th>退改</th>
                </tr>
              </thead>
              <tbody>
                {[...offers]
                  .sort((a, b) => a.price - b.price)
                  .map((o, i) => (
                    <tr key={`${o.cinemaId}-${o.time}`} className={i === 0 ? 'lowest-row' : ''}>
                      <td>
                        <span className="platform" style={{ color: '#1D2939' }}>{o.cinema}</span>
                        <span className="shop">{o.district}</span>
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{o.time}</td>
                      <td style={{ color: '#6B7A90' }}>{o.format}</td>
                      <td className="num">{o.seatsLeft}</td>
                      <td className="num strong">{yuan(o.price)}</td>
                      <td>
                        <span className={`badge ${o.refundable ? 'green' : ''}`}>{o.refundable ? '可退改' : '不可退'}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <p className="card-title">城市均价</p>
                <p className="card-sub">全部影片与场次的平均票价</p>
              </div>
            </div>
            <div className="list">
              {cityAvg.map((c) => {
                const max = Math.max(...cityAvg.map((x) => x.avg))
                return (
                  <div className="list-row" key={c.city}>
                    <div className="list-main">
                      <b>{c.city}</b>
                      <em>{c.avg < max * 0.9 ? '价格洼地' : c.avg > max * 1.1 ? '价格高位' : '价格平稳'}</em>
                    </div>
                    <div className="mini-bar" style={{ width: 80 }}>
                      <i style={{ width: `${(c.avg / max) * 100}%`, background: c.avg === Math.min(...cityAvg.map((x) => x.avg)) ? '#0E7C6B' : '#A9BED4' }} />
                    </div>
                    <span className="strong" style={{ fontWeight: 700, width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {yuan(c.avg)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <p className="card-title">购票建议</p>
                <p className="card-sub">基于当前场次价格的自动结论</p>
              </div>
            </div>
            <div className="notice">
              <span>
                <b>{lowCinema ? lowCinema.name : '—'}</b> 当前均价最低；晚间 19:20 的 IMAX 场次普遍溢价约
                32%，若对影厅无要求，选择 13:30 场次可再省 {yuan(Math.max(0, (offers[0]?.price ?? 0) - lowPrice))} 以上。
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

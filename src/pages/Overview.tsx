import type { EChartsOption } from 'echarts'
import { Chart, baseTheme, palette } from '../components/Chart'
import { PageHead, Skeleton, ErrorNote } from '../components/PageHead'
import { Sparkline } from '../components/Sparkline'
import { useJson, go } from '../lib/data'
import { pct, yuan, dir } from '../lib/format'
import type { MonitorData, ProductsData } from '../lib/types'

const iconBag = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" strokeLinejoin="round" />
    <path d="M4 8.5 12 13l8-4.5M12 13v7" strokeLinejoin="round" />
  </svg>
)

const iconSync = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M20 11a8 8 0 1 0-2.3 6.3" strokeLinecap="round" />
    <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const iconShield = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3 5 6v6c0 4.5 3 7.4 7 9 4-1.6 7-4.5 7-9V6l-7-3Z" strokeLinejoin="round" />
    <path d="m9 12 2.2 2.2L15.5 10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const iconBell = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" strokeLinejoin="round" />
    <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
  </svg>
)

export function Overview() {
  const { data, error } = useJson<ProductsData>('products')
  const monitor = useJson<MonitorData>('monitor')

  if (error) return <ErrorNote message={error} />
  if (!data) return <Skeleton height={520} />

  const m = monitor.data
  const latest = data.index[data.index.length - 1]
  const prev = data.index[data.index.length - 2]
  const indexDelta = ((latest.value - prev.value) / prev.value) * 100

  const heroOption: EChartsOption = {
    ...baseTheme,
    grid: { left: 0, right: 4, top: 12, bottom: 0 },
    tooltip: {
      ...baseTheme.tooltip,
      trigger: 'axis',
      valueFormatter: (v) => `${Number(v).toFixed(2)}`,
    },
    xAxis: {
      type: 'category',
      data: data.index.map((d) => d.date),
      show: false,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      show: false,
      scale: true,
      min: Math.min(...data.index.map((d) => d.value)) - 1,
    },
    series: [
      {
        type: 'line',
        data: data.index.map((d) => d.value),
        smooth: 0.35,
        symbol: 'none',
        lineStyle: { width: 2, color: '#4FE3B7' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79,227,183,0.35)' },
              { offset: 1, color: 'rgba(79,227,183,0)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(255,255,255,0.18)', type: 'dashed' },
          label: { show: false },
          data: [{ yAxis: prev.value }],
        },
      },
    ],
  }

  const platformCount = new Set(data.products.flatMap((p) => p.platforms.map((x) => x.platform))).size
  const skuCount = data.products.reduce((a, p) => a + p.platforms.length, 0)

  const kpis = [
    {
      label: '监控 SKU',
      value: skuCount,
      unit: '个',
      icon: iconBag,
      tone: '',
      foot: `${data.products.length} 个商品 · ${platformCount} 个平台`,
    },
    {
      label: '今日采集',
      value: m?.stats.crawlToday ?? '—',
      unit: '次',
      icon: iconSync,
      tone: 'blue',
      foot: '最近同步 ' + data.updatedAt.slice(-5),
    },
    {
      label: '采集成功率',
      value: m?.stats.successRate ?? '—',
      unit: '%',
      icon: iconShield,
      tone: 'amber',
      foot: '近 24 小时 · 自动重试已开启',
    },
    {
      label: '待处理告警',
      value: m?.stats.alerts ?? '—',
      unit: '条',
      icon: iconBell,
      tone: 'rose',
      foot: '价格波动与字段异常',
    },
  ]

  const donutOption: EChartsOption = {
    ...baseTheme,
    tooltip: { ...baseTheme.tooltip, trigger: 'item' },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      textStyle: { color: '#5C6B7F', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '80%'],
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
        label: {
          show: true,
          position: 'center',
          formatter: `{a|${m?.stats.tasks ?? 8}}\n{b|个采集任务}`,
          rich: {
            a: { fontSize: 24, fontWeight: 700, color: '#0B1220', lineHeight: 30 },
            b: { fontSize: 10.5, color: '#8A97A8' },
          },
        },
        emphasis: { label: { show: true }, scale: true, scaleSize: 4 },
        data: [
          { value: 4, name: '商品价格', itemStyle: { color: palette[0] } },
          { value: 2, name: '电影票', itemStyle: { color: palette[1] } },
          { value: 2, name: '机票', itemStyle: { color: palette[4] } },
        ],
      },
    ],
  }

  const timelineOption: EChartsOption = {
    ...baseTheme,
    grid: { left: 4, right: 6, top: 18, bottom: 0, containLabel: true },
    tooltip: { ...baseTheme.tooltip, trigger: 'axis' },
    legend: {
      right: 0,
      top: -4,
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      textStyle: { color: '#8A97A8', fontSize: 10.5 },
    },
    xAxis: {
      type: 'category',
      data: m?.timeline.map((t) => t.hour) ?? [],
      axisTick: { show: false },
      axisLabel: { interval: 3 },
    },
    yAxis: { type: 'value', splitNumber: 2 },
    series: [
      {
        name: '成功',
        type: 'bar',
        stack: 'crawl',
        barWidth: 8,
        itemStyle: { color: '#0E7C6B', borderRadius: [0, 0, 2, 2] },
        data: m?.timeline.map((t) => t.success) ?? [],
      },
      {
        name: '失败',
        type: 'bar',
        stack: 'crawl',
        barWidth: 8,
        itemStyle: { color: '#F0A7A9', borderRadius: [2, 2, 0, 0] },
        data: m?.timeline.map((t) => t.failed) ?? [],
      },
    ],
  }

  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="全网价格总览"
        desc="电商商品、电影票与机票的实时价格监控，一处看清全网价格水位。"
        meta={`数据快照 ${data.updatedAt}`}
        actions={
          <button className="btn" onClick={() => window.location.reload()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 11a8 8 0 1 0-2.3 6.3" strokeLinecap="round" />
              <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            刷新数据
          </button>
        }
      />

      <section className="hero">
        <div className="hero-left">
          <p className="hero-eyebrow">All-market price index</p>
          <div className="hero-value">
            <strong>{latest.value.toFixed(1)}</strong>
            <span>全网价格指数 · 基期 100</span>
          </div>
          <div className="hero-delta">
            <b>{indexDelta.toFixed(2)}%</b>
            {Math.abs(indexDelta) < 0.005 ? '较昨日基本持平' : `较昨日，整体价格${indexDelta < 0 ? '回落' : '上行'}`}
          </div>
          <div className="hero-meta">
            <span className="hero-tag">{data.products.length} 类重点商品</span>
            <span className="hero-tag">{data.days} 天历史留痕</span>
            <span className="hero-tag">{platformCount} 电商平台 + 电影 / 机票</span>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-chart-head">
            <span>近 {data.days} 天价格走势</span>
            <span>最低 {Math.min(...data.index.map((d) => d.value)).toFixed(1)}</span>
          </div>
          <Chart option={heroOption} height={190} />
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className={`kpi-icon ${k.tone}`}>{k.icon}</div>
            <div className="kpi-body">
              <span className="kpi-label">{k.label}</span>
              <div className="kpi-value">
                {k.value}
                <small>{k.unit}</small>
              </div>
              <div className="kpi-foot">{k.foot}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid split-57" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">全网最低价</p>
              <p className="card-sub">每件商品当前可到手的最低价格与所属平台</p>
            </div>
            <a className="link" href="#/products">
              全部比价
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
          <div className="list">
            {data.products.map((p) => {
              const low = p.platforms.find((x) => x.platform === p.lowestPlatform)!
              return (
                <div className="list-row" key={p.id}>
                  <img
                    src={p.image}
                    alt={p.name}
                    width={44}
                    height={44}
                    style={{ borderRadius: 10, objectFit: 'cover', background: '#f1f4f8' }}
                    onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                  />
                  <div className="list-main">
                    <b>{p.name}</b>
                    <em>
                      {p.lowestPlatform} · 到手价含券
                    </em>
                  </div>
                  <Sparkline
                    points={low.history}
                    color={low.change < 0 ? '#0E9F6E' : low.change > 0 ? '#E5484D' : '#94A3B8'}
                  />
                  <div style={{ textAlign: 'right', minWidth: 84 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#0A5F52', fontVariantNumeric: 'tabular-nums' }}>
                      {yuan(p.lowestPrice)}
                    </div>
                    <span className={`delta ${dir(low.change)}`}>{pct(low.change)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">采集健康度</p>
              <p className="card-sub">按业务线拆分的定时采集任务</p>
            </div>
            <span className="badge green">运行正常</span>
          </div>
          <Chart option={donutOption} height={216} />
          <div className="notice" style={{ marginTop: 8 }}>
            <span>
              <b>自动降级已生效：</b>淘票票接口超时后并发降至 2，失败任务将在 5 分钟后重试。
            </span>
          </div>
        </div>
      </div>

      <div className="grid split-75">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">近 24 小时采集量</p>
              <p className="card-sub">按小时统计成功 / 失败请求数</p>
            </div>
            <span className="badge">{m?.stats.crawlToday ?? 0} 次成功</span>
          </div>
          <Chart option={timelineOption} height={228} />
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">价格变动榜</p>
              <p className="card-sub">最近一次抓取的价格波动</p>
            </div>
            <a className="link" href="#/monitor">
              查看大屏
            </a>
          </div>
          <div className="list">
            {m?.movers.slice(0, 5).map((mv, i) => (
              <div className="list-row" key={`${mv.name}-${mv.platform}-${i}`}>
                <span className={`rank ${i === 0 ? 'top' : ''}`}>{i + 1}</span>
                <div className="list-main">
                  <b>{mv.name}</b>
                  <em>{mv.platform} · {yuan(mv.from)} → {yuan(mv.to)}</em>
                </div>
                <span className={`delta ${dir(mv.change)}`}>{pct(mv.change)}</span>
              </div>
            ))}
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={() => go('products')}>
            进入商品比价
          </button>
        </div>
      </div>
    </>
  )
}

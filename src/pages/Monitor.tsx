import type { EChartsOption } from 'echarts'
import { Chart, baseTheme } from '../components/Chart'
import { PageHead, Skeleton, ErrorNote } from '../components/PageHead'
import { useJson } from '../lib/data'
import { pct, yuan, dir } from '../lib/format'
import type { MonitorData } from '../lib/types'

const levelText: Record<string, string> = { high: '高', medium: '中', low: '低' }
const levelClass: Record<string, string> = { high: 'red', medium: 'amber', low: 'green' }

export function Monitor() {
  const { data, error } = useJson<MonitorData>('monitor')

  const gaugeOption: EChartsOption = {
    ...baseTheme,
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 90,
        max: 100,
        radius: '96%',
        center: ['50%', '62%'],
        progress: { show: true, width: 12, roundCap: true, itemStyle: { color: '#0E7C6B' } },
        axisLine: { lineStyle: { width: 12, color: [[1, '#EEF2F7']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          offsetCenter: [0, '-8%'],
          valueAnimation: true,
          formatter: `{v|${data?.stats.successRate ?? 0}}{u|%}`,
          rich: {
            v: { fontSize: 30, fontWeight: 700, color: '#0B1220', fontFamily: 'Inter, sans-serif' },
            u: { fontSize: 13, color: '#8A97A8' },
          },
        },
        data: [{ value: data?.stats.successRate ?? 0 }],
      },
    ],
  }

  const healthOption: EChartsOption = {
    ...baseTheme,
    grid: { left: 4, right: 8, top: 12, bottom: 0, containLabel: true },
    tooltip: { ...baseTheme.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: data?.tasks.map((t) => t.type) ?? [],
      axisTick: { show: false },
      axisLabel: { interval: 0, fontSize: 10 },
    },
    yAxis: { type: 'value', min: 90, max: 100, splitNumber: 2, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        type: 'bar',
        barWidth: 22,
        data: data?.tasks.map((t) => ({
          value: t.successRate,
          itemStyle: {
            borderRadius: 6,
            color: t.successRate >= 97 ? '#0E7C6B' : t.successRate >= 95 ? '#E8B04B' : '#E5484D',
          },
        })) ?? [],
        label: { show: true, position: 'top', fontSize: 10, color: '#6B7A90', formatter: '{c}%' },
      },
    ],
  }

  if (error) return <ErrorNote message={error} />
  if (!data) return <Skeleton height={560} />

  const exportSnapshot = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'price-radar-monitor.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHead
        eyebrow="Crawl monitor"
        title="采集监控大屏"
        desc="任务队列、成功率、异常告警与价格异动集中呈现，出问题第一时间知道。"
        meta={`最近同步 ${data.updatedAt}`}
        actions={
          <button className="btn primary" onClick={exportSnapshot}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 4v10m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 18h14" strokeLinecap="round" />
            </svg>
            导出快照
          </button>
        }
      />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
            </svg>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">采集任务</span>
            <div className="kpi-value">{data.stats.tasks}<small>个</small></div>
            <div className="kpi-foot">商品 4 · 电影 2 · 机票 2</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 11a8 8 0 1 0-2.3 6.3" strokeLinecap="round" />
              <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">今日成功请求</span>
            <div className="kpi-value">{data.stats.crawlToday}<small>次</small></div>
            <div className="kpi-foot">失败自动重试 + 指数退避</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-icon amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3 5 6v6c0 4.5 3 7.4 7 9 4-1.6 7-4.5 7-9V6l-7-3Z" strokeLinejoin="round" />
              <path d="m9 12 2.2 2.2L15.5 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">整体成功率</span>
            <div className="kpi-value">{data.stats.successRate}<small>%</small></div>
            <div className="kpi-foot">近 24 小时加权</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-icon rose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 9v4m0 3h.01" strokeLinecap="round" />
              <path d="M10.3 4.3 3.6 16a2 2 0 0 0 1.7 3h13.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">待处理告警</span>
            <div className="kpi-value">{data.stats.alerts}<small>条</small></div>
            <div className="kpi-foot">高优先级 1 条</div>
          </div>
        </div>
      </div>

      <div className="grid split-75" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">任务队列</p>
              <p className="card-sub">按业务线拆分的采集任务与最近运行状态</p>
            </div>
            <span className="badge green">调度器运行中</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>任务</th>
                  <th>类型</th>
                  <th>覆盖范围</th>
                  <th>频率</th>
                  <th className="num">耗时</th>
                  <th>成功率</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((t) => (
                  <tr key={t.name}>
                    <td>
                      <span className="strong task-name">{t.name}</span>
                      <span className="shop">最近运行 {t.lastRun}</span>
                    </td>
                    <td><span className="badge">{t.type}</span></td>
                    <td style={{ color: '#6B7A90', whiteSpace: 'nowrap' }}>{t.target}</td>
                    <td style={{ color: '#6B7A90', whiteSpace: 'nowrap' }}>{t.interval}</td>
                    <td className="num">{t.duration}s</td>
                    <td>
                      <span className="mini-bar"><i style={{ width: `${t.successRate}%` }} /></span>
                      <span style={{ marginLeft: 8, fontSize: 11.5, color: '#52637A', fontVariantNumeric: 'tabular-nums' }}>
                        {t.successRate}%
                      </span>
                    </td>
                    <td>
                      <span className={`status ${t.status}`}>
                        <i />
                        {t.status === 'running' ? '运行中' : t.status === 'warning' ? '需关注' : '空闲'}
                      </span>
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
                <p className="card-title">采集成功率</p>
                <p className="card-sub">近 24 小时 · 目标线 97%</p>
              </div>
              <span className="badge green">健康</span>
            </div>
            <Chart option={gaugeOption} height={168} />
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <p className="card-title">异常告警</p>
                <p className="card-sub">价格异动与采集异常</p>
              </div>
              <span className="badge red">{data.alerts.length} 条</span>
            </div>
            {data.alerts.map((a) => (
              <div className={`alert ${a.level}`} key={a.id}>
                <span className="alert-dot" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{a.title}</b>
                  <em>{a.detail}</em>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className={`badge ${levelClass[a.level]}`}>{levelText[a.level]}</span>
                  <time>{a.time}</time>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid split-57">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">价格变动榜</p>
              <p className="card-sub">本次抓取相比上一次的变化</p>
            </div>
            <span className="badge">TOP {data.movers.length}</span>
          </div>
          <div className="grid grid-2" style={{ gap: 0 }}>
            {data.movers.map((mv, i) => (
              <div className="list-row" key={`${mv.name}-${mv.platform}-${i}`} style={{ paddingRight: 14 }}>
                <span className={`rank ${i === 0 ? 'top' : ''}`}>{i + 1}</span>
                <div className="list-main">
                  <b>{mv.name}</b>
                  <em>{mv.platform} · {yuan(mv.from)} → {yuan(mv.to)}</em>
                </div>
                <span className={`delta ${dir(mv.change)}`}>{pct(mv.change)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-title">各类型成功率</p>
              <p className="card-sub">商品 / 电影票 / 机票三类业务</p>
            </div>
          </div>
          <Chart option={healthOption} height={214} />
          <div className="notice" style={{ marginTop: 8 }}>
            <span>
              <b>合规说明：</b>采集端仅访问公开商品页与比价页，遵守 robots 协议与平台条款，
              不携带登录态、不绕过验证码，采集频率按平台限制自动降速。
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

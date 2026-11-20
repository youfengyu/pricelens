import type { ReactNode } from 'react'

const items: { key: string; label: string; hint: string; icon: ReactNode }[] = [
  {
    key: 'overview',
    label: '总览',
    hint: '行情与健康度',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'search',
    label: '搜索比价',
    hint: '跨品类检索',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4.5 4.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'products',
    label: '商品比价',
    hint: '4 类商品 · 多平台',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" strokeLinejoin="round" />
        <path d="M4 8.5 12 13l8-4.5M12 13v7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'movies',
    label: '电影票',
    hint: '影院 · 场次',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M8 6v12M16 6v12M3 10h5M3 14h5M16 10h5M16 14h5" />
      </svg>
    ),
  },
  {
    key: 'flights',
    label: '机票',
    hint: '低价日历',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="m3 13 18-7-6.5 15-3-6.2L3 13Z" strokeLinejoin="round" />
        <path d="m11.5 14.8 4-5.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'monitor',
    label: '监控大屏',
    hint: '任务与告警',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M3 12h3.5l2.5-6 4 13 2.5-7H21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export function Sidebar({ route }: { route: string }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4.5 4.5" strokeLinecap="round" />
            <path d="M8 10.8h5M10.5 8.3v5" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <strong>PriceLens</strong>
          <span>价格监控与比价</span>
        </div>
      </div>

      <nav className="nav">
        <p className="nav-label">工作台</p>
        {items.map((item) => (
          <a key={item.key} href={`#/${item.key}`} className={`nav-item ${route === item.key ? 'active' : ''}`}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-text">
              <b>{item.label}</b>
              <em>{item.hint}</em>
            </span>
          </a>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-note">
          <span className="pulse" />
          <div>
            <b>采集端运行中</b>
            <em>最近同步 08:15 · 8 个任务</em>
          </div>
        </div>
        <p className="sidebar-legal">仅采集公开页面数据，遵守 robots 协议</p>
      </div>
    </aside>
  )
}

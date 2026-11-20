import type { ReactNode } from 'react'

export function PageHead({
  eyebrow,
  title,
  desc,
  meta,
  actions,
}: {
  eyebrow: string
  title: string
  desc: string
  meta?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-desc">
          {desc}
          {meta && <span className="page-meta">{meta}</span>}
        </p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Skeleton({ height = 320 }: { height?: number }) {
  return (
    <div className="skeleton" style={{ height }}>
      <span />
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="error-note">
      <b>数据加载失败</b>
      <span>{message}，请先运行 npm run gen 生成数据。</span>
    </div>
  )
}

export const yuan = (n: number) =>
  '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })

export const pct = (n: number) =>
  `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

export const dir = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat')

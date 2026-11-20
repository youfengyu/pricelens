// 真实数据接入：把授权 API / CSV / 采集端导出的报价归一化为前端数据。
// 只处理你有权获取的数据，不包含任何绕过登录、验证码或风控的逻辑。
//
// 用法：
//   node scripts/ingest.mjs --template
//   node scripts/ingest.mjs --source csv  --kind products --file data/real/products.csv
//   node scripts/ingest.mjs --source json --kind products --file data/real/products.json
//   node scripts/ingest.mjs --source http --kind products --url https://api.example.com/prices --token-env PRICE_API_TOKEN
//   node scripts/ingest.mjs --check
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT = resolve(ROOT, 'public/data')
const REAL_DIR = resolve(ROOT, 'data/real')

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}

const kind = value('kind', 'products')
const source = value('source', '')
const file = value('file', '')
const url = value('url', '')
const tokenEnv = value('token-env', '')
const seedMode = value('seed-mode', 'append')
const outDir = resolve(ROOT, value('out', 'public/data'))
const isDefaultOut = outDir === DEFAULT_OUT
const stateDir = isDefaultOut ? REAL_DIR : outDir
const dryRun = flag('dry-run')
const replace = flag('replace')

const log = (...m) => console.log(...m)
const warn = (...m) => console.warn('  !', ...m)
const die = (msg) => {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

/* ------------------------------- 通用工具 ------------------------------- */

const round = (n, d = 2) => Number(Number(n).toFixed(d))

function nowCN() {
  const t = new Date(Date.now() + 8 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`
}

function todayCN() {
  return nowCN().slice(5, 10)
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

/* --------------------------------- CSV ---------------------------------- */

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
  }
  return rows
}

const csvEscape = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const QUOTE_HEADERS = [
  'product_id',
  'name',
  'category',
  'spec',
  'unit',
  'image',
  'platform',
  'shop',
  'price',
  'original_price',
  'coupon',
  'sales',
  'rating',
  'in_stock',
  'tags',
]

function csvToQuotes(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((cells, i) => {
    const obj = { __line: i + 2 }
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? '').trim()
    })
    return obj
  })
}

/* ------------------------------- 数据校验 -------------------------------- */

function normalizeQuote(raw, line) {
  const errors = []
  const id = String(raw.product_id ?? raw.id ?? '').trim()
  const platform = String(raw.platform ?? '').trim()
  const name = String(raw.name ?? raw.product_name ?? '').trim()
  const price = Number(raw.price)
  const originalPrice = Number(raw.original_price ?? raw.originalPrice ?? price)
  const coupon = Number(raw.coupon ?? 0)

  if (!id) errors.push('缺少 product_id')
  if (!platform) errors.push('缺少 platform')
  if (!name) errors.push('缺少 name')
  if (!Number.isFinite(price) || price <= 0 || price > 1e7) errors.push(`price 非法：${raw.price}`)
  if (!Number.isFinite(coupon) || coupon < 0) errors.push(`coupon 非法：${raw.coupon}`)
  if (Number.isFinite(price) && coupon > price) errors.push('coupon 大于 price')
  if (!Number.isFinite(originalPrice) || originalPrice < price) errors.push(`original_price 应不小于 price`)

  if (errors.length) return { errors: errors.map((e) => `第 ${line} 行 ${id || '?'}：${e}`) }

  return {
    errors: [],
    quote: {
      id,
      name,
      category: String(raw.category ?? '未分类').trim() || '未分类',
      spec: String(raw.spec ?? '').trim(),
      unit: String(raw.unit ?? '件').trim() || '件',
      image: String(raw.image ?? '').trim(),
      tags: String(raw.tags ?? '')
        .split(/[|,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
      platform,
      shop: String(raw.shop ?? platform).trim() || platform,
      price: round(price),
      originalPrice: round(originalPrice),
      coupon: round(coupon),
      sales: String(raw.sales ?? '—').trim() || '—',
      rating: Math.min(5, Math.max(0, Number(raw.rating ?? 0) || 0)),
      inStock: !/^(false|0|否|无货)$/i.test(String(raw.in_stock ?? 'true').trim()),
      line,
    },
  }
}

const placeholderImage = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="18" fill="#EEF2F7"/><path d="M52 104l20-24 15 18 11-13 12 19H52z" fill="#C9D6E4"/><circle cx="70" cy="62" r="9" fill="#C9D6E4"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
})()

/* --------------------------- 商品聚合（核心） ---------------------------- */

function aggregateProducts(quotes, existingData, history, mode = 'append') {
  const existingProducts = existingData?.products ?? []
  const existingMap = new Map(existingProducts.map((p) => [p.id, p]))
  const seeded = []

  const byProduct = new Map()
  for (const q of quotes) {
    const list = byProduct.get(q.id) ?? []
    list.push(q)
    byProduct.set(q.id, list)
  }

  const imported = new Map()
  for (const [id, list] of byProduct) {
    const prev = existingMap.get(id)
    const meta = {
      name: list[0].name,
      category: list[0].category,
      spec: list[0].spec || prev?.spec || '',
      unit: list[0].unit || prev?.unit || '件',
      image: list[0].image || prev?.image || placeholderImage,
    }

    const platforms = list.map((q) => {
      const key = `${id}::${q.platform}`
      let points = history[key]
      if ((!Array.isArray(points) || points.length === 0) && mode !== 'none') {
        const base = prev?.platforms?.find((p) => p.platform === q.platform)?.history
        if (Array.isArray(base) && base.length) {
          // scale：按今日真实价等比缩放演示曲线，避免接入当天出现断崖式跳变
          const lastPrice = base[base.length - 1].price
          const factor = mode === 'scale' && lastPrice ? q.price / lastPrice : 1
          points = base.map((h) => ({ date: h.date, price: round(h.price * factor) }))
          seeded.push(`${id} · ${q.platform}${mode === 'scale' ? '（等比缩放）' : ''}`)
        } else {
          points = []
        }
      }
      if (!Array.isArray(points)) points = []
      const date = todayCN()
      const observed = round(q.price - q.coupon)
      const last = points[points.length - 1]
      if (last && last.date === date) last.price = observed
      else points.push({ date, price: observed })
      history[key] = points.slice(-90)

      const window = points.slice(-30)
      const prices = window.map((h) => h.price)
      const finalPrice = round(q.price - q.coupon)
      const prevPrice = points.length > 1 ? points[points.length - 2].price : finalPrice

      return {
        platform: q.platform,
        shop: q.shop,
        price: q.price,
        originalPrice: q.originalPrice,
        coupon: q.coupon,
        sales: q.sales,
        rating: q.rating,
        finalPrice,
        min30: Math.min(...prices),
        max30: Math.max(...prices),
        change: round(((finalPrice - prevPrice) / prevPrice) * 100),
        inStock: q.inStock,
        history: window,
      }
    })

    const lowest = platforms.reduce((a, b) => (b.finalPrice < a.finalPrice ? b : a))
    const tags = list[0].tags.length
      ? list[0].tags
      : [`${lowest.platform}最低价`, `${platforms.length}平台比价`]

    imported.set(id, {
      id,
      name: meta.name,
      category: meta.category,
      spec: meta.spec,
      unit: meta.unit,
      image: meta.image,
      tags,
      lowestPlatform: lowest.platform,
      lowestPrice: lowest.finalPrice,
      spread: round(Math.max(...platforms.map((p) => p.finalPrice)) - lowest.finalPrice),
      platforms,
    })
  }

  const products = []
  for (const p of existingProducts) {
    if (imported.has(p.id)) {
      products.push(imported.get(p.id))
      imported.delete(p.id)
    } else if (!replace) {
      products.push(p)
    }
  }
  products.push(...imported.values())

  return { products, seeded }
}

function buildIndex(products) {
  const series = []
  for (const p of products) {
    for (const pl of p.platforms) {
      if (!pl.history?.length) continue
      const base = pl.history[0].price
      if (!base) continue
      series.push(pl.history.map((h) => ({ date: h.date, ratio: (h.price / base) * 100 })))
    }
  }
  if (!series.length) return { index: [], days: 0 }

  const dates = [...new Set(series.flatMap((s) => s.map((x) => x.date)))].sort()
  const index = dates.map((date) => {
    let sum = 0
    let count = 0
    for (const s of series) {
      const point = s.find((x) => x.date === date)
      if (point) {
        sum += point.ratio
        count++
      }
    }
    return { date, value: count ? round(sum / count) : null }
  }).filter((x) => x.value !== null)

  const days = Math.max(...series.map((s) => s.length))
  return { index, days }
}

/* ------------------------------- 主流程 --------------------------------- */

async function loadInput() {
  if (source === 'http') {
    if (!url) die('--source http 需要 --url')
    const headers = { Accept: 'application/json' }
    if (tokenEnv) {
      const token = process.env[tokenEnv]
      if (!token) die(`环境变量 ${tokenEnv} 为空，无法带上鉴权头`)
      headers.Authorization = `Bearer ${token}`
    }
    log(`→ 请求 ${url}`)
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
    if (!res.ok) die(`接口返回 ${res.status} ${res.statusText}`)
    return { type: 'json', data: await res.json(), label: url }
  }

  if (!file) die('请用 --file 指定数据文件，或用 --source http/--url 拉取')
  const path = resolve(ROOT, file)
  if (!existsSync(path)) die(`文件不存在：${file}`)
  const text = await readFile(path, 'utf8')
  if (source === 'csv' || file.toLowerCase().endsWith('.csv')) {
    return { type: 'csv', data: text, label: file }
  }
  try {
    return { type: 'json', data: JSON.parse(text), label: file }
  } catch (e) {
    return die(`JSON 解析失败：${e.message}`)
  }
}

async function ingestProducts(input) {
  let quotes = []
  let canonical = null

  if (input.type === 'csv') {
    quotes = csvToQuotes(input.data)
  } else if (Array.isArray(input.data?.quotes)) {
    quotes = input.data.quotes
  } else if (Array.isArray(input.data?.products)) {
    canonical = input.data
  } else {
    die('JSON 需包含 quotes 数组（报价）或 products 数组（完整数据）')
  }

  if (canonical) {
    if (!canonical.products.length) die('products 为空')
    const bad = canonical.products.filter((p) => !p.id || !p.name || !Array.isArray(p.platforms) || !p.platforms.length)
    if (bad.length) die(`products 结构不完整：${bad.map((p) => p.id || '?').join(', ')}`)
    const { index, days } = buildIndex(canonical.products)
    const out = {
      updatedAt: canonical.updatedAt || nowCN(),
      days: canonical.days || days,
      currency: canonical.currency || 'CNY',
      index: canonical.index?.length ? canonical.index : index,
      products: canonical.products,
    }
    await writeJson(resolve(outDir, 'products.json'), out)
    log(`✓ 已写入完整商品数据：${out.products.length} 个商品 · 输出 ${rel(outDir)}/products.json`)
    await writeMarker({ kind, source: input.label, rows: out.products.length })
    await syncMonitor(out)
    return
  }

  const valid = []
  const problems = []
  const seen = new Set()
  quotes.forEach((raw, i) => {
    const { quote, errors } = normalizeQuote(raw, raw.__line ?? i + 2)
    if (errors.length) problems.push(...errors)
    else {
      const key = `${quote.id}::${quote.platform}`
      if (seen.has(key)) warn(`重复报价 ${quote.id} · ${quote.platform}，后一条覆盖前一条`)
      seen.add(key)
      valid.push(quote)
    }
  })

  problems.forEach((p) => warn(p))
  if (!valid.length) die('没有可用的报价行，请检查字段与数值')

  const outPath = resolve(outDir, 'products.json')
  const existing = await readJson(outPath)
  const historyPath = resolve(stateDir, 'history.json')
  const history = (await readJson(historyPath, {})) ?? {}

  const { products, seeded } = aggregateProducts(valid, existing, history, seedMode)
  if (!products.length) die('聚合后没有任何商品')
  const { index, days } = buildIndex(products)

  const data = {
    updatedAt: nowCN(),
    days,
    currency: 'CNY',
    index,
    products,
  }

  if (!dryRun) {
    await writeJson(outPath, data)
    await writeJson(historyPath, history)
    await writeMarker({ kind, source: input.label, rows: valid.length })
    await syncMonitor(data)
  }

  const skipped = quotes.length - valid.length
  log('')
  log(`${dryRun ? '试运行（未写入）' : '✓ 商品数据接入完成'}`)
  log(`  来源      ${input.label}`)
  log(`  读取      ${quotes.length} 行 · 有效 ${valid.length} · 跳过 ${skipped}`)
  log(`  商品      ${products.length} 个 · 平台报价 ${products.reduce((n, p) => n + p.platforms.length, 0)} 条`)
  if (seeded.length) {
    const how = seedMode === 'scale' ? '按今日价等比缩放' : '原样沿用'
    log(`  历史基线  演示曲线 ${seeded.length} 条（${how}，后续累积真实观测）`)
  }
  if (seedMode === 'none') log('  历史基线  未继承演示曲线，仅记录本次观测')
  const cheapest = [...products].sort((a, b) => a.lowestPrice - b.lowestPrice)[0]
  if (cheapest) log(`  当前最低  ${cheapest.name} ${cheapest.lowestPlatform} ¥${cheapest.lowestPrice}`)
  log(`  输出      ${rel(outPath)}${dryRun ? '（dry-run 未写入）' : ''}`)
}

function rel(p) {
  return p.replace(ROOT, '.')
}

async function writeMarker(meta) {
  if (!isDefaultOut) return
  await writeJson(resolve(REAL_DIR, 'last-import.json'), { ...meta, at: nowCN() })
}

// 把商品快照同步到监控大屏：SKU 数、价格变动榜
async function syncMonitor(productsData) {
  const path = resolve(outDir, 'monitor.json')
  const monitor = await readJson(path)
  if (!monitor?.stats) return
  monitor.stats.skus = productsData.products.reduce((n, p) => n + p.platforms.length, 0)
  monitor.movers = productsData.products
    .map((p) => {
      const low = p.platforms.find((x) => x.platform === p.lowestPlatform) ?? p.platforms[0]
      const h = low.history
      const from = h.length > 1 ? h[h.length - 2].price : low.finalPrice
      return {
        name: p.name,
        platform: low.platform,
        from: round(from),
        to: low.finalPrice,
        change: low.change,
      }
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5)
  await writeJson(path, monitor)
}

async function ingestCanonical(kindName, input) {
  const expected = {
    movies: ['movies', 'offers', 'cities', 'cinemas'],
    flights: ['routes', 'offers', 'calendar', 'dates', 'carriers'],
  }[kindName]
  if (!expected) die(`暂不支持 --kind ${kindName}`)
  const data = input.data
  if (!data || typeof data !== 'object') die('数据格式错误')
  const missing = expected.filter((k) => !Array.isArray(data[k]))
  if (missing.length) die(`缺少字段：${missing.join(', ')}（应为数组）`)
  if (!data.offers.length) die('offers 为空')
  data.updatedAt = data.updatedAt || nowCN()
  if (!dryRun) {
    await writeJson(resolve(outDir, `${kindName}.json`), data)
    await writeMarker({ kind: kindName, source: input.label, rows: data.offers.length })
  }
  log('')
  log(`${dryRun ? '试运行（未写入）' : '✓ 数据接入完成'}`)
  log(`  来源  ${input.label}`)
  log(`  记录  offers ${data.offers.length} 条`)
  log(`  输出  ${rel(outDir)}/${kindName}.json${dryRun ? '（dry-run 未写入）' : ''}`)
}

async function checkAll() {
  const problems = []
  const ok = (msg) => log(`  ✓ ${msg}`)

  const products = await readJson(resolve(outDir, 'products.json'))
  if (!products?.products?.length) problems.push('products.json 缺失或为空')
  else {
    const bad = products.products.filter((p) => !p.platforms?.length || !p.platforms.every((x) => x.history?.length))
    if (bad.length) problems.push(`${bad.length} 个商品缺少平台或历史数据`)
    else ok(`products.json：${products.products.length} 商品 · 指数 ${products.index?.length ?? 0} 点 · ${products.updatedAt}`)
  }

  const movies = await readJson(resolve(outDir, 'movies.json'))
  if (!movies?.movies?.length || !movies.offers?.length) problems.push('movies.json 缺失或为空')
  else ok(`movies.json：${movies.movies.length} 部影片 · ${movies.offers.length} 个场次`)

  const flights = await readJson(resolve(outDir, 'flights.json'))
  if (!flights?.routes?.length || !flights.offers?.length) problems.push('flights.json 缺失或为空')
  else ok(`flights.json：${flights.routes.length} 条航线 · ${flights.offers.length} 个航班`)

  const monitor = await readJson(resolve(outDir, 'monitor.json'))
  if (!monitor?.stats || !monitor.tasks?.length) problems.push('monitor.json 缺失或为空')
  else ok(`monitor.json：${monitor.tasks.length} 个任务 · ${monitor.stats.successRate}% 成功率`)

  if (problems.length) {
    problems.forEach((p) => console.error(`  ✗ ${p}`))
    process.exit(1)
  }
  log('\n全部数据文件校验通过')
}

async function writeTemplate() {
  const existing = await readJson(resolve(DEFAULT_OUT, 'products.json'))
  const rows = []
  for (const p of existing?.products ?? []) {
    for (const pl of p.platforms) {
      rows.push([
        p.id,
        p.name,
        p.category,
        p.spec,
        p.unit,
        p.image,
        pl.platform,
        pl.shop,
        pl.price,
        pl.originalPrice,
        pl.coupon,
        pl.sales,
        pl.rating,
        'true',
        (p.tags ?? []).join('|'),
      ])
    }
  }
  const csv = [QUOTE_HEADERS, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
  const target = resolve(REAL_DIR, 'products.csv')
  await mkdir(REAL_DIR, { recursive: true })
  await writeFile(target, `\uFEFF${csv}\n`, 'utf8')
  log(`✓ 已生成导入模板：${rel(target)}（${rows.length} 行，把价格换成真实观测值后运行 npm run ingest）`)
}

/* -------------------------------- 入口 --------------------------------- */

const help = () => {
  log(`PriceLens 真实数据接入

用法：
  node scripts/ingest.mjs --template
      生成 data/real/products.csv 模板（含当前快照）

  node scripts/ingest.mjs --source csv --kind products --file data/real/products.csv
  node scripts/ingest.mjs --source json --kind products --file data/real/products.json
  node scripts/ingest.mjs --source http --kind products --url <接口地址> [--token-env PRICE_API_TOKEN]
  node scripts/ingest.mjs --source json --kind movies  --file data/real/movies.json
  node scripts/ingest.mjs --source json --kind flights --file data/real/flights.json
  node scripts/ingest.mjs --check

可选：
  --dry-run    只校验与聚合，不写文件
  --replace    只保留本次导入的商品（默认保留未出现的商品）
  --seed-mode  append|scale|none，首次接入时如何处理演示历史（默认 append）
  --out <dir>  输出目录，默认 public/data

JSON 报价格式：{ "quotes": [ { "product_id", "name", "platform", "price", ... } ] }
完整格式：与 public/data/products.json 一致。`)
}

async function main() {
  if (flag('help') || args.length === 0) return help()
  if (flag('template')) return writeTemplate()
  if (flag('check')) return checkAll()

  if (!['products', 'movies', 'flights'].includes(kind)) die(`--kind 仅支持 products / movies / flights`)
  if (!source) die('请指定 --source csv|json|http')
  if (!['append', 'scale', 'none'].includes(seedMode)) die('--seed-mode 仅支持 append / scale / none')

  const input = await loadInput()
  if (kind === 'products') return ingestProducts(input)
  return ingestCanonical(kind, input)
}

main().catch((e) => die(e.stack || e.message))

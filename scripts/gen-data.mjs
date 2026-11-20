// 生成演示所需的 30 天价格快照 / 电影票 / 机票 / 监控数据
// 数据为确定性伪随机，保证每次构建结果一致；真实采集见 crawler/ 目录
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/data')

// 导入过真实数据后不再用演示数据覆盖，避免 npm run dev/build 冲掉真实快照
const LIVE_MARKER = resolve(__dirname, '../data/real/last-import.json')
if (existsSync(LIVE_MARKER) && !process.argv.includes('--force')) {
  console.log('检测到真实数据导入（data/real/last-import.json），跳过演示数据生成。')
  console.log('如需恢复演示数据，运行 npm run gen:demo')
  process.exit(0)
}

const TODAY = new Date('2026-11-20T00:00:00+08:00')
const DAY = 86400000

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n, d = 0) => Number(n.toFixed(d))
const fmtDate = (ts) => {
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtFull = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function imageUrl(prompt, size = 'square_hd') {
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`
}

/* ---------------------------------- 商品 ---------------------------------- */

const productDefs = [
  {
    id: 'huawei-band-11',
    name: '华为手环 11',
    category: '智能穿戴',
    spec: '标准版 · 曜石黑',
    unit: '只',
    imagePrompt:
      'studio product photo of a sleek black smart fitness band with curved AMOLED screen on a light cool gray background, soft shadow, minimalist e-commerce catalog style, high detail',
    platforms: [
      { platform: '京东', shop: '华为京东自营旗舰店', price: 249, originalPrice: 299, coupon: 20, sales: '10万+', rating: 4.9 },
      { platform: '天猫', shop: '华为官方旗舰店', price: 259, originalPrice: 299, coupon: 10, sales: '8万+', rating: 4.9 },
      { platform: '拼多多', shop: '华为品牌黑标店', price: 235, originalPrice: 289, coupon: 15, sales: '20万+', rating: 4.8 },
    ],
  },
  {
    id: 'yili-jindian-milk',
    name: '伊利金典牛奶',
    category: '食品生鲜',
    spec: '250ml × 12 盒 / 箱',
    unit: '箱',
    imagePrompt:
      'studio product photo of a premium white and gold milk carton gift box on a warm cream background, clean supermarket catalog style, soft daylight, high detail',
    platforms: [
      { platform: '京东', shop: '伊利京东自营旗舰店', price: 129, originalPrice: 168, coupon: 20, sales: '50万+', rating: 4.8 },
      { platform: '天猫', shop: '伊利官方旗舰店', price: 135, originalPrice: 168, coupon: 15, sales: '30万+', rating: 4.8 },
      { platform: '拼多多', shop: '伊利官方旗舰店', price: 118, originalPrice: 159, coupon: 10, sales: '60万+', rating: 4.7 },
    ],
  },
  {
    id: 'lenovo-xiaoxin-pro14',
    name: '联想电脑',
    category: '电脑办公',
    spec: '小新 Pro 14 · Ultra5 / 32G / 1T',
    unit: '台',
    imagePrompt:
      'studio product photo of a slim silver aluminum laptop open at an angle on a light gray gradient background, premium tech catalog lighting, high detail',
    platforms: [
      { platform: '京东', shop: '联想京东自营旗舰店', price: 5499, originalPrice: 5999, coupon: 200, sales: '5万+', rating: 4.9 },
      { platform: '天猫', shop: '联想官方旗舰店', price: 5599, originalPrice: 5999, coupon: 150, sales: '3万+', rating: 4.8 },
      { platform: '苏宁', shop: '联想苏宁自营', price: 5399, originalPrice: 5899, coupon: 100, sales: '1万+', rating: 4.7 },
    ],
  },
  {
    id: 'apple-iphone-17',
    name: '苹果手机',
    category: '手机通讯',
    spec: 'iPhone 17 256GB · 黑色',
    unit: '部',
    imagePrompt:
      'studio product photo of a black modern smartphone standing upright on a light gray seamless background, premium electronics catalog style, subtle reflection, high detail',
    platforms: [
      { platform: '京东', shop: 'Apple 产品京东自营旗舰店', price: 5999, originalPrice: 6499, coupon: 300, sales: '15万+', rating: 4.9 },
      { platform: '天猫', shop: 'Apple Store 官方旗舰店', price: 5999, originalPrice: 6499, coupon: 250, sales: '12万+', rating: 4.9 },
      { platform: '拼多多', shop: 'Apple 百亿补贴', price: 5699, originalPrice: 6499, coupon: 0, sales: '18万+', rating: 4.8 },
    ],
  },
]

function buildHistory(base, seed, days = 30) {
  const rnd = mulberry32(seed)
  // 均值回归随机游走：围绕当前价小幅波动，叠加两次促销低点，末点对齐当前价
  const prices = []
  let p = base * (0.97 + rnd() * 0.06)
  // 每个平台错开促销日，避免全网指数同时跳水
  const promos = new Set([days - 8 - (seed % 5), days - 19 - (seed % 3)])
  for (let i = 0; i < days; i++) {
    p = p + (base - p) * 0.18 + (rnd() - 0.5) * base * 0.018
    if (promos.has(i)) p *= 0.968
    prices.push(p)
  }
  const scale = base / prices[days - 1]
  const decimals = base > 1000 ? 0 : base > 100 ? 0 : 2
  return prices.map((v, i) => ({
    date: fmtDate(TODAY.getTime() - (days - 1 - i) * DAY),
    price: round(i === days - 1 ? base : v * scale, decimals),
  }))
}

function buildProducts() {
  const products = productDefs.map((def, pi) => {
    const platforms = def.platforms.map((p, i) => {
      const history = buildHistory(p.price, 1000 + pi * 31 + i * 7)
      const min = Math.min(...history.map((h) => h.price))
      const max = Math.max(...history.map((h) => h.price))
      const prev = history[history.length - 2].price
      return {
        ...p,
        finalPrice: round(p.price - p.coupon, 2),
        min30: min,
        max30: max,
        change: round(((p.price - prev) / prev) * 100, 2),
        inStock: true,
        history,
      }
    })
    const lowest = platforms.reduce((a, b) => (b.finalPrice < a.finalPrice ? b : a))
    return {
      id: def.id,
      name: def.name,
      category: def.category,
      spec: def.spec,
      unit: def.unit,
      image: imageUrl(def.imagePrompt),
      tags: [lowest.platform + '最低价', platforms.length + '平台比价'],
      lowestPlatform: lowest.platform,
      lowestPrice: lowest.finalPrice,
      spread: round(Math.max(...platforms.map((p) => p.finalPrice)) - lowest.finalPrice, 2),
      platforms,
    }
  })

  // 全网价格指数：以首日为 100 的加权平均
  const days = products[0].platforms[0].history.length
  const index = []
  for (let d = 0; d < days; d++) {
    let sum = 0
    let count = 0
    for (const p of products) {
      for (const pl of p.platforms) {
        const first = pl.history[0].price
        const cur = pl.history[d].price
        sum += (cur / first) * 100
        count++
      }
    }
    index.push({ date: products[0].platforms[0].history[d].date, value: round(sum / count, 2) })
  }

  return {
    updatedAt: fmtFull(TODAY) + ' 08:00',
    days,
    currency: 'CNY',
    index,
    products,
  }
}

/* --------------------------------- 电影票 --------------------------------- */

const movieDefs = [
  {
    id: 'deep-sea-echo',
    title: '深海回声',
    genre: '科幻 / 悬疑',
    duration: 128,
    score: 8.9,
    poster: '/assets/posters/deep-sea-echo.svg',
  },
  {
    id: 'long-night',
    title: '长夜将明',
    genre: '剧情 / 犯罪',
    duration: 116,
    score: 8.4,
    poster: '/assets/posters/long-night.svg',
  },
  {
    id: 'star-scavenger',
    title: '星际拾荒者',
    genre: '科幻 / 冒险',
    duration: 142,
    score: 8.1,
    poster: '/assets/posters/star-scavenger.svg',
  },
  {
    id: 'mountain-city',
    title: '山城旧事',
    genre: '文艺 / 家庭',
    duration: 104,
    score: 9.0,
    poster: '/assets/posters/mountain-city.svg',
  },
]

const cities = [
  { name: '北京', factor: 1.18 },
  { name: '上海', factor: 1.22 },
  { name: '广州', factor: 1.02 },
  { name: '深圳', factor: 1.08 },
  { name: '成都', factor: 0.9 },
]

const cinemaDefs = [
  { id: 'wanda-cbd', name: '万达影城（CBD 店）', brand: '万达影城', district: '朝阳区' },
  { id: 'cgv-mixc', name: 'CGV 影城（万象城店）', brand: 'CGV', district: '南山区' },
  { id: 'poly-tianan', name: '保利国际影城（天安店）', brand: '保利影业', district: '天河区' },
  { id: 'hengdian-star', name: '横店电影城（星光店）', brand: '横店影视', district: '武侯区' },
  { id: 'lumiaer-raffles', name: '卢米埃影城（来福士店）', brand: '卢米埃', district: '静安区' },
]

const showtimes = [
  { time: '13:30', hall: '激光 2D', factor: 0.78 },
  { time: '16:10', hall: '杜比全景声', factor: 0.92 },
  { time: '19:20', hall: 'IMAX 2D', factor: 1.32 },
  { time: '21:50', hall: '激光 2D', factor: 1.05 },
]

function buildMovies() {
  const offers = []
  movieDefs.forEach((m, mi) => {
    cities.forEach((c, ci) => {
      cinemaDefs.forEach((cin, ki) => {
        showtimes.forEach((s, si) => {
          const rnd = mulberry32(mi * 977 + ci * 131 + ki * 37 + si * 11)
          const base = 42 * c.factor * s.factor * (0.88 + rnd() * 0.3)
          const price = round(base + (ki === 0 ? 6 : 0), 1)
          offers.push({
            movieId: m.id,
            city: c.name,
            cinemaId: cin.id + '-' + ci,
            cinema: cin.name,
            brand: cin.brand,
            district: cin.district,
            format: s.hall,
            time: s.time,
            price,
            seatsLeft: Math.round(6 + rnd() * 60),
            refundable: rnd() > 0.25,
          })
        })
      })
    })
  })
  const cityAvg = cities.map((c) => {
    const list = offers.filter((o) => o.city === c.name)
    return { city: c.name, avg: round(list.reduce((a, b) => a + b.price, 0) / list.length, 1) }
  })

  return {
    updatedAt: fmtFull(TODAY) + ' 08:00',
    cities: cities.map((c) => c.name),
    movies: movieDefs.map((m) => ({
      id: m.id,
      title: m.title,
      genre: m.genre,
      duration: m.duration,
      score: m.score,
      poster: m.poster,
    })),
    cinemas: cinemaDefs,
    offers,
    cityAvg,
  }
}

/* ---------------------------------- 机票 ---------------------------------- */

const routeDefs = [
  { id: 'pek-sha', from: '北京', to: '上海', code: 'PEK → SHA', base: 780, distance: 1080 },
  { id: 'sha-ctu', from: '上海', to: '成都', code: 'SHA → CTU', base: 640, distance: 1660 },
  { id: 'pek-can', from: '北京', to: '广州', code: 'PEK → CAN', base: 920, distance: 1890 },
]

const carrierDefs = [
  { name: '中国国航', code: 'CA', factor: 1.12 },
  { name: '东方航空', code: 'MU', factor: 1.0 },
  { name: '南方航空', code: 'CZ', factor: 0.98 },
  { name: '四川航空', code: '3U', factor: 0.9 },
  { name: '吉祥航空', code: 'HO', factor: 0.86 },
]

const depTimes = ['07:25', '10:40', '14:05', '18:30', '21:45']

function buildFlights() {
  const dates = Array.from({ length: 14 }, (_, i) => {
    const ts = TODAY.getTime() + i * DAY
    const d = new Date(ts)
    return {
      date: fmtDate(ts),
      full: fmtFull(ts),
      weekday: '周' + '日一二三四五六'[d.getDay()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }
  })

  const offers = []
  const calendar = []

  routeDefs.forEach((r, ri) => {
    dates.forEach((d, di) => {
      const rnd = mulberry32(5000 + ri * 211 + di * 13)
      const weekendFactor = d.isWeekend ? 1.16 : 1
      const daysOut = 1 + di * 0.018 // 越临近出发越贵
      let min = Infinity
      carrierDefs.forEach((c, ci) => {
        const stagger = 1 + (rnd() - 0.5) * 0.34
        const price = Math.round((r.base * weekendFactor * daysOut * c.factor * stagger) / 10) * 10
        min = Math.min(min, price)
        offers.push({
          routeId: r.id,
          date: d.full,
          dateShort: d.date,
          carrier: c.name,
          carrierCode: c.code,
          flightNo: `${c.code}${1200 + ri * 311 + ci * 17 + di * 3}`,
          dep: depTimes[ci],
          arr: addHours(depTimes[ci], 2 + ri * 0.4 + ci * 0.1),
          price,
          seats: Math.round(2 + rnd() * 8),
          stops: 0,
          aircraft: ['空客 A320', '波音 737-800', '空客 A321', '波音 787-9'][ci % 4],
        })
      })
      calendar.push({
        routeId: r.id,
        date: d.full,
        dateShort: d.date,
        weekday: d.weekday,
        minPrice: min,
        level: 0,
      })
    })
  })

  // 按每个航线的价格分位计算热度等级
  routeDefs.forEach((r) => {
    const list = calendar.filter((c) => c.routeId === r.id)
    const sorted = [...list].map((c) => c.minPrice).sort((a, b) => a - b)
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
    list.forEach((c) => {
      if (c.minPrice <= q(0.25)) c.level = 0
      else if (c.minPrice <= q(0.5)) c.level = 1
      else if (c.minPrice <= q(0.75)) c.level = 2
      else c.level = 3
    })
  })

  return {
    updatedAt: fmtFull(TODAY) + ' 08:00',
    routes: routeDefs.map(({ id, from, to, code, distance }) => ({ id, from, to, code, distance })),
    dates,
    carriers: carrierDefs.map(({ name, code }) => ({ name, code })),
    offers,
    calendar,
  }
}

function addHours(hhmm, hours) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + Math.round(hours * 60)
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

/* --------------------------------- 监控大屏 -------------------------------- */

function buildMonitor(products) {
  const tasks = [
    { name: '京东 · 商品价格', type: '商品', target: '4 个 SKU', interval: '每 2 小时', lastRun: '08:00', duration: 42, successRate: 99.2, status: 'running' },
    { name: '天猫 · 商品价格', type: '商品', target: '4 个 SKU', interval: '每 2 小时', lastRun: '08:02', duration: 51, successRate: 98.6, status: 'running' },
    { name: '拼多多 · 商品价格', type: '商品', target: '4 个 SKU', interval: '每 2 小时', lastRun: '08:05', duration: 37, successRate: 97.4, status: 'running' },
    { name: '苏宁 · 商品价格', type: '商品', target: '1 个 SKU', interval: '每 4 小时', lastRun: '06:10', duration: 22, successRate: 100, status: 'idle' },
    { name: '猫眼 · 电影票价', type: '电影票', target: '5 城 100 场次', interval: '每 1 小时', lastRun: '08:10', duration: 68, successRate: 96.8, status: 'running' },
    { name: '淘票票 · 电影票价', type: '电影票', target: '5 城 100 场次', interval: '每 1 小时', lastRun: '07:12', duration: 74, successRate: 95.1, status: 'warning' },
    { name: '携程 · 机票价格', type: '机票', target: '3 条航线 × 14 天', interval: '每 4 小时', lastRun: '06:20', duration: 96, successRate: 97.9, status: 'idle' },
    { name: '飞猪 · 机票价格', type: '机票', target: '3 条航线 × 14 天', interval: '每 4 小时', lastRun: '07:30', duration: 88, successRate: 94.3, status: 'warning' },
  ]

  const alerts = [
    { id: 'AL-2311', level: 'high', title: '苹果手机 京东价格跌破 5700', detail: '当前 ¥5,699，较 7 日均价下降 4.8%，已触达目标价', time: '08:12' },
    { id: 'AL-2310', level: 'medium', title: '淘票票采集连续 2 次超时', detail: '北京地区场次接口响应 > 30s，已自动降低并发至 2', time: '07:41' },
    { id: 'AL-2309', level: 'medium', title: '飞猪机票字段缺失率升高', detail: '退改签规则缺失 6.2%，可能为页面改版', time: '07:33' },
    { id: 'AL-2308', level: 'low', title: '伊利金典牛奶 拼多多补货', detail: '华东仓恢复库存，价格 ¥118', time: '06:58' },
  ]

  const movers = []
  for (const p of products) {
    for (const pl of p.platforms) {
      const last = pl.history[pl.history.length - 1]
      const prev = pl.history[pl.history.length - 2]
      movers.push({
        name: p.name,
        platform: pl.platform,
        from: prev.price,
        to: last.price,
        change: round(((last.price - prev.price) / prev.price) * 100, 2),
      })
    }
  }
  movers.sort((a, b) => a.change - b.change)

  const timeline = Array.from({ length: 24 }, (_, h) => {
    const rnd = mulberry32(900 + h)
    const success = Math.round(16 + rnd() * 6)
    const failed = rnd() < 0.3 ? 1 : 0
    return { hour: String(h).padStart(2, '0'), success, failed }
  })

  const totalSuccess = timeline.reduce((a, b) => a + b.success, 0)
  const totalFailed = timeline.reduce((a, b) => a + b.failed, 0)

  return {
    updatedAt: fmtFull(TODAY) + ' 08:15',
    stats: {
      products: products.length,
      skus: products.reduce((a, p) => a + p.platforms.length, 0),
      crawlToday: totalSuccess,
      successRate: round((totalSuccess / (totalSuccess + totalFailed)) * 100, 1),
      alerts: alerts.filter((a) => a.level !== 'low').length,
      tasks: tasks.length,
    },
    tasks,
    alerts,
    movers: [...movers.slice(0, 5), ...movers.slice(-3).reverse()],
    timeline,
  }
}

/* ---------------------------------- 输出 ---------------------------------- */

await mkdir(OUT, { recursive: true })

const products = buildProducts()
const movies = buildMovies()
const flights = buildFlights()

await writeFile(resolve(OUT, 'products.json'), JSON.stringify(products, null, 2))
await writeFile(resolve(OUT, 'movies.json'), JSON.stringify(movies, null, 2))
await writeFile(resolve(OUT, 'flights.json'), JSON.stringify(flights, null, 2))
await writeFile(resolve(OUT, 'monitor.json'), JSON.stringify(buildMonitor(products.products), null, 2))

console.log('data generated → public/data')

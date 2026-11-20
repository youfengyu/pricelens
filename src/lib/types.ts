export interface PricePoint {
  date: string
  price: number
}

export interface PlatformPrice {
  platform: string
  shop: string
  price: number
  originalPrice: number
  coupon: number
  sales: string
  rating: number
  finalPrice: number
  min30: number
  max30: number
  change: number
  inStock: boolean
  history: PricePoint[]
}

export interface Product {
  id: string
  name: string
  category: string
  spec: string
  unit: string
  image: string
  tags: string[]
  lowestPlatform: string
  lowestPrice: number
  spread: number
  platforms: PlatformPrice[]
}

export interface ProductsData {
  updatedAt: string
  days: number
  currency: string
  index: { date: string; value: number }[]
  products: Product[]
}

export interface Movie {
  id: string
  title: string
  genre: string
  duration: number
  score: number
  poster: string
}

export interface MovieOffer {
  movieId: string
  city: string
  cinemaId: string
  cinema: string
  brand: string
  district: string
  format: string
  time: string
  price: number
  seatsLeft: number
  refundable: boolean
}

export interface MoviesData {
  updatedAt: string
  cities: string[]
  movies: Movie[]
  cinemas: { id: string; name: string; brand: string; district: string }[]
  offers: MovieOffer[]
  cityAvg: { city: string; avg: number }[]
}

export interface Route {
  id: string
  from: string
  to: string
  code: string
  distance: number
}

export interface FlightOffer {
  routeId: string
  date: string
  dateShort: string
  carrier: string
  carrierCode: string
  flightNo: string
  dep: string
  arr: string
  price: number
  seats: number
  stops: number
  aircraft: string
}

export interface CalendarCell {
  routeId: string
  date: string
  dateShort: string
  weekday: string
  minPrice: number
  level: number
}

export interface FlightsData {
  updatedAt: string
  routes: Route[]
  dates: { date: string; full: string; weekday: string; isWeekend: boolean }[]
  carriers: { name: string; code: string }[]
  offers: FlightOffer[]
  calendar: CalendarCell[]
}

export interface CrawlTask {
  name: string
  type: string
  target: string
  interval: string
  lastRun: string
  duration: number
  successRate: number
  status: 'running' | 'idle' | 'warning'
}

export interface MonitorAlert {
  id: string
  level: 'high' | 'medium' | 'low'
  title: string
  detail: string
  time: string
}

export interface Mover {
  name: string
  platform: string
  from: number
  to: number
  change: number
}

export interface MonitorData {
  updatedAt: string
  stats: {
    products: number
    skus: number
    crawlToday: number
    successRate: number
    alerts: number
    tasks: number
  }
  tasks: CrawlTask[]
  alerts: MonitorAlert[]
  movers: Mover[]
  timeline: { hour: string; success: number; failed: number }[]
}

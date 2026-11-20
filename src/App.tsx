import { Sidebar } from './components/Sidebar'
import { useHashRoute } from './lib/data'
import { Overview } from './pages/Overview'
import { Search } from './pages/Search'
import { Products } from './pages/Products'
import { Movies } from './pages/Movies'
import { Flights } from './pages/Flights'
import { Monitor } from './pages/Monitor'

export default function App() {
  const route = useHashRoute()

  return (
    <div className="app">
      <Sidebar route={route} />
      <main className="main">
        {route === 'search' && <Search />}
        {route === 'products' && <Products />}
        {route === 'movies' && <Movies />}
        {route === 'flights' && <Flights />}
        {route === 'monitor' && <Monitor />}
        {(route === 'overview' || !['search', 'products', 'movies', 'flights', 'monitor'].includes(route)) && <Overview />}
      </main>
    </div>
  )
}

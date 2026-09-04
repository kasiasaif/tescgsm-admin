import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { labelForCategory } from '../data/catalog'
import { formatPrice } from '../lib/money'

export function Dashboard() {
  const { products } = useAuth()
  const live = products.filter((item) => item.active !== false)
  const hidden = products.length - live.length
  const groups = [...new Set(live.map((item) => item.category))]
  const apple = live.filter((item) => item.brand === 'Apple').length
  const value = live.reduce((sum, item) => sum + item.price, 0)
  const recent = products.slice(0, 6)

  return (
    <div className="stack">
      <div className="stat-grid">
        <article className="stat-card">
          <p>Products</p>
          <strong>{live.length}</strong>
          <small>{hidden ? `${hidden} hidden` : 'Live on the shop'}</small>
        </article>
        <article className="stat-card">
          <p>Categories</p>
          <strong>{groups.length}</strong>
          <small>With active parts</small>
        </article>
        <article className="stat-card">
          <p>Hidden parts</p>
          <strong>{hidden}</strong>
          <small>Not shown on the shop</small>
        </article>
        <article className="stat-card">
          <p>Catalog value</p>
          <strong>{formatPrice(value)}</strong>
          <small>{apple} Apple SKUs</small>
        </article>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Catalog snapshot</h2>
            <p className="muted">Parts currently in the products table.</p>
          </div>
          <Link className="button" to="/products">
            Manage products
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <div className="cell-sub">{product.model}</div>
                  </td>
                  <td>{product.brand}</td>
                  <td>{labelForCategory(product.category)}{product.active === false ? ' · hidden' : ''}</td>
                  <td>{formatPrice(product.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

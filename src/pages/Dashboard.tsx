import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { formatPrice } from '../lib/money'

export function Dashboard() {
  const { products } = useAuth()
  const batteries = products.filter((item) => item.category === 'Batteries').length
  const lcd = products.filter((item) => item.category === 'LCD').length
  const apple = products.filter((item) => item.brand === 'Apple').length
  const value = products.reduce((sum, item) => sum + item.price, 0)
  const recent = products.slice(0, 6)

  return (
    <div className="stack">
      <div className="stat-grid">
        <article className="stat-card">
          <p>Products</p>
          <strong>{products.length}</strong>
          <small>Live in MySQL</small>
        </article>
        <article className="stat-card">
          <p>Batteries</p>
          <strong>{batteries}</strong>
          <small>In catalog</small>
        </article>
        <article className="stat-card">
          <p>LCD screens</p>
          <strong>{lcd}</strong>
          <small>In catalog</small>
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
                  <td>{product.category}</td>
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

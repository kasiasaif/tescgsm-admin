import { adminUrl, shopUrl } from '../config'

export function Settings() {
  return (
    <div className="stack">
      <section className="panel">
        <h2>Workspace</h2>
        <dl className="meta-list">
          <div>
            <dt>Shop</dt>
            <dd>
              <a href={shopUrl} target="_blank" rel="noreferrer">
                {shopUrl.replace(/^https?:\/\//, '')}
              </a>
              <p className="muted">This admin and the shop both use the live catalog. Save here, then open the shop.</p>
            </dd>
          </div>
          <div>
            <dt>Admin</dt>
            <dd>
              <a href={adminUrl} target="_blank" rel="noreferrer">
                {adminUrl.replace(/^https?:\/\//, '')}
              </a>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

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
                tescgsm.es
              </a>
            </dd>
          </div>
          <div>
            <dt>Admin</dt>
            <dd>
              <a href={adminUrl} target="_blank" rel="noreferrer">
                admin.tescgsm.es
              </a>
            </dd>
          </div>
          <div>
            <dt>MySQL</dt>
            <dd>127.0.0.1:3306 · schema tescgsm · user tescgsm</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

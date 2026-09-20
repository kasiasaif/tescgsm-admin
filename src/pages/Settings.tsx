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
                tescgsm-admin.es
              </a>
            </dd>
          </div>
          <div>
            <dt>MySQL</dt>
            <dd>Set in local `.env` (not stored in git)</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

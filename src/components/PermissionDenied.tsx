import { useAuth } from '../auth'

export function PermissionDenied() {
  const { deniedOpen, closeDenied } = useAuth()
  if (!deniedOpen) return null

  return (
    <div className="modal-scrim">
      <button
        type="button"
        className="modal-scrim-hit"
        aria-label="Dismiss permission message"
        onClick={closeDenied}
      />
      <div
        className="modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="permission-denied-title"
        aria-describedby="permission-denied-body"
      >
        <h2 id="permission-denied-title">Permission denied</h2>
        <p id="permission-denied-body">You don't have permissions for this action.</p>
        <button className="button button-primary" type="button" onClick={closeDenied}>
          OK
        </button>
      </div>
    </div>
  )
}

type ActiveSwitchProps = {
  checked: boolean
  onChange: (active: boolean) => void
}

export function ActiveSwitch({ checked, onChange }: ActiveSwitchProps) {
  return (
    <div className="admin-wide switch-row">
      <span className={checked ? 'switch-caption is-on' : 'switch-caption'}>Active</span>
      <label className={checked ? 'switch is-on' : 'switch'}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={checked ? 'Active' : 'Disable'}
        />
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
      </label>
      <span className={!checked ? 'switch-caption is-on' : 'switch-caption'}>Disable</span>
    </div>
  )
}

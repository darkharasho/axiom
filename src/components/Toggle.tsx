interface Props {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ id, checked, onChange }: Props) {
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span style={{
        position: 'relative',
        display: 'inline-block',
        width: 32,
        height: 18,
        borderRadius: 9,
        background: checked ? 'var(--gold)' : 'var(--border)',
        border: `1px solid ${checked ? 'var(--gold)' : 'var(--text-faint)'}`,
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute',
          top: 2,
          left: checked ? 15 : 2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: checked ? 'var(--bg)' : 'var(--text-faint)',
          transition: 'left 0.2s, background 0.2s',
        }} />
      </span>
    </label>
  )
}

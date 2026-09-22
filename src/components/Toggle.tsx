import type { CSSProperties } from 'react'

interface Props {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/* axi's .axi-switch, which axiom asked for: the language had no on/off control
   until v1.4 and this component used to hand-roll one. The whole state is the
   aria-checked attribute, so there is nothing to keep in sync and a screen
   reader gets the switch role for free. */
export function Toggle({ id, checked, onChange }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="axi-switch"
      style={{ '--axi-switch-w': '36px', '--axi-switch-h': '20px', '--axi-switch-knob': '12px' } as CSSProperties}
    >
      <span className="axi-switch__knob" />
    </button>
  )
}

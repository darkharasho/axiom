import type { CSSProperties } from 'react'
import type { DownloadProgress } from '@shared/types'

interface Props {
  progress: DownloadProgress
}

/* Rule 9: a quantity is length. The meter is axi's; --axi-meter-v is how full
   it is and is the only thing this component computes. */
export function ProgressBar({ progress }: Props) {
  const pct = Math.min(100, Math.round(progress.percent))
  const mb = (b: number) => (b / 1000 / 1000).toFixed(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 96 }}>
      <div className="axi-meter" style={{ '--axi-meter-h': '10px' } as CSSProperties}>
        <span className="axi-meter__fill" style={{ '--axi-meter-v': `${pct}%` } as CSSProperties} />
      </div>
      <span
        className="axi-item__note"
        style={{ marginTop: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      >
        {progress.totalBytes > 0
          ? `${mb(progress.bytesReceived)} / ${mb(progress.totalBytes)} MB`
          : `${pct}%`}
      </span>
    </div>
  )
}

import type { DownloadProgress } from '@shared/types'

interface Props {
  progress: DownloadProgress
}

export function ProgressBar({ progress }: Props) {
  const pct = Math.min(100, Math.round(progress.percent))
  const mb = (b: number) => (b / 1024 / 1024).toFixed(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 90 }}>
      <div style={{
        height: 4,
        background: 'var(--border)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--gold)',
          borderRadius: 2,
          transition: 'width 0.1s linear',
        }} />
      </div>
      <span style={{ color: 'var(--text-dim)', fontSize: 9, textAlign: 'right' }}>
        {progress.totalBytes > 0
          ? `${mb(progress.bytesReceived)} / ${mb(progress.totalBytes)} MB`
          : `${pct}%`}
      </span>
    </div>
  )
}

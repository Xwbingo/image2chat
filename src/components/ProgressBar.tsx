import { useGenerationProgress } from '@/hooks/useGenerationProgress'

export function ProgressBar() {
  const percent = useGenerationProgress((s) => s.percent)
  const isActive = useGenerationProgress((s) => s.isActive)
  if (!isActive) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          width: `${percent}%`,
          height: '100%',
          background: 'linear-gradient(90deg, hsl(262 83% 58%), hsl(262 83% 58% / 0.7))',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}
import { render, screen, act } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'
import { useGenerationProgress } from '@/hooks/useGenerationProgress'

afterEach(() => {
  act(() => {
    useGenerationProgress.getState().stop()
  })
})

it('renders nothing when not active', () => {
  render(<ProgressBar />)
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

it('renders progress bar at top when active', () => {
  render(<ProgressBar />)
  act(() => {
    useGenerationProgress.getState().start('1024x1024', false)
  })
  const bar = screen.getByRole('progressbar')
  expect(bar).toBeInTheDocument()
  // top-fixed + z-index 60
  const container = bar.parentElement
  expect(container).toHaveStyle({ position: 'fixed', top: '0px', zIndex: '60' })
})
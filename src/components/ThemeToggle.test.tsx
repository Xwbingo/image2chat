import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'
import { useSession } from '@/stores/useSession'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  localStorage.removeItem('i2c.theme')
  useSession.setState({ theme: 'system', resolvedTheme: 'light' })
})

it('toggles theme on click: system → dark → light → system', async () => {
  render(<ThemeToggle />)
  const btn = screen.getByRole('button')

  expect(useSession.getState().theme).toBe('system')
  expect(document.documentElement.classList.contains('dark')).toBe(false)

  await userEvent.click(btn)
  expect(useSession.getState().theme).toBe('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)

  await userEvent.click(btn)
  expect(useSession.getState().theme).toBe('light')
  expect(document.documentElement.classList.contains('dark')).toBe(false)

  await userEvent.click(btn)
  expect(useSession.getState().theme).toBe('system')
})

it('persists theme to localStorage', async () => {
  render(<ThemeToggle />)
  await userEvent.click(screen.getByRole('button'))
  expect(localStorage.getItem('i2c.theme')).toBe('dark')
})
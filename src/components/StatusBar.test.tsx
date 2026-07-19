import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { StatusBar } from './StatusBar'

beforeEach(async () => { await db.delete(); await db.open(); localStorage.clear() })

it('renders current provider and size', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  expect(await screen.findByText(/Packy/)).toBeInTheDocument()
  expect(screen.getByText(/2K 横向/)).toBeInTheDocument()
})

it('shows unconfigured provider state', async () => {
  await db.providers.add({ name: 'RunAPI', baseUrl: 'u', apiKey: '', type: 'runapi', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await screen.findByText(/未配置/)
  await userEvent.click(screen.getByText(/未配置/))
  expect(await screen.findByText('RunAPI')).toBeInTheDocument()
  expect(screen.getByText('(未配置)')).toBeInTheDocument()
})

it('makes the 4K tier reachable through a scrollable sheet', async () => {
  render(<StatusBar />)
  await userEvent.click(screen.getByText(/2K 横向/))
  const dialog = screen.getByRole('dialog')

  expect(dialog).toHaveClass('max-h-[85vh]', 'overflow-y-auto')
  expect(screen.getByText('4K', { exact: true })).toHaveClass('sticky', 'top-0', 'bg-background')
  expect(screen.getByText('4K 横向')).toBeInTheDocument()
})

it('opens param sheet on size click and selects new size', async () => {
  render(<StatusBar />)
  await userEvent.click(screen.getByText(/2K 横向/))
  expect(screen.getByText(/1:1/)).toBeInTheDocument()
  await userEvent.click(screen.getByText(/1:1/))
  expect(localStorage.getItem('i2c.defaultSize')).toBe('1024x1024')
})

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

it('opens param sheet on size click and selects new size', async () => {
  render(<StatusBar />)
  await userEvent.click(screen.getByText(/2K 横向/))
  expect(screen.getByText(/1:1/)).toBeInTheDocument()
  await userEvent.click(screen.getByText(/1:1/))
  expect(localStorage.getItem('i2c.defaultSize')).toBe('1024x1024')
})

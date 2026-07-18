import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { Sidebar } from './Sidebar'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders empty state', () => {
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  expect(screen.getByText('新建对话')).toBeInTheDocument()
})

it('lists conversations and calls onSelect on click', async () => {
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })
  await db.conversations.add({ title: 'Beta', createdAt: 0, updatedAt: 2, providerPresetId: pid })
  const onSelect = vi.fn()
  render(<Sidebar onSelect={onSelect} onNew={() => {}} />)
  expect(await screen.findByText('Alpha')).toBeInTheDocument()
  expect(screen.getByText('Beta')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Alpha'))
  expect(onSelect).toHaveBeenCalledWith(expect.any(Number))
})
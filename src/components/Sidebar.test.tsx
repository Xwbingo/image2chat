import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { Sidebar } from './Sidebar'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders empty state', () => {
  render(<Sidebar onSelect={() => {}} onNew={() => {}} hasConfiguredKey />)
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

it('renders new-chat as theme card with purple gradient', () => {
  const { container } = render(<Sidebar onSelect={() => {}} onNew={() => {}} hasConfiguredKey />)
  const card = screen.getByText('新建对话').closest('[data-card]')
  expect(card).toBeInTheDocument()
  expect(card).toHaveStyle({ backgroundImage: 'var(--gradient-purple)' })
})

it('shows amber left bar for conversations with generating messages', async () => {
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  await db.messages.add({
    conversationId: cid, role: 'assistant', prompt: 'x',
    status: 'generating', kind: 'image_generation', createdAt: Date.now(),
  })
  render(<Sidebar onSelect={() => {}} onNew={() => {}} activeId={cid} />)
  await vi.waitFor(() => {
    const item = screen.getByText('Alpha').closest('[data-conversation]')
    expect(item).toHaveStyle({ '--bar-color': 'var(--status-generating-bar)' })
  })
})

it('shows red left bar for conversations with failed messages', async () => {
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Fail', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  await db.messages.add({
    conversationId: cid, role: 'assistant', prompt: 'x',
    status: 'failed', kind: 'image_generation', createdAt: Date.now(),
  })
  render(<Sidebar onSelect={() => {}} onNew={() => {}} activeId={cid} />)
  await vi.waitFor(() => {
    const item = screen.getByText('Fail').closest('[data-conversation]')
    expect(item).toHaveStyle({ '--bar-color': 'var(--status-failed-bar)' })
  })
  const css = readFileSync(resolve(__dirname, '../styles/globals.css'), 'utf8')
  expect(css).toMatch(/--status-failed-bar:\s*linear-gradient/)
})
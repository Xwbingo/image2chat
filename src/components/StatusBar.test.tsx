import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { StatusBar } from './StatusBar'
import { useSettings } from '@/stores/useSettings'

const { setConversationProviderMock } = vi.hoisted(() => ({
  setConversationProviderMock: vi.fn(),
}))

vi.mock('@/lib/repo', () => ({
  setConversationProvider: setConversationProviderMock,
}))

beforeEach(async () => {
  setConversationProviderMock.mockReset()
  setConversationProviderMock.mockResolvedValue(undefined)
  await db.delete()
  await db.open()
  localStorage.clear()
  useSettings.setState({ open: false })
})

async function toggle() {
  return screen.findByTestId('status-bar-toggle')
}

it('renders the read-only summary row with provider name and size label', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  expect(await screen.findByTestId('provider-name')).toHaveTextContent('Packy')
  expect(screen.getByTestId('size-name')).toHaveTextContent('2K 横向')
  const row = await toggle()
  expect(row).toHaveAttribute('aria-expanded', 'false')
})

it('toggles the popover when the header is clicked twice', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  await waitFor(() => {
    expect(screen.getByTestId('status-bar-toggle')).toHaveAttribute('aria-expanded', 'true')
  })
  await userEvent.click(screen.getByTestId('status-bar-toggle'))
  await waitFor(() => {
    expect(screen.getByTestId('status-bar-toggle')).toHaveAttribute('aria-expanded', 'false')
  })
})

it('renders three size buckets: 1K, 2K, 4K', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  const popover = await screen.findByTestId('status-bar-popover')
  const buckets = popover.querySelectorAll('[data-role="size-bucket-toggle"]')
  expect(buckets).toHaveLength(3)
  expect(buckets[0]).toHaveTextContent('1K')
  expect(buckets[1]).toHaveTextContent('2K')
  expect(buckets[2]).toHaveTextContent('4K')
})

it('auto-expands the active size bucket on open and collapses the others', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  const popover = await screen.findByTestId('status-bar-popover')
  const buckets = Array.from(popover.querySelectorAll<HTMLElement>('[data-role="size-bucket-toggle"]'))
  const twoKBucket = buckets.find((b) => b.textContent?.includes('2K'))
  expect(twoKBucket).toHaveAttribute('aria-expanded', 'true')
})

it('keeps the provider and size buckets mutually exclusive', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())

  const popover = await screen.findByTestId('status-bar-popover')
  const providerToggle = popover.querySelector<HTMLElement>('[data-role="provider-bucket-toggle"]')!
  const buckets = Array.from(popover.querySelectorAll<HTMLElement>('[data-role="size-bucket-toggle"]'))
  const fourKBucket = buckets.find((bucket) => bucket.textContent?.startsWith('4K'))!

  await userEvent.click(providerToggle)
  expect(providerToggle).toHaveAttribute('aria-expanded', 'true')
  expect(buckets.every((bucket) => bucket.getAttribute('aria-expanded') === 'false')).toBe(true)

  await userEvent.click(fourKBucket)
  expect(providerToggle).toHaveAttribute('aria-expanded', 'false')
  expect(fourKBucket).toHaveAttribute('aria-expanded', 'true')
  expect(buckets.filter((bucket) => bucket !== fourKBucket).every((bucket) => bucket.getAttribute('aria-expanded') === 'false')).toBe(true)

  await userEvent.click(providerToggle)
  expect(providerToggle).toHaveAttribute('aria-expanded', 'true')
  expect(fourKBucket).toHaveAttribute('aria-expanded', 'false')
})

it('always renders 1K, 2K, and 4K buckets when packy supports all sizes', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  const popover = await screen.findByTestId('status-bar-popover')
  expect(popover.querySelectorAll('[data-role="size-bucket-toggle"]')).toHaveLength(3)
})

it('does not close when clicking outside the popover', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  await waitFor(() => {
    expect(screen.getByTestId('status-bar-toggle')).toHaveAttribute('aria-expanded', 'true')
  })
  document.body.click()
  expect(screen.getByTestId('status-bar-toggle')).toHaveAttribute('aria-expanded', 'true')
})

it('renders a provider bucket toggle that starts collapsed', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  const popover = await screen.findByTestId('status-bar-popover')
  const providerToggle = popover.querySelector('[data-role="provider-bucket-toggle"]') as HTMLElement | null
  expect(providerToggle).toBeTruthy()
  expect(providerToggle).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(providerToggle!)
  await waitFor(() => {
    expect(providerToggle).toHaveAttribute('aria-expanded', 'true')
  })
})

it('selects the provider and keeps the popover open', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  await db.providers.add({ name: 'Other', baseUrl: 'o', apiKey: 'k2', type: 'custom', isBuiltIn: 0, createdAt: 1 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  const popover = await screen.findByTestId('status-bar-popover')
  await userEvent.click(popover.querySelector('[data-role="provider-bucket-toggle"]')!)
  await userEvent.click(screen.getByRole('button', { name: /^Other/ }))
  expect(screen.getByTestId('status-bar-toggle')).toHaveAttribute('aria-expanded', 'true')
  expect(localStorage.getItem('i2c.activeProviderId')).toBe('2')
})

it('keeps the immediate provider selection when conversation persistence rejects', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  await db.providers.add({ name: 'Other', baseUrl: 'o', apiKey: 'k2', type: 'custom', isBuiltIn: 0, createdAt: 1 })
  setConversationProviderMock.mockRejectedValueOnce(new Error('persistence failed'))
  render(<StatusBar activeConversationId={42} />)

  await userEvent.click(await toggle())
  const popover = await screen.findByTestId('status-bar-popover')
  await userEvent.click(popover.querySelector('[data-role="provider-bucket-toggle"]')!)
  await userEvent.click(screen.getByRole('button', { name: /^Other/ }))

  await waitFor(() => {
    expect(setConversationProviderMock).toHaveBeenCalledWith(42, 2)
    expect(screen.getByTestId('provider-name')).toHaveTextContent('Other')
    expect(localStorage.getItem('i2c.activeProviderId')).toBe('2')
  })
})

it('selects the size and keeps the popover open', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  await userEvent.click(screen.getByRole('button', { name: /^1K$/ }))
  await userEvent.click(screen.getByRole('button', { name: /1:1.*1024/ }))
  expect(screen.getByTestId('status-bar-toggle')).toHaveAttribute('aria-expanded', 'true')
  expect(localStorage.getItem('i2c.defaultSize')).toBe('1024x1024')
})

it('does not render a 完成 button or helper chip-copy', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  const popover = await screen.findByTestId('status-bar-popover')
  expect(popover.querySelector('button[role="done"]')).toBeNull()
  expect(screen.queryByRole('button', { name: '完成' })).not.toBeInTheDocument()
})

it('renders the 未配置 chip and opens settings when there is no provider', async () => {
  render(<StatusBar />)
  const chip = await screen.findByRole('button', { name: /未配置/ })
  await userEvent.click(chip)
  await waitFor(() => {
    expect(useSettings.getState().open).toBe(true)
  })
})

it('positions the popover absolutely so the bottom dock height is unchanged', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await toggle())
  const popover = await screen.findByTestId('status-bar-popover')
  expect(popover).toHaveClass('absolute')
})

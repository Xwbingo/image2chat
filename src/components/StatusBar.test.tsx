import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { StatusBar } from './StatusBar'
import { useSettings } from '@/stores/useSettings'

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  useSettings.setState({ open: false })
})

async function waitForDefaultRow(providerName = 'Packy') {
  return screen.findByRole('button', { name: new RegExp(`当前：${providerName}`) })
}

it('renders current provider and size in the default row chips', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  expect(await waitForDefaultRow('Packy')).toBeInTheDocument()
  expect(screen.getByText(/尺寸：2K 横向/)).toBeInTheDocument()
})

it('renders the status bar as a rounded card with the documented classes', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  const { container } = render(<StatusBar />)
  const card = await screen.findByTestId('status-bar-card')
  expect(card).toHaveClass('rounded-2xl')
  expect(card).toHaveClass('border')
  expect(card).toHaveClass('border-border')
  expect(card).toHaveClass('bg-card')
  expect(card).toHaveClass('shadow-sm')
  expect(card).toBe(container.firstChild)
})

it('toggles the expanded popover when the default row is clicked', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  expect(screen.queryByTestId('status-bar-popover')).not.toBeInTheDocument()
  await userEvent.click(await waitForDefaultRow('Packy'))
  expect(await screen.findByTestId('status-bar-popover')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /当前：Packy/ }))
  expect(screen.queryByTestId('status-bar-popover')).not.toBeInTheDocument()
})

it('shows vertical provider chips in the expanded popover', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  await db.providers.add({ name: 'Other', baseUrl: 'o', apiKey: 'k2', type: 'custom', isBuiltIn: 0, createdAt: 1 })
  render(<StatusBar />)
  await userEvent.click(await waitForDefaultRow('Packy'))
  const popover = await screen.findByTestId('status-bar-popover')
  const providerButtons = popover.querySelectorAll('[data-role="provider-chip"]')
  expect(providerButtons).toHaveLength(2)
  expect(providerButtons[0]).toHaveTextContent('Packy')
  expect(providerButtons[1]).toHaveTextContent('Other')
})

it('shows vertical size chips in the expanded popover', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await waitForDefaultRow('Packy'))
  const popover = await screen.findByTestId('status-bar-popover')
  const sizeButtons = popover.querySelectorAll('[data-role="size-chip"]')
  expect(sizeButtons.length).toBeGreaterThan(0)
  expect(Array.from(sizeButtons).some((b) => b.textContent?.includes('1:1'))).toBe(true)
  expect(Array.from(sizeButtons).some((b) => b.textContent?.includes('2K 横向'))).toBe(true)
})

it('keeps the popover open and selects the provider when a provider chip is clicked', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  await db.providers.add({ name: 'Other', baseUrl: 'o', apiKey: 'k2', type: 'custom', isBuiltIn: 0, createdAt: 1 })
  render(<StatusBar />)
  await userEvent.click(await waitForDefaultRow('Packy'))
  await userEvent.click(screen.getByRole('button', { name: /^Other$/ }))
  expect(screen.getByTestId('status-bar-popover')).toBeInTheDocument()
  expect(localStorage.getItem('i2c.activeProviderId')).toBe('2')
})

it('keeps the popover open and selects the size when a size chip is clicked', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await waitForDefaultRow('Packy'))
  await userEvent.click(screen.getByRole('button', { name: /1:1/ }))
  expect(screen.getByTestId('status-bar-popover')).toBeInTheDocument()
  expect(localStorage.getItem('i2c.defaultSize')).toBe('1024x1024')
})

it('renders a 完成 button in the expanded popover that collapses the popover', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await waitForDefaultRow('Packy'))
  const done = await screen.findByRole('button', { name: '完成' })
  await userEvent.click(done)
  expect(screen.queryByTestId('status-bar-popover')).not.toBeInTheDocument()
})

it('renders a helper text line inside the expanded popover', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await waitForDefaultRow('Packy'))
  const popover = await screen.findByTestId('status-bar-popover')
  expect(popover.querySelector('[data-role="helper-text"]')).not.toBeNull()
})

it('renders the 未配置 chip and opens settings when there is no provider', async () => {
  render(<StatusBar />)
  const chip = await screen.findByRole('button', { name: /未配置/ })
  expect(chip).toBeInTheDocument()
  await userEvent.click(chip)
  await waitFor(() => {
    expect(useSettings.getState().open).toBe(true)
  })
})

it('positions the expanded popover absolutely so the bottom dock height is unchanged', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  await userEvent.click(await waitForDefaultRow('Packy'))
  const popover = await screen.findByTestId('status-bar-popover')
  expect(popover).toHaveClass('absolute')
})
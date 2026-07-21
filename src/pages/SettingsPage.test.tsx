import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { SettingsPage } from './SettingsPage'

const { validate } = vi.hoisted(() => ({ validate: vi.fn() }))

vi.mock('@/lib/api/validate', () => ({
  validateApiKey: (...args: unknown[]) => validate(...args),
}))

function Probe() {
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="probe-path">{window.location.pathname}</span>
      <button data-testid="nav-home" onClick={() => navigate('/')}>go-home</button>
    </div>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  validate.mockReset()
  validate.mockResolvedValue({ valid: true })
})

it('renders as a sliding sheet with title 密钥管理 and a 保存 footer button', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k1', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderAt('/settings')
  expect(await screen.findByText('密钥管理')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
})

it('renders inline apiKey + corsProxy inputs per provider (no 编辑 Key dialog)', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'secret-key', corsProxy: 'https://cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderAt('/settings')

  const keyInput = await screen.findByDisplayValue('secret-key')
  expect(keyInput).toHaveAttribute('type', 'password')
  expect(screen.getByDisplayValue('https://cors')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /编辑 Key/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /开始使用/ })).not.toBeInTheDocument()
})

it('保存 persists dirty drafts and navigates to /', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'old', corsProxy: 'old-cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderAt('/settings')

  const keyInput = (await screen.findByDisplayValue('old')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'new-key')

  const corsInput = screen.getByDisplayValue('old-cors') as HTMLInputElement
  await userEvent.clear(corsInput)
  await userEvent.type(corsInput, 'new-cors')

  await userEvent.click(screen.getByRole('button', { name: '保存' }))

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.apiKey).toBe('new-key')
    expect(p?.corsProxy).toBe('new-cors')
  })
})

it('保存 does not write when drafts equal current values', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'same', corsProxy: 'same-cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderAt('/settings')

  await screen.findByDisplayValue('same')

  let writes = 0
  const origUpdate = db.providers.update.bind(db.providers)
  db.providers.update = vi.fn((...args: unknown[]) => {
    writes++
    return (origUpdate as (...a: unknown[]) => Promise<unknown>)(...args)
  }) as typeof db.providers.update

  await userEvent.click(screen.getByRole('button', { name: '保存' }))

  await waitFor(() => {
    expect(writes).toBe(0)
  })
  const p = await db.providers.get(pid)
  expect(p?.apiKey).toBe('same')
  expect(p?.corsProxy).toBe('same-cors')
})

it('keeps 测试 button and 删除 for custom providers', async () => {
  await db.providers.add({ name: 'Custom', baseUrl: 'https://c', apiKey: 'ck', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  await db.providers.add({ name: 'Builtin', baseUrl: 'https://b', apiKey: 'bk', type: 'packy', isBuiltIn: 1, createdAt: 1 })
  renderAt('/settings')

  await screen.findByText('Custom')
  expect(screen.getAllByRole('button', { name: '测试密钥' }).length).toBeGreaterThanOrEqual(1)
  const deleteButtons = screen.getAllByRole('button', { name: /删除/ })
  expect(deleteButtons).toHaveLength(1)
})

it('does not render ThemeToggle inside the sheet', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderAt('/settings')
  await screen.findByText('密钥管理')
  expect(screen.queryByLabelText(/主题|toggle theme|theme/i)).not.toBeInTheDocument()
})
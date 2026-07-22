import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { SettingsSheet } from './SettingsSheet'
import { useSettings } from '@/stores/useSettings'

const { validate } = vi.hoisted(() => ({ validate: vi.fn() }))

vi.mock('@/lib/api/validate', () => ({
  validateApiKey: (...args: unknown[]) => validate(...args),
}))

function renderOpen() {
  useSettings.getState().openSettings()
  return render(<SettingsSheet />)
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  validate.mockReset()
  validate.mockResolvedValue({ valid: true })
  useSettings.setState({ open: false })
})

it('renders as a sliding sheet with title 密钥管理(完成后新建对话) and a 保存 footer button', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k1', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  expect(await screen.findByText('密钥管理(完成后新建对话)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
})

it('renders apiKey input, CORS mode select, and custom-mode input per provider (no 编辑 Key dialog)', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'secret-key', corsProxy: 'https://corsproxy.io/?', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()

  const keyInput = await screen.findByDisplayValue('secret-key')
  expect(keyInput).toHaveAttribute('type', 'password')
  const modeSelect = screen.getByRole('combobox', { name: 'CORS 模式 Packy' }) as HTMLSelectElement
  expect(modeSelect.value).toBe('custom')
  expect(screen.getByDisplayValue('https://corsproxy.io/?')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /编辑 Key/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /开始使用/ })).not.toBeInTheDocument()
})

it('places 测试 beside the key input outside advanced config', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'key', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()

  const keyInput = await screen.findByDisplayValue('key')
  const testButton = screen.getByRole('button', { name: '测试密钥' })
  expect(testButton.closest('details')).toBeNull()
  expect(testButton.parentElement).toBe(keyInput.parentElement)
})

it('initializes CORS mode to direct when no stored corsProxy', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  const modeSelect = await screen.findByRole('combobox', { name: 'CORS 模式 Packy' }) as HTMLSelectElement
  expect(modeSelect.value).toBe('direct')
  expect(screen.queryByDisplayValue('https://corsproxy.io/?')).not.toBeInTheDocument()
})

it('initializes CORS mode to builtin when stored corsProxy is /api/cors', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', corsProxy: '/api/cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  const modeSelect = await screen.findByRole('combobox', { name: 'CORS 模式 Packy' }) as HTMLSelectElement
  expect(modeSelect.value).toBe('builtin')
})

it('initializes CORS mode to custom and seeds customValue when stored corsProxy is custom', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', corsProxy: 'https://corsproxy.io/?', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  const modeSelect = await screen.findByRole('combobox', { name: 'CORS 模式 Packy' }) as HTMLSelectElement
  expect(modeSelect.value).toBe('custom')
  expect(await screen.findByDisplayValue('https://corsproxy.io/?')).toBeInTheDocument()
})

it('shows custom input only when mode is custom and preserves custom draft when switching away and back', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  const modeSelect = (await screen.findByRole('combobox', { name: 'CORS 模式 Packy' })) as HTMLSelectElement
  expect(modeSelect.value).toBe('direct')
  expect(screen.queryByRole('textbox', { name: '自定义 CORS Packy' })).not.toBeInTheDocument()

  await userEvent.selectOptions(modeSelect, 'custom')
  const customInput = await screen.findByRole('textbox', { name: '自定义 CORS Packy' }) as HTMLInputElement
  await userEvent.clear(customInput)
  await userEvent.type(customInput, 'https://my-proxy.example/')

  await userEvent.selectOptions(modeSelect, 'direct')
  expect(screen.queryByRole('textbox', { name: '自定义 CORS Packy' })).not.toBeInTheDocument()

  await userEvent.selectOptions(modeSelect, 'custom')
  const restoredInput = screen.getByRole('textbox', { name: '自定义 CORS Packy' }) as HTMLInputElement
  expect(restoredInput.value).toBe('https://my-proxy.example/')
})

it('保存 persists dirty drafts and closes the sheet', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'old', corsProxy: 'old-cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()

  const keyInput = (await screen.findByDisplayValue('old')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'new-key')

  const modeSelect = screen.getByRole('combobox', { name: 'CORS 模式 Packy' }) as HTMLSelectElement
  await userEvent.selectOptions(modeSelect, 'custom')
  const customInput = (await screen.findByRole('textbox', { name: '自定义 CORS Packy' })) as HTMLInputElement
  await userEvent.clear(customInput)
  await userEvent.type(customInput, 'https://new-proxy.example/')

  await userEvent.click(screen.getByRole('button', { name: '保存' }))

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.apiKey).toBe('new-key')
    expect(p?.corsProxy).toBe('https://new-proxy.example/')
  })
  await waitFor(() => {
    expect(useSettings.getState().open).toBe(false)
  })
})

it('保存 does not write when drafts equal current values', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'same', corsProxy: 'same-cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()

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

it('保存 converts direct mode to undefined corsProxy', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', corsProxy: '/api/cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()

  const modeSelect = (await screen.findByRole('combobox', { name: 'CORS 模式 Packy' })) as HTMLSelectElement
  await userEvent.selectOptions(modeSelect, 'direct')

  await userEvent.click(screen.getByRole('button', { name: '保存' }))

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.corsProxy).toBeUndefined()
  })
})

it('保存 converts builtin mode to the exact /api/cors value', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', corsProxy: 'https://old-proxy/', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()

  const modeSelect = (await screen.findByRole('combobox', { name: 'CORS 模式 Packy' })) as HTMLSelectElement
  await userEvent.selectOptions(modeSelect, 'builtin')

  await userEvent.click(screen.getByRole('button', { name: '保存' }))

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.corsProxy).toBe('/api/cors')
  })
})

it('保存 converts custom mode with whitespace to trimmed value', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()

  const modeSelect = (await screen.findByRole('combobox', { name: 'CORS 模式 Packy' })) as HTMLSelectElement
  await userEvent.selectOptions(modeSelect, 'custom')
  const customInput = (await screen.findByRole('textbox', { name: '自定义 CORS Packy' })) as HTMLInputElement
  await userEvent.type(customInput, '  https://padded.example/  ')

  await userEvent.click(screen.getByRole('button', { name: '保存' }))

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.corsProxy).toBe('https://padded.example/')
  })
})

it('保存 converts blank custom mode to undefined corsProxy', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', corsProxy: 'https://was-here/', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()

  const modeSelect = (await screen.findByRole('combobox', { name: 'CORS 模式 Packy' })) as HTMLSelectElement
  await userEvent.selectOptions(modeSelect, 'custom')
  const customInput = (await screen.findByRole('textbox', { name: '自定义 CORS Packy' })) as HTMLInputElement
  await userEvent.clear(customInput)

  await userEvent.click(screen.getByRole('button', { name: '保存' }))

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.corsProxy).toBeUndefined()
  })
})

it('测试 passes current unsaved key and converted unsaved CORS draft (direct → undefined)', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', corsProxy: '/api/cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()

  const keyInput = (await screen.findByDisplayValue('stored-key')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'draft-key')

  const modeSelect = (await screen.findByRole('combobox', { name: 'CORS 模式 Packy' })) as HTMLSelectElement
  await userEvent.selectOptions(modeSelect, 'direct')

  await userEvent.click(screen.getByRole('button', { name: '测试密钥' }))

  await waitFor(() => {
    expect(validate).toHaveBeenCalledWith('https://p', 'draft-key', undefined)
  })
})

it('测试 passes current unsaved key and converted unsaved CORS draft (builtin → /api/cors)', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', corsProxy: 'https://old-proxy/', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()

  const modeSelect = (await screen.findByRole('combobox', { name: 'CORS 模式 Packy' })) as HTMLSelectElement
  await userEvent.selectOptions(modeSelect, 'builtin')

  await userEvent.click(screen.getByRole('button', { name: '测试密钥' }))

  await waitFor(() => {
    expect(validate).toHaveBeenCalledWith('https://p', 'stored-key', '/api/cors')
  })
})

it('测试 passes current unsaved key and converted unsaved CORS draft (custom → trimmed value) and does not save', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()

  const modeSelect = (await screen.findByRole('combobox', { name: 'CORS 模式 Packy' })) as HTMLSelectElement
  await userEvent.selectOptions(modeSelect, 'custom')
  const customInput = (await screen.findByRole('textbox', { name: '自定义 CORS Packy' })) as HTMLInputElement
  await userEvent.type(customInput, '  https://probe.example/  ')

  await userEvent.click(screen.getByRole('button', { name: '测试密钥' }))

  await waitFor(() => {
    expect(validate).toHaveBeenCalledWith('https://p', 'stored-key', 'https://probe.example/')
  })

  const stillOpen = await db.providers.get(pid)
  expect(stillOpen?.corsProxy).toBeUndefined()
})

it('keeps 测试 button and 删除 for custom providers', async () => {
  await db.providers.add({ name: 'Custom', baseUrl: 'https://c', apiKey: 'ck', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  await db.providers.add({ name: 'Builtin', baseUrl: 'https://b', apiKey: 'bk', type: 'packy', isBuiltIn: 1, createdAt: 1 })
  renderOpen()

  await screen.findByText('Custom')
  expect(screen.getAllByRole('button', { name: '测试密钥' }).length).toBeGreaterThanOrEqual(1)
  const deleteButtons = screen.getAllByRole('button', { name: /删除/ })
  expect(deleteButtons).toHaveLength(1)
})

it('does not render ThemeToggle inside the sheet', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  await screen.findByText('密钥管理(完成后新建对话)')
  expect(screen.queryByLabelText(/主题|toggle theme|theme/i)).not.toBeInTheDocument()
})

it('uses w-[min(320px,85vw)] on SheetContent so the sheet shrinks on mobile', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  const content = (await screen.findAllByRole('dialog'))
    .find((el) => el.className.includes('p-0'))!
  expect(content.className).toContain('w-[min(320px,85vw)]')
  expect(content.className).toContain('sm:max-w-md')
})

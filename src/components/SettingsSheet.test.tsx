import 'fake-indexeddb/auto'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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
  const result = render(<SettingsSheet />)
  return result
}

async function expandAdvanced(providerName = 'Packy') {
  const card = await getProviderCard(providerName)
  const details = card.querySelector('details')
  if (details && !details.hasAttribute('open')) {
    await userEvent.click(details.querySelector('summary')!)
  }
}

async function getProviderCard(name: string) {
  const title = await screen.findByText(name)
  const card = title.closest('.rounded-lg.border.bg-card')
  if (!(card instanceof HTMLElement)) throw new Error(`Provider card not found: ${name}`)
  return card
}

async function addCustomDraft(name: string, url: string, key: string) {
  await userEvent.click(screen.getByRole('button', { name: /添加自定义/ }))
  await userEvent.type(screen.getByRole('textbox', { name: '名称' }), name)
  await userEvent.type(screen.getByRole('textbox', { name: '域名' }), url)
  await userEvent.type(screen.getByLabelText('SK 密钥'), key)
  await userEvent.click(screen.getByRole('button', { name: '添加' }))
  await screen.findByText(name)
}

async function deleteDraft(name: string) {
  await expandAdvanced(name)
  const card = await getProviderCard(name)
  await userEvent.click(within(card).getByRole('button', { name: /删除/ }))
  await waitFor(() => expect(screen.queryByText(name)).not.toBeInTheDocument())
}

async function validateDraft(name: string) {
  const card = await getProviderCard(name)
  await userEvent.click(within(card).getByRole('button', { name: '测试密钥' }))
  await waitFor(() => expect(within(card).getByText(/有效/)).toBeInTheDocument())
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  validate.mockReset()
  validate.mockResolvedValue({ valid: true })
  useSettings.setState({ open: false })
})

it('keeps advanced settings collapsed by default', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k1', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  const summary = await screen.findByText('高级配置')
  expect(summary.closest('details')).not.toHaveAttribute('open')
})

it('shows the inline custom provider form and requires name and domain', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k1', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  await userEvent.click(screen.getByRole('button', { name: /添加自定义/ }))

  expect(screen.queryByRole('dialog', { name: '添加自定义中转站' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '名称' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '域名' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '添加' })).toBeDisabled()

  await userEvent.type(screen.getByRole('textbox', { name: '名称' }), 'Custom')
  expect(screen.getByRole('button', { name: '添加' })).toBeDisabled()

  await userEvent.type(screen.getByRole('textbox', { name: '域名' }), 'https://custom.example')
  expect(screen.getByRole('button', { name: '添加' })).toBeEnabled()
})

it('adds a custom provider to the draft without writing IndexedDB', async () => {
  renderOpen()
  await addCustomDraft('Custom', 'https://custom.example', 'custom-key')

  expect(await db.providers.where('baseUrl').equals('https://custom.example').count()).toBe(0)
  expect(screen.getByText('Custom')).toBeInTheDocument()
})

it('updates a matching custom domain in the draft without writing IndexedDB', async () => {
  const pid = (await db.providers.add({ name: 'Stored', baseUrl: 'https://custom.example', apiKey: 'old-key', type: 'custom', isBuiltIn: 0, createdAt: 0 })) as number
  renderOpen()
  await addCustomDraft('Renamed', 'https://custom.example', 'new-key')

  expect(await db.providers.get(pid)).toMatchObject({ name: 'Stored', apiKey: 'old-key' })
  expect(screen.getByText('Renamed')).toBeInTheDocument()
})

it('keeps add, edit, delete, and validation changes out of IndexedDB before save', async () => {
  const builtInId = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  const customId = (await db.providers.add({ name: 'Old Custom', baseUrl: 'https://old.example', apiKey: 'old-key', type: 'custom', isBuiltIn: 0, createdAt: 1 })) as number
  renderOpen()

  const keyInput = (await screen.findByDisplayValue('stored-key')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'draft-key')
  await addCustomDraft('New Custom', 'https://new.example', 'new-key')
  await deleteDraft('Old Custom')
  await validateDraft('Packy')

  const storedBuiltIn = await db.providers.get(builtInId)
  expect(storedBuiltIn).toMatchObject({ apiKey: 'stored-key' })
  expect(storedBuiltIn?.lastValidatedAt).toBeUndefined()
  expect(storedBuiltIn?.lastValid).toBeUndefined()
  expect(await db.providers.get(customId)).toMatchObject({ name: 'Old Custom', apiKey: 'old-key' })
  expect(await db.providers.where('baseUrl').equals('https://new.example').count()).toBe(0)
})

it('discards every provider draft when the sheet closes and reopens', async () => {
  const builtInId = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  const customId = (await db.providers.add({ name: 'Old Custom', baseUrl: 'https://old.example', apiKey: 'old-key', type: 'custom', isBuiltIn: 0, createdAt: 1 })) as number
  renderOpen()

  const keyInput = (await screen.findByDisplayValue('stored-key')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'draft-key')
  await addCustomDraft('New Custom', 'https://new.example', 'new-key')
  await deleteDraft('Old Custom')
  await validateDraft('Packy')

  act(() => useSettings.getState().closeSettings())
  await waitFor(() => expect(useSettings.getState().open).toBe(false))
  act(() => useSettings.getState().openSettings())

  expect(await screen.findByDisplayValue('stored-key')).toBeInTheDocument()
  expect(screen.getByText('Old Custom')).toBeInTheDocument()
  expect(screen.queryByText('New Custom')).not.toBeInTheDocument()
  const card = await getProviderCard('Packy')
  expect(within(card).queryByText(/有效/)).not.toBeInTheDocument()
  expect(await db.providers.get(builtInId)).toMatchObject({ apiKey: 'stored-key' })
  expect(await db.providers.get(customId)).toMatchObject({ name: 'Old Custom' })
})

it('atomically persists all pending provider changes on save', async () => {
  const builtInId = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  const customId = (await db.providers.add({ name: 'Old Custom', baseUrl: 'https://old.example', apiKey: 'old-key', type: 'custom', isBuiltIn: 0, createdAt: 1 })) as number
  renderOpen()

  const keyInput = (await screen.findByDisplayValue('stored-key')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'draft-key')
  await addCustomDraft('New Custom', 'https://new.example', 'new-key')
  await deleteDraft('Old Custom')
  await validateDraft('Packy')
  await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0])

  await waitFor(async () => {
    const saved = await db.providers.get(builtInId)
    expect(saved).toMatchObject({ apiKey: 'draft-key', lastValid: 1 })
    expect(saved?.lastValidatedAt).toEqual(expect.any(Number))
    expect(await db.providers.get(customId)).toBeUndefined()
    expect(await db.providers.where('baseUrl').equals('https://new.example').first()).toMatchObject({ name: 'New Custom', apiKey: 'new-key' })
    expect(useSettings.getState().open).toBe(false)
  })
})

it('keeps the sheet open and rolls back all changes when save fails', async () => {
  const builtInId = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  const customId = (await db.providers.add({ name: 'Old Custom', baseUrl: 'https://old.example', apiKey: 'old-key', type: 'custom', isBuiltIn: 0, createdAt: 1 })) as number
  renderOpen()

  const keyInput = (await screen.findByDisplayValue('stored-key')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'draft-key')
  await addCustomDraft('New Custom', 'https://new.example', 'new-key')
  await deleteDraft('Old Custom')

  const deleteSpy = vi.spyOn(db.providers, 'delete').mockRejectedValueOnce(new Error('save failed'))
  await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0])
  await waitFor(() => expect(deleteSpy).toHaveBeenCalled())
  await waitFor(() => expect(screen.getAllByRole('button', { name: '保存' })[0]).toBeEnabled())
  deleteSpy.mockRestore()

  expect(useSettings.getState().open).toBe(true)
  expect(await db.providers.get(builtInId)).toMatchObject({ apiKey: 'stored-key' })
  expect(await db.providers.get(customId)).toMatchObject({ name: 'Old Custom', apiKey: 'old-key' })
  expect(await db.providers.where('baseUrl').equals('https://new.example').count()).toBe(0)
  expect(screen.getByDisplayValue('draft-key')).toBeInTheDocument()
  expect(screen.getByText('New Custom')).toBeInTheDocument()
})

it('renders as a sliding sheet with title 密钥管理(完成后新建对话) and a 保存 footer button', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k1', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  expect(await screen.findByText('密钥管理(完成后新建对话)')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: '保存' })[0]).toBeInTheDocument()
})


it('renders apiKey input and two-option CORS mode chips (no custom field)', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'secret-key', corsProxy: 'https://corsproxy.io/?', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  await expandAdvanced()

  const keyInput = await screen.findByDisplayValue('secret-key')
  expect(keyInput).toHaveAttribute('type', 'password')
  expect(screen.getByRole('radio', { name: '直接连接' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: '/api/cors' })).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: '自定义' })).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue('https://corsproxy.io/?')).not.toBeInTheDocument()
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
  await expandAdvanced()
  expect((await screen.findByRole('radio', { name: '直接连接' })).getAttribute('aria-checked')).toBe('true')
  expect(screen.queryByDisplayValue('https://corsproxy.io/?')).not.toBeInTheDocument()
})

it('initializes CORS mode to builtin when stored corsProxy is /api/cors', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', corsProxy: '/api/cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  await expandAdvanced()
  expect((await screen.findByRole('radio', { name: '/api/cors' })).getAttribute('aria-checked')).toBe('true')
})

it('only renders direct and builtin CORS chips', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  await expandAdvanced()
  const chips = screen.getAllByRole('radio')
  expect(chips).toHaveLength(2)
  expect(chips.map((c) => c.textContent)).toEqual(['直接连接', '/api/cors'])
})

it('saves apiKey + builtin CORS and closes the sheet', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'old', corsProxy: 'old-cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()
  await expandAdvanced()

  const keyInput = (await screen.findByDisplayValue('old')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'new-key')

  await userEvent.click(screen.getByRole('radio', { name: '/api/cors' }))
  await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0])

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.apiKey).toBe('new-key')
    expect(p?.corsProxy).toBe('/api/cors')
  })
  await waitFor(() => {
    expect(useSettings.getState().open).toBe(false)
  })
})

it('does not write when drafts equal current values', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'same', corsProxy: '/api/cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()
  await expandAdvanced()

  await screen.findByDisplayValue('same')

  let writes = 0
  const origUpdate = db.providers.update.bind(db.providers)
  db.providers.update = vi.fn((...args: unknown[]) => {
    writes++
    return (origUpdate as (...a: unknown[]) => Promise<unknown>)(...args)
  }) as unknown as typeof db.providers.update

  await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0])

  await waitFor(() => {
    expect(writes).toBe(0)
  })
  const p = await db.providers.get(pid)
  expect(p?.apiKey).toBe('same')
  expect(p?.corsProxy).toBe('/api/cors')
})

it('converts direct mode to undefined corsProxy', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', corsProxy: '/api/cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()
  await expandAdvanced()

  await userEvent.click(screen.getByRole('radio', { name: '直接连接' }))
  await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0])

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.corsProxy).toBeUndefined()
  })
})

it('persists builtin mode as the exact /api/cors value', async () => {
  const pid = (await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'k', corsProxy: 'https://old-proxy/', type: 'packy', isBuiltIn: 1, createdAt: 0 })) as number
  renderOpen()
  await expandAdvanced()

  await userEvent.click(screen.getByRole('radio', { name: '/api/cors' }))
  await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0])

  await waitFor(async () => {
    const p = await db.providers.get(pid)
    expect(p?.corsProxy).toBe('/api/cors')
  })
})

it('测试 passes current unsaved key and direct CORS draft', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', corsProxy: '/api/cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  await expandAdvanced()

  const keyInput = (await screen.findByDisplayValue('stored-key')) as HTMLInputElement
  await userEvent.clear(keyInput)
  await userEvent.type(keyInput, 'draft-key')

  await userEvent.click(screen.getByRole('radio', { name: '直接连接' }))
  await userEvent.click(screen.getByRole('button', { name: '测试密钥' }))

  await waitFor(() => {
    expect(validate).toHaveBeenCalledWith('https://p', 'draft-key', undefined)
  })
})

it('测试 passes stored key and builtin CORS value', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'https://p', apiKey: 'stored-key', corsProxy: '/api/cors', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  renderOpen()
  await expandAdvanced()

  await screen.findByDisplayValue('stored-key')

  await userEvent.click(screen.getByRole('button', { name: '测试密钥' }))

  await waitFor(() => {
    expect(validate).toHaveBeenCalledWith('https://p', 'stored-key', '/api/cors')
  })
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

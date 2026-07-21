import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, type RequestLog } from '@/lib/db'
import { RequestLogDetailsDialog } from './RequestLogDetailsDialog'

beforeEach(async () => { await db.delete(); await db.open() })

function makeLog(overrides: Partial<RequestLog> = {}): Omit<RequestLog, 'id'> {
  return {
    timestamp: Date.UTC(2026, 6, 22, 10, 0, 0),
    durationMs: 1234,
    endpoint: 'generate',
    providerId: 1,
    providerName: 'Packy',
    providerBaseUrl: 'https://www.packyapi.com',
    model: 'gpt-image-2',
    corsProxyApplied: false,
    url: 'https://www.packyapi.com/v1/images/generations',
    method: 'POST',
    headers: { Authorization: 'Bearer ***', 'Content-Type': 'application/json' },
    body: '{"prompt":"cat"}',
    promptLength: 3,
    refImageCount: 0,
    conversationId: 7,
    messageId: 42,
    responseStatus: 401,
    responseHeaders: { 'content-type': 'application/json', 'x-request-id': 'req-abc' },
    responseBody: '{"error":{"message":"bad key"}}',
    errorKind: 'unauthorized',
    errorMessage: '密钥无效或已过期',
    userAgent: 'vitest',
    ...overrides,
  }
}

it('renders the trigger button 查看请求详情', () => {
  render(<RequestLogDetailsDialog logId={1} />)
  expect(screen.getByRole('button', { name: /查看请求详情/ })).toBeInTheDocument()
})

it('clicking the trigger opens a Dialog titled 请求详情', async () => {
  const user = userEvent.setup()
  render(<RequestLogDetailsDialog logId={1} />)
  await user.click(screen.getByRole('button', { name: /查看请求详情/ }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('请求详情')).toBeInTheDocument()
})

it('shows the "日志不存在或已过期" message when no log matches logId', async () => {
  const user = userEvent.setup()
  render(<RequestLogDetailsDialog logId={999} />)
  await user.click(screen.getByRole('button', { name: /查看请求详情/ }))
  expect(await screen.findByText(/日志不存在或已过期/)).toBeInTheDocument()
})

it('renders log sections (URL, method, error kind) when log exists', async () => {
  const id = (await db.requestLogs.add(makeLog())) as number
  const user = userEvent.setup()
  render(<RequestLogDetailsDialog logId={id} />)
  await user.click(screen.getByRole('button', { name: /查看请求详情/ }))

  await waitFor(() => {
    expect(screen.getByText('https://www.packyapi.com/v1/images/generations')).toBeInTheDocument()
  })
  expect(screen.getByText('POST')).toBeInTheDocument()
  expect(screen.getByText('unauthorized')).toBeInTheDocument()
  expect(screen.getByText('密钥无效或已过期')).toBeInTheDocument()
})

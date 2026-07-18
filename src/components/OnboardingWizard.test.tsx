import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { OnboardingWizard } from './OnboardingWizard'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders welcome page initially', () => {
  render(<OnboardingWizard onDone={() => {}} />)
  expect(screen.getByText('开始使用')).toBeInTheDocument()
})

it('completes onboarding with packy template + key', async () => {
  const user = userEvent.setup()
  const onDone = vi.fn()
  render(<OnboardingWizard onDone={onDone} />)
  await user.click(screen.getByText('开始使用'))
  await user.click(screen.getByText('Packy'))
  await user.type(screen.getByLabelText(/SK 密钥/i), 'sk-test')
  await user.click(screen.getByText('完成'))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  const providers = await db.providers.toArray()
  const packy = providers.filter((p) => p.type === 'packy')
  expect(packy).toHaveLength(2)
  const userProvider = packy.find((p) => p.apiKey === 'sk-test')
  expect(userProvider).toBeDefined()
})

it('shows error when submitting empty key', async () => {
  const user = userEvent.setup()
  render(<OnboardingWizard onDone={() => {}} />)
  await user.click(screen.getByText('开始使用'))
  await user.click(screen.getByText('Packy'))
  await user.click(screen.getByText('完成'))
  expect(await screen.findByText(/请填写密钥/i)).toBeInTheDocument()
})

import '@testing-library/jest-dom/vitest'

if (typeof URL.createObjectURL !== 'function') {
  let n = 0
  URL.createObjectURL = () => `blob:test-${++n}`
  URL.revokeObjectURL = () => {}
}

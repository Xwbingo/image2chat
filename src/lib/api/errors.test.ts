import { describe, expect, it } from 'vitest'
import { parseApiError, parseNetworkError } from './errors'

describe('parseApiError', () => {
  it('401 -> unauthorized', () => {
    const e = parseApiError(new Response('', { status: 401 }))
    expect(e.kind).toBe('unauthorized')
  })
  it('402 -> insufficient', () => {
    expect(parseApiError(new Response('', { status: 402 })).kind).toBe('insufficient')
  })
  it('429 -> rate_limited', () => {
    expect(parseApiError(new Response('', { status: 429 })).kind).toBe('rate_limited')
  })
  it('500 -> server_error', () => {
    expect(parseApiError(new Response('', { status: 500 })).kind).toBe('server_error')
  })
  it('400 with OpenAI error body -> bad_request with extracted message', () => {
    const e = parseApiError(new Response('', { status: 400 }), '{"error":{"message":"bad size"}}')
    expect(e.kind).toBe('bad_request')
    if (e.kind === 'bad_request') expect(e.message).toBe('bad size')
  })
  it('200 with empty data array -> content_filtered', () => {
    const e = parseApiError(new Response('{"created":1,"data":[]}', { status: 200 }))
    expect(e.kind).toBe('content_filtered')
  })
})

describe('parseNetworkError', () => {
  it('TypeError from fetch -> network', () => {
    expect(parseNetworkError(new TypeError('Failed to fetch')).kind).toBe('network')
  })
  it('AbortError -> network', () => {
    const e = new DOMException('aborted', 'AbortError')
    expect(parseNetworkError(e).kind).toBe('network')
  })
})
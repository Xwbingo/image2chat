export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    }

    const target = new URL(request.url).searchParams.get('url')
    if (!target) return new Response('Missing ?url=', { status: 400 })
    try {
      new URL(target)
    } catch {
      return new Response('Invalid URL', { status: 400 })
    }

    const response = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    })

    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')

    return new Response(response.body, { status: response.status, headers })
  },
}
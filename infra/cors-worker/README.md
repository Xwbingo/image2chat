# image2chat CORS Proxy Worker

Cloudflare Worker that adds CORS headers to upstream relay API requests,
bypassing browser CORS restrictions for relays that don't send
`Access-Control-Allow-Origin` headers (e.g., RunAPI).

## Endpoints

All requests pass the target URL as `?url=<encoded>`:

```
GET  https://<worker>.workers.dev/?url=https://runapi.co/v1/models
POST https://<worker>.workers.dev/?url=https://runapi.co/v1/images/generations
POST https://<worker>.workers.dev/?url=https://runapi.co/v1/images/edits
```

## Deploy

```bash
# 1. Set API token (Cloudflare dashboard → My Profile → API Tokens)
export CLOUDFLARE_API_TOKEN="<your-token>"

# 2. Deploy
wrangler deploy
```

Wrangler prints the worker URL on success. Configure that URL in
image2chat's Settings → provider → "CORS 代理" field.
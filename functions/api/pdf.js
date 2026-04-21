/**
 * functions/api/pdf.js
 *
 * Cloudflare Pages Function — CORS-safe PDF proxy for Archive.org downloads.
 *
 * Problem: pdfjs-dist fetches PDFs via the browser's Fetch API. Archive.org's
 * /download/ endpoint redirects to storage servers (ia*.us.archive.org) that
 * don't reliably send Access-Control-Allow-Origin headers, so the browser
 * blocks the response.
 *
 * Solution: proxy the request server-side through this Worker, which adds the
 * necessary CORS headers and forwards Range requests so pdf.js can lazy-load
 * individual pages without downloading the whole file upfront.
 *
 * Usage:
 *   /api/pdf?url=https%3A%2F%2Farchive.org%2Fdownload%2F...
 *
 * Security:
 *   - Only archive.org hostnames are allowed (strict allowlist).
 *   - No credentials or auth headers are forwarded.
 *   - GET and OPTIONS only.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers':
    'Content-Length, Content-Range, Accept-Ranges, Content-Type',
}

function isAllowedHost(hostname) {
  // Exact match or subdomain of archive.org only.
  return hostname === 'archive.org' || hostname.endsWith('.archive.org')
}

export async function onRequest(context) {
  const { request } = context

  // ── CORS preflight ────────────────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...CORS_HEADERS, Allow: 'GET, OPTIONS' },
    })
  }

  // ── Parse and validate the target URL ────────────────────────────────────
  const requestUrl = new URL(request.url)
  const rawTarget = requestUrl.searchParams.get('url')

  if (!rawTarget) {
    return new Response('Missing required query parameter: url', {
      status: 400,
      headers: CORS_HEADERS,
    })
  }

  let targetUrl
  try {
    targetUrl = new URL(rawTarget)
  } catch {
    return new Response('Invalid url parameter — must be a fully-qualified URL', {
      status: 400,
      headers: CORS_HEADERS,
    })
  }

  // Only HTTPS to archive.org is allowed.
  if (targetUrl.protocol !== 'https:') {
    return new Response('Only HTTPS URLs are allowed', {
      status: 403,
      headers: CORS_HEADERS,
    })
  }

  if (!isAllowedHost(targetUrl.hostname)) {
    return new Response(
      `Forbidden: only archive.org URLs may be proxied (got ${targetUrl.hostname})`,
      { status: 403, headers: CORS_HEADERS }
    )
  }

  // ── Forward the request to Archive.org ───────────────────────────────────
  const upstreamHeaders = new Headers()

  // Forward Range header so pdf.js can load individual pages on demand.
  const range = request.headers.get('Range')
  if (range) {
    upstreamHeaders.set('Range', range)
  }

  // Identify ourselves without leaking the user's browser UA.
  upstreamHeaders.set('User-Agent', 'Quarchive-PDF-Proxy/1.0')

  let upstream
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: upstreamHeaders,
      // Cloudflare Workers follow redirects automatically; this ensures we
      // land on the actual ia*.us.archive.org storage response.
      redirect: 'follow',
    })
  } catch (err) {
    console.error('[pdf-proxy] upstream fetch failed:', err)
    return new Response('Failed to reach Archive.org', {
      status: 502,
      headers: CORS_HEADERS,
    })
  }

  // Pass through genuine upstream errors (404, 410, etc.) transparently.
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(
      `Archive.org returned ${upstream.status} ${upstream.statusText}`,
      { status: upstream.status, headers: CORS_HEADERS }
    )
  }

  // ── Build response headers ────────────────────────────────────────────────
  const responseHeaders = new Headers(CORS_HEADERS)

  // Content-Type — default to application/pdf if archive.org omits it.
  responseHeaders.set(
    'Content-Type',
    upstream.headers.get('Content-Type') || 'application/pdf'
  )

  // Forward byte-range metadata so pdf.js range-fetching works correctly.
  const contentLength = upstream.headers.get('Content-Length')
  if (contentLength) {
    responseHeaders.set('Content-Length', contentLength)
  }

  const contentRange = upstream.headers.get('Content-Range')
  if (contentRange) {
    responseHeaders.set('Content-Range', contentRange)
  }

  // Always advertise range support — pdf.js checks this before issuing ranges.
  responseHeaders.set(
    'Accept-Ranges',
    upstream.headers.get('Accept-Ranges') || 'bytes'
  )

  // Allow the browser to cache the full-file response for 10 minutes.
  // Range responses are not cached (they vary by Range header).
  if (upstream.status === 200) {
    responseHeaders.set('Cache-Control', 'public, max-age=600')
  }

  // ── Stream the body back ──────────────────────────────────────────────────
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

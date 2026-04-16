// Proxy: IAS3 PUT upload to Archive.org
// Reads FormData with credentials + file, streams to S3 endpoint.
// No credentials are stored — they pass through per-request only.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * Build x-archive-meta headers from a metadata object.
 * The `subject` field is special: it may contain multiple values
 * separated by `;`, which must be sent as separate indexed headers
 * (x-archive-meta01-subject, x-archive-meta02-subject, etc.).
 */
function buildArchiveMetaHeaders(meta) {
  const headers = {}

  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === '') continue

    if (key === 'subject') {
      // Archive.org supports multiple subject values via indexed headers
      const subjects = String(value).split(';').map(s => s.trim()).filter(Boolean)
      subjects.forEach((subj, i) => {
        const idx = String(i + 1).padStart(2, '0')
        headers[`x-archive-meta${idx}-subject`] = subj
      })
    } else {
      headers[`x-archive-meta-${key}`] = String(value)
    }
  }

  return headers
}

export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData()

    const accessKey  = formData.get('accessKey')
    const secretKey  = formData.get('secretKey')
    const identifier = formData.get('identifier')
    const file       = formData.get('file')
    const metaRaw    = formData.get('meta')

    // Validate required fields
    if (!accessKey || !secretKey) {
      return jsonResponse({ ok: false, error: 'Missing authentication credentials' }, 400)
    }
    if (!identifier) {
      return jsonResponse({ ok: false, error: 'Missing item identifier' }, 400)
    }
    if (!file || typeof file === 'string') {
      return jsonResponse({ ok: false, error: 'Missing file' }, 400)
    }
    if (!metaRaw) {
      return jsonResponse({ ok: false, error: 'Missing metadata' }, 400)
    }

    // Parse metadata JSON
    let meta
    try {
      meta = JSON.parse(metaRaw)
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid metadata JSON' }, 400)
    }

    // Build IAS3 URL
    const filename = encodeURIComponent(file.name)
    const iasUrl = `https://s3.us.archive.org/${identifier}/${filename}`

    // Build metadata headers (handles multi-value subject)
    const metaHeaders = buildArchiveMetaHeaders(meta)

    // PUT to Archive.org IAS3
    const iasRes = await fetch(iasUrl, {
      method: 'PUT',
      headers: {
        Authorization: `LOW ${accessKey}:${secretKey}`,
        'Content-Type': 'application/pdf',
        'x-archive-auto-make-bucket': '1',
        'x-archive-queue-derive': '1',
        ...metaHeaders,
      },
      body: file.stream(),
    })

    return jsonResponse(
      { ok: iasRes.ok, status: iasRes.status, identifier },
      iasRes.ok ? 200 : 502
    )
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Upload failed: ' + err.message }, 500)
  }
}

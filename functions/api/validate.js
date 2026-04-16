// Session validation: checks if stored S3 keys are still valid
// Proxies an auth check to Archive.org's S3 endpoint

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function onRequestGet(context) {
  try {
    const authHeader = context.request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('LOW ')) {
      return jsonResponse({ ok: false, error: 'Authorization header required (format: LOW accessKey:secretKey)' }, 400)
    }

    // Proxy the auth check to Archive.org S3
    const checkRes = await fetch('https://s3.us.archive.org/?check_auth=1', {
      headers: {
        Authorization: authHeader,
      },
    })

    if (checkRes.ok) {
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ ok: false }, 401)
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Validation failed: ' + err.message }, 500)
  }
}

// Proxy: Generate S3 keys for Archive.org accounts that don't have them yet
// Called only when login.js returns { error: 'no_keys' }

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

export async function onRequestPost(context) {
  try {
    const { loggedInUser, loggedInSig } = await context.request.json()

    if (!loggedInUser || !loggedInSig) {
      return jsonResponse(
        { ok: false, error: 'Session cookies (loggedInUser, loggedInSig) are required' },
        400
      )
    }

    // POST to Archive.org to generate new S3 keys
    const genRes = await fetch('https://archive.org/account/s3.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `logged-in-user=${loggedInUser}; logged-in-sig=${loggedInSig}`,
      },
      body: new URLSearchParams({
        submit: '1',
        action: 'generate-new-key',
      }).toString(),
    })

    const html = await genRes.text()

    // Parse the response HTML for the newly generated keys
    const accessMatch = html.match(/name="access"[^>]*value="([^"]+)"/)
    const secretMatch = html.match(/name="secret"[^>]*value="([^"]+)"/)

    if (!accessMatch || !secretMatch) {
      return jsonResponse(
        { ok: false, error: 'Failed to generate S3 keys. Please try again or visit archive.org/account/s3.php manually.' },
        502
      )
    }

    return jsonResponse({
      ok: true,
      accessKey: accessMatch[1],
      secretKey: secretMatch[1],
    })
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Key generation failed: ' + err.message }, 500)
  }
}

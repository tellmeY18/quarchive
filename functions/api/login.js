// Proxy: Archive.org xauthn login
// Authenticates user, extracts session cookies, fetches S3 keys

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
    const request = context.request
    let email, password

    // Support both JSON and FormData request bodies
    const contentType = request.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const json = await request.json()
      email = json.email
      password = json.password
    } else {
      const formData = await request.formData()
      email = formData.get('email')
      password = formData.get('password')
    }

    if (!email || !password) {
      return jsonResponse({ ok: false, error: 'Email and password are required' }, 400)
    }

    // Step 1: Authenticate with Archive.org
    const loginRes = await fetch('https://archive.org/services/xauthn/?op=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email,
        password,
        remember: 'CHECKED',
        referer: 'https://archive.org',
        login: 'true',
        submit_by_js: 'true',
      }).toString(),
      redirect: 'manual',
    })

    // Step 2: Extract session cookies from Set-Cookie headers
    // Use getSetCookie() which returns an array — reliable in Workers
    const setCookieHeaders = loginRes.headers.getSetCookie()
    const cookieMap = {}

    for (const cookieStr of setCookieHeaders) {
      if (cookieStr.startsWith('logged-in-user=')) {
        cookieMap.loggedInUser = cookieStr.split(';')[0].replace('logged-in-user=', '')
      }
      if (cookieStr.startsWith('logged-in-sig=')) {
        cookieMap.loggedInSig = cookieStr.split(';')[0].replace('logged-in-sig=', '')
      }
    }

    if (!cookieMap.loggedInUser || !cookieMap.loggedInSig) {
      return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401)
    }

    // Step 3: Fetch S3 keys using session cookies
    const s3Res = await fetch('https://archive.org/account/s3.php', {
      headers: {
        Cookie: `logged-in-user=${cookieMap.loggedInUser}; logged-in-sig=${cookieMap.loggedInSig}`,
      },
    })
    const s3Html = await s3Res.text()

    // Step 4: Parse HTML for S3 access and secret keys
    const accessMatch = s3Html.match(/name="access"[^>]*value="([^"]+)"/)
    const secretMatch = s3Html.match(/name="secret"[^>]*value="([^"]+)"/)

    if (!accessMatch || !secretMatch) {
      // Account exists but has no S3 keys generated yet
      return jsonResponse({
        ok: false,
        error: 'no_keys',
        cookies: cookieMap,
      }, 200)
    }

    // Step 5: Try to extract screenname from the S3 page HTML
    // Look for common patterns in Archive.org's account pages
    const screennameMatch = s3Html.match(/screenname[^>]*>([^<]+)</)
      || s3Html.match(/@([a-zA-Z0-9_-]+)/)
    const screenname = screennameMatch
      ? screennameMatch[1].trim()
      : email.split('@')[0]

    return jsonResponse({
      ok: true,
      screenname,
      email,
      accessKey: accessMatch[1],
      secretKey: secretMatch[1],
      cookies: cookieMap,
    })
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Login failed: ' + err.message }, 500)
  }
}

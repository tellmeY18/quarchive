// Proxy: Generate S3 keys for Archive.org accounts that don't have them yet
// Called only when login.js returns { error: 'no_keys' }

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function extractInputValue(html, name) {
  const byName = new RegExp(`name="${name}"[^>]*value="([^"]+)"`, "i");
  const byNameReversed = new RegExp(`value="([^"]+)"[^>]*name="${name}"`, "i");
  const byId = new RegExp(`id="${name}"[^>]*value="([^"]+)"`, "i");

  return (
    html.match(byName)?.[1] ||
    html.match(byNameReversed)?.[1] ||
    html.match(byId)?.[1] ||
    null
  );
}

function extractKeys(html) {
  const patterns = [
    // Legacy / existing assumptions
    {
      access: /name="access"[^>]*value="([^"]+)"/i,
      secret: /name="secret"[^>]*value="([^"]+)"/i,
    },
    {
      access: /value="([^"]+)"[^>]*name="access"/i,
      secret: /value="([^"]+)"[^>]*name="secret"/i,
    },
    {
      access: /id="access"[^>]*value="([^"]+)"/i,
      secret: /id="secret"[^>]*value="([^"]+)"/i,
    },

    // AWS-style field names (common in IA S3 pages)
    {
      access: /name="aws_access_key_id"[^>]*value="([^"]+)"/i,
      secret: /name="aws_secret_access_key"[^>]*value="([^"]+)"/i,
    },
    {
      access: /id="aws_access_key_id"[^>]*value="([^"]+)"/i,
      secret: /id="aws_secret_access_key"[^>]*value="([^"]+)"/i,
    },
    {
      access: /value="([^"]+)"[^>]*name="aws_access_key_id"/i,
      secret: /value="([^"]+)"[^>]*name="aws_secret_access_key"/i,
    },

    // JSON/script embedded
    {
      access: /"access"\s*:\s*"([^"]+)"/i,
      secret: /"secret"\s*:\s*"([^"]+)"/i,
    },
    {
      access: /"aws_access_key_id"\s*:\s*"([^"]+)"/i,
      secret: /"aws_secret_access_key"\s*:\s*"([^"]+)"/i,
    },
  ];

  for (const p of patterns) {
    const a = html.match(p.access)?.[1];
    const s = html.match(p.secret)?.[1];
    if (a && s) {
      return { accessKey: a, secretKey: s };
    }
  }

  // Parse Archive.org copyable-text UI:
  // <label for="copyable-text-...">Your S3 access key</label>
  // <label for="copyable-text-...">Your S3 secret key</label>
  const accessForId = html.match(
    /<label[^>]*for="([^"]+)"[^>]*>\s*Your\s*S3\s*access\s*key\s*<\/label>/i,
  )?.[1];

  const secretForId = html.match(
    /<label[^>]*for="([^"]+)"[^>]*>\s*Your\s*S3\s*secret\s*key\s*<\/label>/i,
  )?.[1];

  const readById = (id) => {
    if (!id) return null;

    // textarea content
    const textareaValue = html.match(
      new RegExp(`<textarea[^>]*id="${id}"[^>]*>([^<]+)</textarea>`, "i"),
    )?.[1];
    if (textareaValue) return textareaValue.trim();

    // input value
    const inputValue = html.match(
      new RegExp(`<input[^>]*id="${id}"[^>]*value="([^"]+)"`, "i"),
    )?.[1];
    if (inputValue) return inputValue.trim();

    // generic tag content
    const genericValue = html.match(
      new RegExp(`<[^>]+id="${id}"[^>]*>\\s*([^<\\s][^<]*)\\s*</[^>]+>`, "i"),
    )?.[1];
    if (genericValue) return genericValue.trim();

    return null;
  };

  const labeledAccess = readById(accessForId);
  const labeledSecret = readById(secretForId);

  if (labeledAccess && labeledSecret) {
    return { accessKey: labeledAccess, secretKey: labeledSecret };
  }

  // Last-chance single-field extraction with known names
  const accessKey =
    extractInputValue(html, "access") ||
    extractInputValue(html, "aws_access_key_id");
  const secretKey =
    extractInputValue(html, "secret") ||
    extractInputValue(html, "aws_secret_access_key");

  if (accessKey && secretKey) {
    return { accessKey, secretKey };
  }

  return { accessKey: null, secretKey: null };
}

function extractHiddenToken(html, tokenName) {
  // generic hidden input parser
  const rx1 = new RegExp(
    `<input[^>]*type="hidden"[^>]*name="${tokenName}"[^>]*value="([^"]*)"`,
    "i",
  );
  const rx2 = new RegExp(
    `<input[^>]*name="${tokenName}"[^>]*type="hidden"[^>]*value="([^"]*)"`,
    "i",
  );
  const rx3 = new RegExp(
    `<input[^>]*name="${tokenName}"[^>]*value="([^"]*)"`,
    "i",
  );
  return (
    html.match(rx1)?.[1] || html.match(rx2)?.[1] || html.match(rx3)?.[1] || null
  );
}

function looksLikeLoggedOutPage(html) {
  const h = html.toLowerCase();
  return (
    h.includes("login") &&
    (h.includes("password") || h.includes("sign in") || h.includes("log in")) &&
    !h.includes('name="access"') &&
    !h.includes("aws_access_key_id")
  );
}

async function fetchS3Page(cookieHeader) {
  return fetch("https://archive.org/account/s3.php", {
    method: "GET",
    headers: { Cookie: cookieHeader },
    redirect: "follow",
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const { loggedInUser, loggedInSig } = await context.request.json();

    if (!loggedInUser || !loggedInSig) {
      return jsonResponse(
        {
          ok: false,
          error: "Session cookies (loggedInUser, loggedInSig) are required",
        },
        400,
      );
    }

    const cookieHeader = `logged-in-user=${loggedInUser}; logged-in-sig=${loggedInSig}`;

    // Step 1: Load current s3.php page first (may include anti-CSRF hidden fields)
    const preRes = await fetchS3Page(cookieHeader);
    const preHtml = await preRes.text();

    // If keys already exist, return them directly
    const existing = extractKeys(preHtml);
    if (existing.accessKey && existing.secretKey) {
      return jsonResponse({
        ok: true,
        accessKey: existing.accessKey,
        secretKey: existing.secretKey,
      });
    }

    // If session doesn't look authenticated, fail fast with better message
    if (looksLikeLoggedOutPage(preHtml)) {
      return jsonResponse(
        {
          ok: false,
          error: "Archive.org session expired. Please sign in again.",
        },
        401,
      );
    }

    // Step 2: Build POST payload; include optional hidden tokens if present
    const form = new URLSearchParams({
      submit: "1",
      action: "generate-new-key",
    });

    // Common token names seen in account forms (safe to include only if found)
    const candidateTokens = [
      "csrf_token",
      "token",
      "authenticity_token",
      "_token",
      "form_token",
    ];

    for (const tokenName of candidateTokens) {
      const tokenValue = extractHiddenToken(preHtml, tokenName);
      if (tokenValue) form.set(tokenName, tokenValue);
    }

    // Step 3: Trigger key generation
    const genRes = await fetch("https://archive.org/account/s3.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader,
        Referer: "https://archive.org/account/s3.php",
      },
      body: form.toString(),
      redirect: "manual",
    });

    // Step 4: Read resulting page fresh
    const postReadRes = await fetchS3Page(cookieHeader);
    const postReadHtml = await postReadRes.text();
    const generated = extractKeys(postReadHtml);

    if (!generated.accessKey || !generated.secretKey) {
      const keyHints =
        postReadHtml.match(
          /.{0,120}(access|secret|aws_access_key_id|aws_secret_access_key).{0,120}/gi,
        ) || [];

      console.error("[s3keys] generation failed", {
        preStatus: preRes.status,
        postStatus: genRes.status,
        readStatus: postReadRes.status,
        hasCsrfLikeToken: candidateTokens.some(
          (n) => !!extractHiddenToken(preHtml, n),
        ),
        preHtmlStart: preHtml.slice(0, 250),
        postHtmlStart: postReadHtml.slice(0, 250),
      });
      console.error("[s3keys] key hints", keyHints.slice(0, 10));

      // If we got bounced to login after POST
      if (looksLikeLoggedOutPage(postReadHtml)) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Archive.org session expired during key generation. Please sign in again.",
          },
          401,
        );
      }

      return jsonResponse(
        {
          ok: false,
          error:
            "Failed to generate S3 keys. Please try again or visit archive.org/account/s3.php manually.",
        },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      accessKey: generated.accessKey,
      secretKey: generated.secretKey,
    });
  } catch (err) {
    console.error("[s3keys] exception", err);
    return jsonResponse(
      { ok: false, error: "Key generation failed: " + err.message },
      500,
    );
  }
}

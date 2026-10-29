function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return base64url(signature);
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
      return Response.json(
        { success: false, error: "Admin security is not configured." },
        { status: 503 }
      );
    }

    const body = await request.json();

    if (
      typeof body.username !== "string" ||
      typeof body.password !== "string" ||
      body.username !== env.ADMIN_USERNAME ||
      body.password !== env.ADMIN_PASSWORD
    ) {
      return Response.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const payload = base64url(
      new TextEncoder().encode(
        JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })
      )
    );

    const signature = await sign(payload, env.SESSION_SECRET);
    const token = `${payload}.${signature}`;

    return Response.json(
      { success: true, message: "Login successful." },
      {
        headers: {
          "Set-Cookie": `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`,
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return Response.json(
      { success: false, error: "Unable to process login." },
      { status: 400 }
    );
  }
}

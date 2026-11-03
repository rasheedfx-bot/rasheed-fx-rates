// Rasheed_Fx Rates - Admin Visitor Statistics

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(
    new RegExp("(^|;\\s*)" + name + "=([^;]*)")
  );

  return match ? match[2] : null;
}

function decodeBase64url(value) {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");

  while (base64.length % 4) {
    base64 += "=";
  }

  return atob(base64);
}

async function verifyAdmin(request, secret) {
  if (!secret) return false;

  try {
    const token = getCookie(request, "admin_session");
    if (!token) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let signatureBase64 = signature
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    while (signatureBase64.length % 4) {
      signatureBase64 += "=";
    }

    const signatureBytes = Uint8Array.from(
      atob(signatureBase64),
      character => character.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(payload)
    );

    if (!valid) return false;

    const session = JSON.parse(decodeBase64url(payload));

    return session.exp > Date.now();
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env }) {
  const authorized = await verifyAdmin(
    request,
    env.SESSION_SECRET
  );

  if (!authorized) {
    return Response.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    const totalVisitors = await env.DB.prepare(`
      SELECT COUNT(DISTINCT visitor_id) AS total
      FROM visitor_events
    `).first();

    const todayVisitors = await env.DB.prepare(`
      SELECT COUNT(DISTINCT visitor_id) AS total
      FROM visitor_events
      WHERE substr(visited_at, 1, 10) = ?
    `).bind(today).first();

    const pageViews = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM visitor_events
    `).first();

    return Response.json({
      success: true,
      total_visitors: totalVisitors?.total || 0,
      today_visitors: todayVisitors?.total || 0,
      page_views: pageViews?.total || 0
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "Unable to load visitor statistics."
      },
      { status: 500 }
    );
  }
}

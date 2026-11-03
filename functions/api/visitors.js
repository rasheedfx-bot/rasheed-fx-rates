// Rasheed_Fx Rates - Visitor Tracking

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(
    new RegExp("(^|;\\s*)" + name + "=([^;]*)")
  );
  return match ? match[2] : null;
}

function base64urlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
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

    const signatureBytes = Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(payload)
    );

    if (!valid) return false;

    const data = JSON.parse(base64urlDecode(payload));

    return data.exp > Date.now();
  } catch {
    return false;
  }
}

// Record a page view
export async function onRequestPost({ request, env }) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS visitor_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT NOT NULL,
        page TEXT NOT NULL,
        visited_at TEXT NOT NULL
      )
    `).run();

    const body = await request.json();

    const visitorId = String(body.visitor_id || "");
    const page = String(body.page || "/").slice(0, 200);

    if (!/^[a-zA-Z0-9-]{10,80}$/.test(visitorId)) {
      return Response.json(
        { success: false, error: "Invalid visitor ID." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      INSERT INTO visitor_events (visitor_id, page, visited_at)
      VALUES (?, ?, ?)
    `).bind(
      visitorId,
      page,
      new Date().toISOString()
    ).run();

    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );

  } catch (error) {
    return Response.json(
      { success: false, error: "Unable to record visit." },
      { status: 500 }
    );
  }
}

// Admin-only visitor statistics
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
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS visitor_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT NOT NULL,
        page TEXT NOT NULL,
        visited_at TEXT NOT NULL
      )
    `).run();

    const today = new Date().toISOString().slice(0, 10);

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

    return Response.json(
      {
        success: true,
        total_visitors: totalVisitors?.total || 0,
        today_visitors: todayVisitors?.total || 0,
        page_views: pageViews?.total || 0
      },
      { headers: { "Cache-Control": "no-store" } }
    );

  } catch (error) {
    return Response.json(
      { success: false, error: "Unable to load visitor statistics." },
      { status: 500 }
    );
  }
}

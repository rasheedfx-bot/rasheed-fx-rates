function decodeBase64url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function verifySession(request, secret) {
  if (!secret) return false;

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return false;

  const parts = match[1].split(".");
  if (parts.length !== 2) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64url(parts[1]),
      new TextEncoder().encode(parts[0])
    );

    if (!valid) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64url(parts[0]))
    );

    return Number.isFinite(payload.exp) && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function onRequest({ request, env }) {
  if (!(await verifySession(request, env.SESSION_SECRET))) {
    return Response.json(
      { success: false, error: "Please log in first." },
      { status: 401 }
    );
  }

  if (request.method === "GET") {
    try {
      const result = await env.DB.prepare(
        "SELECT currency, buy, sell, updated_at FROM rates ORDER BY currency"
      ).all();

      return Response.json(
        { success: true, rates: result.results },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch {
      return Response.json(
        { success: false, error: "Unable to load rates." },
        { status: 500 }
      );
    }
  }

  if (request.method === "PUT") {
    try {
      const body = await request.json();
      const allowed = ["USD", "EUR", "GBP"];

      if (!Array.isArray(body.rates) || body.rates.length !== 3) {
        return Response.json(
          { success: false, error: "Provide USD, EUR, and GBP rates." },
          { status: 400 }
        );
      }

      const seen = new Set();

      for (const rate of body.rates) {
        if (
          !rate ||
          !allowed.includes(rate.currency) ||
          seen.has(rate.currency) ||
          typeof rate.buy !== "number" ||
          typeof rate.sell !== "number" ||
          !Number.isFinite(rate.buy) ||
          !Number.isFinite(rate.sell) ||
          rate.buy <= 0 ||
          rate.sell < rate.buy ||
          rate.sell > 1000000000
        ) {
          return Response.json(
            { success: false, error: "Invalid rate values." },
            { status: 400 }
          );
        }
        seen.add(rate.currency);
      }

      if (seen.size !== 3) {
        return Response.json(
          { success: false, error: "All three currencies are required." },
          { status: 400 }
        );
      }

      const statements = body.rates.map(rate =>
        env.DB.prepare(
          "UPDATE rates SET buy = ?, sell = ?, updated_at = datetime('now') WHERE currency = ?"
        ).bind(rate.buy, rate.sell, rate.currency)
      );

      await env.DB.batch(statements);

      return Response.json(
        { success: true, message: "Rates updated successfully." },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch {
      return Response.json(
        { success: false, error: "Unable to update rates." },
        { status: 500 }
      );
    }
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "GET, PUT" }
  });
}

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

  try {
    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM updates ORDER BY id DESC"
      ).all();

      return Response.json({
        success: true,
        updates: result.results || []
      });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const title = String(body.title || "").trim();
      const message = String(body.message || "").trim();

      if (!title || !message || title.length > 100 || message.length > 3000) {
        return Response.json(
          { success: false, error: "Enter a title and message within the limits." },
          { status: 400 }
        );
      }

      await env.DB.prepare(
        "INSERT INTO updates (title, message) VALUES (?, ?)"
      ).bind(title, message).run();

      return Response.json({ success: true, message: "Update published." });
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const id = Number(body.id);
      const title = String(body.title || "").trim();
      const message = String(body.message || "").trim();

      if (!Number.isInteger(id) || id < 1 || !title || !message ||
          title.length > 100 || message.length > 3000) {
        return Response.json(
          { success: false, error: "Invalid update details." },
          { status: 400 }
        );
      }

      const result = await env.DB.prepare(
        "UPDATE updates SET title = ?, message = ? WHERE id = ?"
      ).bind(title, message, id).run();

      return Response.json({
        success: true,
        message: result.meta.changes ? "Update edited." : "Update not found."
      });
    }

    if (request.method === "DELETE") {
      const body = await request.json();
      const id = Number(body.id);

      if (!Number.isInteger(id) || id < 1) {
        return Response.json(
          { success: false, error: "Invalid update ID." },
          { status: 400 }
        );
      }

      await env.DB.prepare(
        "DELETE FROM updates WHERE id = ?"
      ).bind(id).run();

      return Response.json({ success: true, message: "Update deleted." });
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, POST, PUT, DELETE" }
    });
  } catch {
    return Response.json(
      { success: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}

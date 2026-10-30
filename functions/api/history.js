export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);

    const currency = (url.searchParams.get("currency") || "USD").toUpperCase();
    const days = Number(url.searchParams.get("days") || 7);

    const allowed = ["USD", "EUR", "GBP", "USDT"];

    if (!allowed.includes(currency)) {
      return Response.json(
        { success: false, error: "Invalid currency." },
        { status: 400 }
      );
    }

    if (![7, 30].includes(days)) {
      return Response.json(
        { success: false, error: "Choose 7 or 30 days." },
        { status: 400 }
      );
    }

    const result = await env.DB.prepare(`
      SELECT currency, buy, sell, recorded_at
      FROM rate_history
      WHERE currency = ?
      AND recorded_at >= datetime('now', ?)
      ORDER BY recorded_at ASC
      LIMIT 1000
    `).bind(currency, `-${days} days`).all();

    return Response.json(
      {
        success: true,
        currency,
        days,
        history: result.results
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );

  } catch (error) {
    return Response.json(
      { success: false, error: "Unable to load rate history." },
      { status: 500 }
    );
  }
}

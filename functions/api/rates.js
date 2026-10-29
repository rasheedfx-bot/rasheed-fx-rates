export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      "SELECT currency, buy, sell, updated_at FROM rates ORDER BY currency"
    ).all();

    const rates = {};

    for (const row of result.results) {
      rates[row.currency] = {
        buy: row.buy,
        sell: row.sell,
        updated_at: row.updated_at
      };
    }

    return Response.json({ success: true, rates }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: "Unable to load rates"
    }, { status: 500 });
  }
}

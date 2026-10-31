export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(`
      UPDATE visitor_stats
      SET total_visits = total_visits + 1
      WHERE id = 1
      RETURNING total_visits
    `).first();

    return Response.json(
      {
        success: true,
        total_visits: result.total_visits
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "Unable to load visitor count."
      },
      { status: 500 }
    );
  }
}

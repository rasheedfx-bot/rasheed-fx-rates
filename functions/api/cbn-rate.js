export async function onRequest() {
  try {
    const response = await fetch(
      "https://www.cbn.gov.ng/rates/ExchRateByCurrency.html",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "text/html"
        }
      }
    );

    if (!response.ok) throw new Error("CBN unavailable");

    const html = await response.text();

    const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];

    for (const row of rows) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(cell => cell[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim());

      if (cells.length >= 2) {
        const rate = Number(cells[1].replace(/,/g, ""));

        if (
          Number.isFinite(rate) &&
          rate > 0 &&
          /\d{4}/.test(cells[0])
        ) {
          return new Response(JSON.stringify({
            success: true,
            rate,
            date: cells[0],
            source: "Central Bank of Nigeria NFEM"
          }), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=900"
            }
          });
        }
      }
    }

    throw new Error("NFEM rate not found");

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: "Unable to retrieve the CBN rate."
    }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}

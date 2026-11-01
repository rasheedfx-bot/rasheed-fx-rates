export async function onRequest() {
  try {
    const response = await fetch(
      "https://www.cbn.gov.ng/api/GetAllNFEM_Rates",
      {
        headers: { "Accept": "application/json" }
      }
    );

    if (!response.ok) {
      throw new Error("CBN data unavailable");
    }

    const data = await response.json();

    const rows = Array.isArray(data)
      ? data
      : data.data || data.result || data.results || [];

    if (!rows.length) {
      throw new Error("No rate data returned");
    }

    const latest = rows[0];

    const rateKey = Object.keys(latest).find(key =>
      key.toLowerCase().replace(/[^a-z]/g, "").includes("nfemrate")
    );

    const dateKey = Object.keys(latest).find(key =>
      key.toLowerCase().includes("date")
    );

    const rate = Number(latest[rateKey]);

    if (!rateKey || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid CBN rate");
    }

    return new Response(JSON.stringify({
      success: true,
      rate,
      date: dateKey ? latest[dateKey] : "Latest CBN publication"
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: "Unable to retrieve the official CBN rate."
    }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}

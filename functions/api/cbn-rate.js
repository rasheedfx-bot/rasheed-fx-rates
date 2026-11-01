export async function onRequest() {
  try {
    const response = await fetch(
      "https://www.cbn.gov.ng/api/GetAllNFEM_Rates",
      { headers: { "Accept": "application/json" } }
    );

    if (!response.ok) throw new Error("CBN request failed");

    const rows = await response.json();

    if (!Array.isArray(rows) || !rows.length) {
      throw new Error("No CBN records found");
    }

    const latest = rows[0];
    const rate = Number(latest.weightedAvgRate);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid rate");
    }

    return new Response(JSON.stringify({
      success: true,
      rate,
      date: latest.ratedate,
      closingRate: Number(latest.closingrate),
      source: "CBN NFEM"
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: "Unable to retrieve CBN rate"
    }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}

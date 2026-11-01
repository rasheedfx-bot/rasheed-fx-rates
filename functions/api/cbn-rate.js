export async function onRequest() {
  try {
    const response = await fetch(
      "https://www.cbn.gov.ng/api/GetAllNFEM_Rates"
    );

    const body = await response.text();

    return new Response(JSON.stringify({
      status: response.status,
      contentType: response.headers.get("content-type"),
      response: body.slice(0, 2000)
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

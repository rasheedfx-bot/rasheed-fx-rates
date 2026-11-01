export async function onRequestPost(context) {
  try {
    const { request } = context;
    const body = await request.json();
    const message = body.message;

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "Please enter a message." },
        { status: 400 }
      );
    }

    const reply = `Welcome to Rasheed_Fx Rates!

I can help you with:
1. USD exchange rates
2. EUR exchange rates
3. GBP exchange rates
4. USDT exchange rates
5. Currency conversion
6. How to contact Rasheed_Fx

For the latest rates, visit:
https://rasheed-fx-rates.pages.dev/

For personal assistance, contact Rasheed_Fx on WhatsApp: 09037125919.`;

    return Response.json({ reply });
  } catch (error) {
    return Response.json(
      { error: "Unable to process your request." },
      { status: 500 }
    );
  }
}

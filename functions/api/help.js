export async function onRequestPost(context) {
  try {
    const { request, env } = context;

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
4. Currency conversion
5. How to contact Rasheed_Fx

For the latest rates, visit:
https://rasheed-fx-rates.pages.dev/

For personal assistance, contact us on WhatsApp.`;

    return Response.json({ reply });

  } catch (error) {
    return Response.json(
      { error: "Unable to process your request." },
      { status: 500 }
    );
  }
}

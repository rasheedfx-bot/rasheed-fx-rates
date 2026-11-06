export async function onRequestPost({ request, env }) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json(
        { error: "Please enter a message." },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return Response.json(
        { error: "Message is too long." },
        { status: 400 }
      );
    }

    if (!env.AI) {
      throw new Error("Workers AI binding is missing.");
    }

    const rateResponse = await fetch(
      new URL("/api/rates", request.url)
    );

    const rates = rateResponse.ok
      ? await rateResponse.json()
      : "Rates currently unavailable.";

    const systemPrompt = `
You are RASHEED_FX AI, the official assistant
for Rasheed_Fx Rates.

Help visitors with:
- USD, EUR, GBP and USDT.
- Currency conversion.
- Buying rates.
- Selling rates.
- Live market rates.
- Website navigation.
- Customer support.

BUYING RATE:
The rate Rasheed_Fx pays when buying foreign currency.

SELLING RATE:
The rate Rasheed_Fx charges when selling foreign currency.

LIVE MARKET RATE:
The general market exchange rate.
Never confuse it with buying or selling rates.

Use only the supplied rate information.
Never invent exchange rates.
Explain that rates can change.

If the live market rate is unavailable,
say so clearly.

For personal assistance:
WhatsApp: 09037125919

Be friendly, professional and concise.

CURRENT RATES:
${JSON.stringify(rates)}
`;

    const result = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      {
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: message.trim()
          }
        ],
        max_tokens: 500
      }
    );

    return Response.json({
      reply: result.response ||
        "Sorry, please try again."
    });

  } catch (error) {
    console.error("RASHEED_FX AI ERROR:", error);

    return Response.json(
      {
        error: "Support is temporarily unavailable. Contact Rasheed_Fx on WhatsApp: 09037125919."
      },
      { status: 500 }
    );
  }
}

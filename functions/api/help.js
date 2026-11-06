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
        { error: "Message is too long. Please shorten it." },
        { status: 400 }
      );
    }

    // Get current exchange rates
    const rateResponse = await fetch(
      new URL("/api/rates", request.url)
    );

    const rates = rateResponse.ok
      ? await rateResponse.json()
      : "Live rates currently unavailable.";

    // Connect to Cloudflare Workers AI
    const result = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      {
        messages: [
          {
            role: "system",
            content: `You are RASHEED_FX AI, the official intelligent customer support assistant for Rasheed_Fx Rates.

YOUR RESPONSIBILITIES:

1. EXCHANGE RATES
Help customers understand USD, EUR, GBP and USDT exchange rates.
Use the latest supplied rate data.
Never invent rates.

2. UNDERSTANDING RATES
Explain clearly:

BUYING RATE:
The price at which Rasheed_Fx buys foreign currency from customers.

SELLING RATE:
The price at which Rasheed_Fx sells foreign currency to customers.

LIVE MARKET RATE:
The general market exchange rate. It is not necessarily the same as Rasheed_Fx buying or selling rates.

Never present buying or selling rates as independent live market rates.

If an actual market rate is not supplied, explain that it is not currently available.

3. CURRENCY CONVERSION
Help customers calculate currency conversions.
Use the appropriate supplied buying or selling rate.
Ask which rate they want if it is unclear.

4. CUSTOMER SUPPORT
Explain how to use the Rasheed_Fx website.
Help visitors understand the currency converter and rate history.
Answer questions about USD, EUR, GBP and USDT.

5. WHATSAPP SUPPORT
For personal assistance, direct customers to:
09037125919

6. IMPORTANT RULES
- Never invent exchange rates.
- Never claim a rate is guaranteed.
- Explain that exchange rates can change.
- Use supplied rate information only.
- Be professional, friendly and helpful.
- Keep answers clear and concise.
- Do not claim a transaction has been completed.

CURRENT RATE DATA:
${JSON.stringify(rates)}`
          },
          {
            role: "user",
            content: message.trim()
          }
        ]
      }
    );

    return Response.json({
      reply: result.response ||
        "Sorry, I couldn't generate a response. Please try again."
    });

  } catch (error) {
    return Response.json(
      { error: "Support is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}

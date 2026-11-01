export async function onRequestPost({ request, env }) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "Please enter a message." },
        { status: 400 }
      );
    }

    const rateResponse = await fetch(
      new URL("/api/rates", request.url)
    );

    const rates = rateResponse.ok
      ? await rateResponse.json()
      : "Live rates currently unavailable.";

    const result = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      {
        messages: [
          {
            role: "system",
            content: `You are the AI customer support assistant for Rasheed_Fx Rates.

Help visitors with USD, EUR, GBP and USDT rates, currency conversion and general questions about Rasheed_Fx.

Current rate data:
${JSON.stringify(rates)}

Use the supplied rate data when answering rate questions.
Never invent exchange rates.
Explain that rates can change.
For personal assistance, direct visitors to WhatsApp: 09037125919.
Keep replies friendly, clear and concise.`
          },
          {
            role: "user",
            content: message
          }
        ]
      }
    );

    return Response.json({
      reply: result.response || "Sorry, I couldn't generate a response."
    });

  } catch (error) {
    return Response.json(
      { error: "Support is temporarily unavailable." },
      { status: 500 }
    );
  }
}

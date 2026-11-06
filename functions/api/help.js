export async function onRequestPost({ request, env }) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ error: "Please enter a message." }, { status: 400 });
    }

    if (message.length > 2000) {
      return Response.json({ error: "Message is too long." }, { status: 400 });
    }

    if (!env.AI) {
      throw new Error("Workers AI binding is missing.");
    }

    const rateResponse = await fetch(new URL("/api/rates", request.url));

    if (!rateResponse.ok) {
      throw new Error("Unable to retrieve current rates.");
    }

    const rateData = await rateResponse.json();
    const rates = rateData.rates || {};

    const match = message.match(
      /(?:convert\s*)?([$₦])?\s*([\d,]+(?:\.\d+)?)\s*(USD|EUR|GBP|USDT|NGN|NAIRA|DOLLARS?|EUROS?|POUNDS?)?\s*(?:TO|INTO)\s*([$₦])?\s*(USD|EUR|GBP|USDT|NGN|NAIRA|DOLLARS?|EUROS?|POUNDS?)/i
    );

    if (match) {
      const amount = Number(match[2].replace(/,/g, ""));

      const normalize = value => {
        if (!value) return null;
        const v = value.toUpperCase();

        if (["NAIRA", "₦"].includes(v)) return "NGN";
        if (["DOLLAR", "DOLLARS", "$"].includes(v)) return "USD";
        if (["EURO", "EUROS"].includes(v)) return "EUR";
        if (["POUND", "POUNDS"].includes(v)) return "GBP";

        return v;
      };

      const from = normalize(match[3]) || normalize(match[1]);
      const to = normalize(match[5]) || normalize(match[4]);

      if (!from || !to || amount <= 0 || !Number.isFinite(amount)) {
        return Response.json({
          reply: "Please provide the amount and currencies clearly."
        });
      }

      if (from === to) {
        return Response.json({
          reply: `${amount.toLocaleString()} ${from} = ${amount.toLocaleString()} ${to}.`
        });
      }

      const currency = from === "NGN" ? to : from;
      const entry = rates[currency];

      if (!entry || !["USD", "EUR", "GBP", "USDT"].includes(currency)) {
        return Response.json({
          reply: "Sorry, I couldn't find that currency in the current Rasheed_Fx rates."
        });
      }

      const explicitBuying = /buying\s+rate|buy\s+rate/i.test(message);
      const explicitSelling = /selling\s+rate|sell\s+rate/i.test(message);

      let rateType;

      if (explicitBuying) {
        rateType = "buy";
      } else if (explicitSelling) {
        rateType = "sell";
      } else {
        rateType = from === "NGN" ? "sell" : "buy";
      }

      const rate = Number(entry[rateType]);

      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error("Invalid exchange rate.");
      }

      const result = from === "NGN"
        ? amount / rate
        : amount * rate;

      return Response.json({
        reply:
          `${amount.toLocaleString()} ${from} = ${result.toLocaleString("en-NG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })} ${to}.\n\n` +
          `Rate used: ₦${rate.toLocaleString("en-NG")} per ${currency}.\n` +
          `Rate type: ${rateType.toUpperCase()}.\n\n` +
          `This calculation uses the current Rasheed_Fx ${rateType} rate. Rates can change.`
      });
    }

    const systemPrompt = `
You are RASHEED_FX AI, the official website support assistant.

Supported currencies: USD, EUR, GBP and USDT.

CURRENT LIVE RATES:
${JSON.stringify(rates)}

Explain:
- Buying rate: Rasheed_Fx buys foreign currency from customers.
- Selling rate: Rasheed_Fx sells foreign currency to customers.
- Foreign currency to NGN: multiply by the applicable rate.
- NGN to foreign currency: divide by the applicable rate.

Never invent exchange rates.
Never claim a transaction has been completed.
For general conversion questions, explain which rate applies.
WhatsApp support: 09037125919.

Be friendly, professional and concise.
`;

    const result = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message.trim() }
        ],
        max_tokens: 500
      }
    );

    return Response.json({
      reply: result.response || "Sorry, please try again."
    });

  } catch (error) {
    console.error("RASHEED_FX AI ERROR:", error);

    return Response.json(
      {
        error: "Support is temporarily unavailable. Please try again."
      },
      { status: 500 }
    );
  }
}

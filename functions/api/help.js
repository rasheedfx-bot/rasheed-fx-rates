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

    const rateResponse = await fetch(
      new URL("/api/rates", request.url)
    );

    if (!rateResponse.ok) {
      throw new Error("Unable to retrieve current rates.");
    }

    const rateData = await rateResponse.json();
    const rates = rateData.rates || {};

    // Recognise currency names, codes and symbols.
    const normalize = value => {
      if (!value) return null;

      const v = value.toUpperCase();

      if (["NAIRA", "NGN", "₦"].includes(v)) return "NGN";
      if (["DOLLAR", "DOLLARS", "USD", "$"].includes(v)) return "USD";
      if (["EURO", "EUROS", "EUR", "€"].includes(v)) return "EUR";
      if (["POUND", "POUNDS", "GBP", "£"].includes(v)) return "GBP";

      return v;
    };

    // Detect conversions such as €200 in naira or $100 to NGN.
    const match = message.match(
      /(?:convert\s*)?([$€£₦])?\s*([\d,]+(?:\.\d+)?)\s*(USD|EUR|GBP|USDT|NGN|NAIRA|DOLLARS?|EUROS?|POUNDS?)?\s*(?:TO|INTO|IN)\s*([$€£₦])?\s*(USD|EUR|GBP|USDT|NGN|NAIRA|DOLLARS?|EUROS?|POUNDS?)/i
    );

    if (match) {
      const amount = Number(match[2].replace(/,/g, ""));

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

      const supported = ["USD", "EUR", "GBP", "USDT"];

      const currency = from === "NGN" ? to : from;

      if (
        !supported.includes(currency) ||
        (from !== "NGN" && to !== "NGN")
      ) {
        return Response.json({
          reply: "Currently, I can convert USD, EUR, GBP and USDT against NGN."
        });
      }

      const entry = rates[currency];

      if (!entry) {
        throw new Error(`Missing live rate for ${currency}.`);
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

    // General AI customer support.
    if (!env.AI) {
      throw new Error("Workers AI binding is missing.");
    }

    const systemPrompt = `
You are RASHEED_FX AI, the official website support assistant.

Supported currencies: USD, EUR, GBP and USDT.

CURRENT LIVE RATES:
${JSON.stringify(rates)}

Buying rate: Rasheed_Fx buys foreign currency from customers.
Selling rate: Rasheed_Fx sells foreign currency to customers.

Foreign currency to NGN: multiply by the applicable rate.
NGN to foreign currency: divide by the applicable rate.

Never invent exchange rates.
Never claim a transaction has been completed.
Never invent a live market rate.

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

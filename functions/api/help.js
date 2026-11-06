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

// Get current rates
const rateResponse = await fetch(
  new URL("/api/rates", request.url)
);

if (!rateResponse.ok) {
  throw new Error("Unable to retrieve current rates.");
}

const rates = await rateResponse.json();

// Convert rate data into a readable format
const rateList = Array.isArray(rates)
  ? rates
  : rates.rates || [];

// Detect direct currency conversion requests
const conversion = message.match(
  /(?:convert\s*)?[$₦]?\s*([\d,]+(?:\.\d+)?)\s*(USD|EUR|GBP|USDT|NGN|NAIRA|DOLLARS?|EUROS?|POUNDS?)\s*(?:TO|INTO|IN)\s*(USD|EUR|GBP|USDT|NGN|NAIRA|NAIRA|DOLLARS?|EUROS?|POUNDS?)/i
);

if (conversion) {
  const amount = Number(conversion[1].replace(/,/g, ""));

  const normalize = value => {
    const v = value.toUpperCase();
    if (v === "NAIRA") return "NGN";
    if (v === "DOLLAR" || v === "DOLLARS") return "USD";
    if (v === "EURO" || v === "EUROS") return "EUR";
    if (v === "POUND" || v === "POUNDS") return "GBP";
    return v;
  };

  const from = normalize(conversion[2]);
  const to = normalize(conversion[3]);

  if (from === "NGN" && to !== "NGN") {
    return Response.json({
      reply: `Please specify whether you want the Rasheed_Fx buying or selling rate for ${to} before I calculate your conversion.`
    });
  }

  const currency = from === "NGN" ? to : from;

  const entry = rateList.find(
    item => item.currency?.toUpperCase() === currency
  );

  if (entry && from !== to) {
    const rate = from === "NGN"
      ? Number(entry.sell)
      : Number(entry.sell);

    if (Number.isFinite(rate) && rate > 0) {
      const result = from === "NGN"
        ? amount / rate
        : amount * rate;

      return Response.json({
        reply: `${amount.toLocaleString()} ${from} = ${result.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} ${to}.\n\nRate used: ₦${rate.toLocaleString("en-NG")} per ${currency}.\n\nThis is an indicative calculation using the supplied selling rate. Rates can change.`
      });
    }
  }
}

const systemPrompt = `

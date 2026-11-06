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
  "@cf/meta/llama-3.1-8b-instruct-fast",
  {
    messages: [
      {
        role: "system",
        content: `You are RASHEED_FX AI, the official customer support assistant for Rasheed_Fx Rates.

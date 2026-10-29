const DEFAULT_RATES = {
  USD: { buy: 1490, sell: 1510 },
  EUR: { buy: 1720, sell: 1750 },
  GBP: { buy: 1990, sell: 2030 }
};

export async function onRequestGet() {
  return new Response(JSON.stringify({
    success: true,
    rates: DEFAULT_RATES,
    note: "These are example rates, not live market rates."
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

const rates = {};

for (const row of result.results) {
  rates[row.currency] = {
    buy: row.buy,
    sell: row.sell,
    updated_at: row.updated_at
  };
}

return Response.json({
  success: true,
  rates
}, {
  headers: { "Cache-Control": "no-store" }
});

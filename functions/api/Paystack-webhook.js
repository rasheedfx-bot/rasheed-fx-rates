async function verifySignature(body, signature, secret) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );

  const hash = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body)
  );

  const expected = [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return expected === signature;
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = env.PAYSTACK_SECRET_KEY_TEST;

    if (!secret || !env.DB) {
      return new Response("Server configuration missing", {
        status: 500
      });
    }

    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    if (!signature || !(await verifySignature(body, signature, secret))) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event !== "charge.success") {
      return new Response("Event received", { status: 200 });
    }

    const payment = event.data;
    const reference = payment.reference;

    // Verify the transaction directly with Paystack
    const verification = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`
        }
      }
    );

    const result = await verification.json();

    if (
      !verification.ok ||
      !result.status ||
      result.data.status !== "success" ||
      result.data.currency !== "NGN" ||
      result.data.amount !== 500000
    ) {
      return new Response("Payment not verified", { status: 400 });
    }

    const email = result.data.customer.email;
    const whatsapp = result.data.metadata?.whatsapp;

    if (!email || !whatsapp) {
      return new Response("Customer details missing", { status: 400 });
    }

    const paidAt = result.data.paid_at
      ? new Date(result.data.paid_at)
      : new Date();

    const expiresAt = new Date(
      paidAt.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO premium_subscribers
      (email, whatsapp, paystack_reference, status, expires_at)
      VALUES (?, ?, ?, 'active', ?)
    `).bind(
      email,
      whatsapp,
      reference,
      expiresAt
    ).run();

    return new Response("Payment confirmed", { status: 200 });

  } catch (error) {
    return new Response("Webhook error", { status: 500 });
  }
}

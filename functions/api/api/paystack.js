export async function onRequestPost({ request, env }) {
  try {
    if (!env.PAYSTACK_SECRET_KEY || !env.PAYSTACK_PLAN_CODE) {
      return Response.json({
        success: false,
        message: "Payment configuration is incomplete."
      }, { status: 500 });
    }

    const { email } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({
        success: false,
        message: "Enter a valid email address."
      }, { status: 400 });
    }

    const origin = new URL(request.url).origin;

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          plan: env.PAYSTACK_PLAN_CODE,
          callback_url: `${origin}/?premium_payment=callback`,
          metadata: {
            service: "Rasheed_Fx Premium"
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status) {
      return Response.json({
        success: false,
        message: "Unable to initialize payment."
      }, { status: 400 });
    }

    return Response.json({
      success: true,
      authorization_url: result.data.authorization_url,
      reference: result.data.reference
    });

  } catch {
    return Response.json({
      success: false,
      message: "Something went wrong."
    }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = env.PAYSTACK_SECRET_KEY_TEST;
    const plan = env.PAYSTACK_PLAN_CODE_TEST;

    if (!secret || !plan) {
      return Response.json({
        success: false,
        message: "Test payment settings are missing."
      }, { status: 500 });
    }

    const { email, whatsapp } = await request.json();

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !whatsapp
    ) {
      return Response.json({
        success: false,
        message: "Valid email and WhatsApp number required."
      }, { status: 400 });
    }

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          plan,
          currency: "NGN",
          callback_url: new URL("/", request.url).href,
          metadata: {
            service: "Rasheed_Fx Premium",
            whatsapp
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status) {
      return Response.json({
        success: false,
        message: "Could not start payment."
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
      message: "Payment connection error."
    }, { status: 500 });
  }
}

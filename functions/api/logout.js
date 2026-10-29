export async function onRequestPost() {
  return new Response(
    JSON.stringify({ success: true, message: "Logged out." }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
        "Cache-Control": "no-store"
      }
    }
  );
}

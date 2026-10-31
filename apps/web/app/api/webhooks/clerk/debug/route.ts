export async function POST(req: Request) {
  const requestHeaders = new Headers(req.headers);
  const body = await req.text();

  const headersList = {
    "svix-id": requestHeaders.get("svix-id"),
    "svix-timestamp": requestHeaders.get("svix-timestamp"),
    "svix-signature": requestHeaders.get("svix-signature"),
    "content-type": requestHeaders.get("content-type"),
  };

  console.log("[Webhook Debug]", {
    headers: headersList,
    bodyLength: body.length,
    bodyPreview: body.substring(0, 100),
  });

  return new Response(
    JSON.stringify({
      received: true,
      headers: headersList,
      bodyLength: body.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

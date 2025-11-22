import { auth } from "@clerk/nextjs/server";

export const POST = async (req: Request) => {
  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ error: { message: "Unauthorized" } }, { status: 401 });

  const convexAuthToken = await getToken({ template: "convex" });

  const url = new URL("/api/ai/chat", process.env.NEXT_PUBLIC_API_ENDPOINT);
  const headers = {
    ...req.headers,
    Authorization: `Bearer ${convexAuthToken}`,
    "X-User-Id": userId,
  };

  const response = await fetch(url, {
    body: await req.text(),
    signal: req.signal,
    headers,
    method: "POST",
  });

  if (!response.ok) {
    return Response.json(response.body, { status: response.status, headers: response.headers });
  }

  return new Response(null, {
    status: response.status,
    headers: { "X-Request-Id": response.headers.get("X-Request-Id")! },
  });
};

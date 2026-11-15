import { isPrivateHost } from "../src/lib/public-host.js";

// Transport only: Core-auth owns sessions; Rust owns identity checks and authorization.
interface ProxyEnvironment {
  CORE_AUTH_PROXY_TARGET?: string;
  CORE_API_PROXY_TARGET?: string;
}

export function parseProxyOrigin(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? "");
    const host = url.hostname.replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      isPrivateHost(host)
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error(
      "Proxy target must be a public HTTPS origin without credentials, a path, a query, or a fragment.",
    );
  }
}

function failure(status: number) {
  return Response.json(
    { code: "service_unavailable", error: "Service unavailable" },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

async function readBody(request: Request): Promise<Uint8Array | undefined> {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64 * 1024) {
      await reader.cancel();
      throw new RangeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function proxyServiceRequest(
  request: Request,
  env: ProxyEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  const auth = url.pathname.startsWith("/api/auth/");
  const api = url.pathname.startsWith("/api/v1/");
  if ((!auth && !api) || /%2f|%5c|%2e|\\/i.test(url.pathname))
    return failure(404);
  if (
    !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  )
    return failure(405);
  // Do not turn the proxy into an ambient-cookie gateway for other sites.
  const origin = request.headers.get("Origin");
  if (
    (origin && origin !== url.origin) ||
    (!["GET", "HEAD"].includes(request.method) && origin !== url.origin)
  )
    return failure(403);

  let target: string;
  try {
    target = parseProxyOrigin(
      auth ? env.CORE_AUTH_PROXY_TARGET : env.CORE_API_PROXY_TARGET,
    );
  } catch {
    return failure(503);
  }

  const headers = new Headers();
  for (const name of [
    "accept",
    "content-type",
    "cookie",
    "origin",
    "x-core-csrf",
  ]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  try {
    const body = await readBody(request);
    const upstream = await fetch(`${target}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: body as BodyInit | undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]),
    });
    // Never follow an upstream redirect carrying ambient cookies to another host.
    if (upstream.status >= 300 && upstream.status < 400) return failure(502);
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["content-type", "retry-after", "x-request-id"]) {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }
    // Preserve multiple HttpOnly/Secure/Path/SameSite cookies, including sign-out expiry.
    if (auth)
      for (const cookie of upstream.headers.getSetCookie())
        responseHeaders.append("Set-Cookie", cookie);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return failure(error instanceof RangeError ? 413 : 503);
  }
}

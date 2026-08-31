// Framework-agnostic HTTP primitives. The router layer is built on these so the
// sample stays dependency-free while reading like a real Express/Koa app.

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface HttpRequest {
  method: Method;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
  /** Populated by the auth middleware once a request is authenticated. */
  userId?: string;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

export type Handler = (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;

export type Middleware = (req: HttpRequest) => Promise<void> | void;

export function ok(body: unknown, status = 200): HttpResponse {
  return { status, body };
}

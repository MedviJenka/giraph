// A tiny router: registers method+path handlers, matches incoming requests, and
// converts thrown AppErrors into HTTP responses. Framework-free on purpose.

import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import type { Handler, HttpRequest, HttpResponse, Method } from "../lib/http";

interface Route {
  method: Method;
  segments: string[];
  handler: Handler;
}

const log = logger.child("router");

export class Router {
  private readonly routes: Route[] = [];

  constructor(readonly prefix: string) {}

  register(method: Method, path: string, handler: Handler): this {
    this.routes.push({ method, segments: this.split(path), handler });
    return this;
  }

  get(path: string, handler: Handler): this {
    return this.register("GET", path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.register("POST", path, handler);
  }

  patch(path: string, handler: Handler): this {
    return this.register("PATCH", path, handler);
  }

  delete(path: string, handler: Handler): this {
    return this.register("DELETE", path, handler);
  }

  private split(path: string): string[] {
    return `${this.prefix}${path}`.split("/").filter(Boolean);
  }

  private match(req: HttpRequest): { route: Route; params: Record<string, string> } | null {
    const parts = req.path.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== req.method || route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i];
        if (seg.startsWith(":")) params[seg.slice(1)] = parts[i];
        else if (seg !== parts[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { route, params };
    }
    return null;
  }

  async handle(req: HttpRequest): Promise<HttpResponse> {
    const hit = this.match(req);
    if (!hit) return { status: 404, body: { error: "route not found" } };
    try {
      return await hit.route.handler({ ...req, params: hit.params });
    } catch (err) {
      if (err instanceof AppError) {
        return { status: err.status, body: { error: err.message, code: err.code } };
      }
      log.error("unhandled error", { path: req.path, err: String(err) });
      return { status: 500, body: { error: "internal error" } };
    }
  }
}

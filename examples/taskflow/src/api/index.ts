// API composition root. Aggregates every feature router and dispatches an
// incoming request to the first router whose prefix matches.

import { authRouter } from "./auth.router";
import { userRouter } from "./user.router";
import { projectRouter } from "./project.router";
import { taskRouter } from "./task.router";
import type { HttpRequest, HttpResponse } from "../lib/http";
import type { Router } from "./router";

const routers: Router[] = [authRouter, userRouter, projectRouter, taskRouter];

/** Route a request to the owning router by path prefix. */
export async function handleRequest(req: HttpRequest): Promise<HttpResponse> {
  const router = routers.find((r) => req.path.startsWith(r.prefix));
  if (!router) return { status: 404, body: { error: "no matching api" } };
  return router.handle(req);
}

export { authRouter, userRouter, projectRouter, taskRouter };

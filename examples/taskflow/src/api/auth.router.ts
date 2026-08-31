// Authentication endpoints. Delegates all logic to the auth service.

import { Router } from "./router";
import { ok } from "../lib/http";
import { requireObject, asEmail, asString } from "../lib/validation";
import { authService } from "../services/auth.service";

export const authRouter = new Router("/auth");

authRouter.post("/register", (req) => {
  const body = requireObject(req.body);
  const result = authService.register(
    asEmail(body.email),
    asString(body.displayName, "displayName"),
    asString(body.password, "password"),
  );
  return ok(result, 201);
});

authRouter.post("/login", (req) => {
  const body = requireObject(req.body);
  const result = authService.login({
    email: asEmail(body.email),
    password: asString(body.password, "password"),
  });
  return ok(result);
});

authRouter.post("/logout", (req) => {
  authService.logout(req.headers.authorization ?? "");
  return ok(null, 204);
});

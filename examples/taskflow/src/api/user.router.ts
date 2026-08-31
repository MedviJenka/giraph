// User endpoints. Every route authenticates the bearer token via the auth
// service before touching the user service.

import { Router } from "./router";
import { ok } from "../lib/http";
import { requireObject, asString } from "../lib/validation";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";

export const userRouter = new Router("/users");

userRouter.get("/", (req) => {
  authService.authenticate(req.headers.authorization);
  return ok(userService.list());
});

userRouter.get("/me", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  return ok(userService.getById(userId));
});

userRouter.get("/:id", (req) => {
  authService.authenticate(req.headers.authorization);
  return ok(userService.getById(req.params.id));
});

userRouter.patch("/me", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  const body = requireObject(req.body);
  return ok(userService.rename(userId, asString(body.displayName, "displayName")));
});

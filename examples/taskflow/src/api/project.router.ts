// Project endpoints.

import { Router } from "./router";
import { ok } from "../lib/http";
import { requireObject, asString, asOptionalString } from "../lib/validation";
import { authService } from "../services/auth.service";
import { projectService } from "../services/project.service";

export const projectRouter = new Router("/projects");

projectRouter.get("/", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  return ok(projectService.listForUser(userId));
});

projectRouter.post("/", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  const body = requireObject(req.body);
  const project = projectService.create(
    userId,
    asString(body.name, "name"),
    asOptionalString(body.description, "description"),
  );
  return ok(project, 201);
});

projectRouter.get("/:id", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  return ok(projectService.get(req.params.id, userId));
});

projectRouter.post("/:id/members", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  const body = requireObject(req.body);
  const project = projectService.addMember(req.params.id, userId, asString(body.userId, "userId"));
  return ok(project);
});

projectRouter.delete("/:id", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  return ok(projectService.archive(req.params.id, userId), 204);
});

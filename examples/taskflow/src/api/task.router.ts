// Task endpoints.

import { Router } from "./router";
import { ok } from "../lib/http";
import { requireObject, asString, asOptionalString, asEnum } from "../lib/validation";
import { authService } from "../services/auth.service";
import { taskService } from "../services/task.service";
import { TASK_STATUSES, TASK_PRIORITIES } from "../models/task.model";

export const taskRouter = new Router("/tasks");

taskRouter.get("/project/:projectId", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  return ok(taskService.listForProject(req.params.projectId, userId));
});

taskRouter.post("/", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  const body = requireObject(req.body);
  const task = taskService.create(userId, {
    projectId: asString(body.projectId, "projectId"),
    title: asString(body.title, "title"),
    description: asOptionalString(body.description, "description"),
    priority: body.priority === undefined
      ? undefined
      : asEnum(body.priority, TASK_PRIORITIES, "priority"),
  });
  return ok(task, 201);
});

taskRouter.patch("/:id/status", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  const body = requireObject(req.body);
  const status = asEnum(body.status, TASK_STATUSES, "status");
  return ok(taskService.setStatus(req.params.id, userId, status));
});

taskRouter.patch("/:id/assignee", (req) => {
  const userId = authService.authenticate(req.headers.authorization);
  const body = requireObject(req.body);
  return ok(taskService.assign(req.params.id, userId, asString(body.assigneeId, "assigneeId")));
});

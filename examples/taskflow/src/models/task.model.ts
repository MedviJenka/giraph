// Task database model. Tasks belong to a project and may be assigned to a user.

import { newId, now } from "../lib/id";
import type { Project } from "./project.model";
import type { User } from "./user.model";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  projectId: Project["id"];
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: User["id"] | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
}

export function makeTask(input: NewTask): Task {
  const ts = now();
  return {
    id: newId("tsk"),
    projectId: input.projectId,
    title: input.title,
    description: input.description ?? "",
    status: "todo",
    priority: input.priority ?? "medium",
    assigneeId: input.assigneeId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
}

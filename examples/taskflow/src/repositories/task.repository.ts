// Data access for tasks, scoped by project and assignee.

import { BaseRepository } from "./base.repository";
import type { Task, TaskStatus } from "../models/task.model";

export class TaskRepository extends BaseRepository<"tasks", Task> {
  constructor() {
    super("tasks");
  }

  findByProject(projectId: string): Task[] {
    return this.where((t) => t.projectId === projectId);
  }

  findByAssignee(userId: string): Task[] {
    return this.where((t) => t.assigneeId === userId);
  }

  countByStatus(projectId: string): Record<TaskStatus, number> {
    const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 };
    for (const task of this.findByProject(projectId)) counts[task.status] += 1;
    return counts;
  }
}

export const taskRepository = new TaskRepository();

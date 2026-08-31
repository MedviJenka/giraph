// Task lifecycle. Enforces project membership via the project service and emits
// notifications on assignment and completion.

import { ForbiddenError, NotFoundError } from "../lib/errors";
import { taskRepository } from "../repositories/task.repository";
import { projectRepository } from "../repositories/project.repository";
import { notificationService } from "./notification.service";
import { makeTask } from "../models/task.model";
import type { Task, TaskStatus, TaskPriority } from "../models/task.model";

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
}

export class TaskService {
  private assertMember(projectId: string, userId: string): void {
    if (!projectRepository.isMember(projectId, userId)) {
      throw new ForbiddenError("not a member of this project");
    }
  }

  create(actorId: string, input: CreateTaskInput): Task {
    this.assertMember(input.projectId, actorId);
    const task = makeTask(input);
    taskRepository.insert(task);
    if (task.assigneeId) notificationService.taskAssigned(task.id, task.assigneeId);
    return task;
  }

  listForProject(projectId: string, actorId: string): Task[] {
    this.assertMember(projectId, actorId);
    return taskRepository.findByProject(projectId);
  }

  setStatus(taskId: string, actorId: string, status: TaskStatus): Task {
    const task = taskRepository.findById(taskId);
    if (!task) throw new NotFoundError("task", taskId);
    this.assertMember(task.projectId, actorId);
    task.status = status;
    task.updatedAt = new Date().toISOString();
    taskRepository.update(task);
    if (status === "done") notificationService.taskCompleted(task.id, task.projectId);
    return task;
  }

  assign(taskId: string, actorId: string, assigneeId: string): Task {
    const task = taskRepository.findById(taskId);
    if (!task) throw new NotFoundError("task", taskId);
    this.assertMember(task.projectId, actorId);
    if (!projectRepository.isMember(task.projectId, assigneeId)) {
      throw new ForbiddenError("assignee is not a project member");
    }
    task.assigneeId = assigneeId;
    task.updatedAt = new Date().toISOString();
    taskRepository.update(task);
    notificationService.taskAssigned(task.id, assigneeId);
    return task;
  }
}

export const taskService = new TaskService();

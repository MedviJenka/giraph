// Fan-out for domain events. In production this would enqueue email/push jobs;
// here it just logs, but the call sites model the real dependency direction.

import { logger } from "../lib/logger";

const log = logger.child("notify");

export class NotificationService {
  taskAssigned(taskId: string, assigneeId: string): void {
    log.info("task assigned", { taskId, assigneeId });
  }

  taskCompleted(taskId: string, projectId: string): void {
    log.info("task completed", { taskId, projectId });
  }

  addedToProject(projectId: string, userId: string): void {
    log.info("member added to project", { projectId, userId });
  }
}

export const notificationService = new NotificationService();

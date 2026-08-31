// Project lifecycle and membership management.

import { ForbiddenError, NotFoundError } from "../lib/errors";
import { projectRepository } from "../repositories/project.repository";
import { userRepository } from "../repositories/user.repository";
import { notificationService } from "./notification.service";
import { makeProject } from "../models/project.model";
import type { Project } from "../models/project.model";

export class ProjectService {
  create(ownerId: string, name: string, description?: string): Project {
    const project = makeProject({ ownerId, name, description });
    return projectRepository.insert(project);
  }

  listForUser(userId: string): Project[] {
    return projectRepository.findByMember(userId);
  }

  get(projectId: string, userId: string): Project {
    const project = projectRepository.findById(projectId);
    if (!project) throw new NotFoundError("project", projectId);
    if (!project.memberIds.includes(userId)) {
      throw new ForbiddenError("not a member of this project");
    }
    return project;
  }

  addMember(projectId: string, actorId: string, newMemberId: string): Project {
    const project = this.get(projectId, actorId);
    if (project.ownerId !== actorId) {
      throw new ForbiddenError("only the owner can add members");
    }
    if (!userRepository.findById(newMemberId)) {
      throw new NotFoundError("user", newMemberId);
    }
    if (!project.memberIds.includes(newMemberId)) {
      project.memberIds.push(newMemberId);
      project.updatedAt = new Date().toISOString();
      projectRepository.update(project);
      notificationService.addedToProject(projectId, newMemberId);
    }
    return project;
  }

  archive(projectId: string, actorId: string): Project {
    const project = this.get(projectId, actorId);
    if (project.ownerId !== actorId) {
      throw new ForbiddenError("only the owner can archive a project");
    }
    project.archived = true;
    project.updatedAt = new Date().toISOString();
    return projectRepository.update(project);
  }
}

export const projectService = new ProjectService();

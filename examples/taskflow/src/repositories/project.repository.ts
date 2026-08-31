// Data access for projects and their membership queries.

import { BaseRepository } from "./base.repository";
import type { Project } from "../models/project.model";

export class ProjectRepository extends BaseRepository<"projects", Project> {
  constructor() {
    super("projects");
  }

  findByMember(userId: string): Project[] {
    return this.where((p) => !p.archived && p.memberIds.includes(userId));
  }

  isMember(projectId: string, userId: string): boolean {
    const project = this.findById(projectId);
    return project !== null && project.memberIds.includes(userId);
  }
}

export const projectRepository = new ProjectRepository();

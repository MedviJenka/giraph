// Project database model. A project groups tasks and is owned by a single user;
// membership is a denormalised list of user ids for this in-memory sample.

import { newId, now } from "../lib/id";
import type { User } from "./user.model";

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: User["id"];
  memberIds: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewProject {
  name: string;
  description?: string;
  ownerId: string;
}

export function makeProject(input: NewProject): Project {
  const ts = now();
  return {
    id: newId("prj"),
    name: input.name,
    description: input.description ?? "",
    ownerId: input.ownerId,
    memberIds: [input.ownerId],
    archived: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

import type { Blueprint } from "../types";

// Sample blueprint drawn directly from PLAN.md's running example (§3, §8, §15).
//
//        API
//         ├── AuthRouter ── AuthService ──┬── TokenService   (NEW)
//         │        └────────(bypass)──────┤   (⚠ layer violation)
//         │                               └── UserRepository ── UserModel ── PostgreSQL
//         └── UserRouter ── UserService ───── UserRepository
//
// `current` is the state after an agent added TokenService and rewired AuthService.
// `previous` is the prior snapshot, used for before/after mode and the change set.

export const current: Blueprint = {
  nodes: [
    {
      id: "api",
      type: "API Endpoint",
      name: "API",
      path: "src/api/__init__.py",
      language: "python",
      description: "HTTP surface exposing the auth and user routers.",
      signature: "api@2",
    },
    {
      id: "authRouter",
      type: "API Endpoint",
      name: "AuthRouter",
      path: "src/api/auth_router.py",
      language: "python",
      description: "Routes login, refresh, and logout requests.",
      signature: "authRouter@2",
    },
    {
      id: "userRouter",
      type: "API Endpoint",
      name: "UserRouter",
      path: "src/api/user_router.py",
      language: "python",
      description: "Routes user profile CRUD requests.",
      signature: "userRouter@1",
    },
    {
      id: "authService",
      type: "Service",
      name: "AuthService",
      path: "src/services/auth_service.py",
      language: "python",
      description: "Validates credentials and orchestrates the token lifecycle.",
      signature: "authService@2",
    },
    {
      id: "userService",
      type: "Service",
      name: "UserService",
      path: "src/services/user_service.py",
      language: "python",
      description: "Reads and updates user profiles.",
      signature: "userService@1",
    },
    {
      id: "tokenService",
      type: "Service",
      name: "TokenService",
      path: "src/services/token_service.py",
      language: "python",
      description: "Issues and refreshes access tokens.",
      signature: "tokenService@1",
    },
    {
      id: "userRepository",
      type: "Repository Layer",
      name: "UserRepository",
      path: "src/repositories/user_repository.py",
      language: "python",
      description: "Persists and queries user records.",
      signature: "userRepository@1",
    },
    {
      id: "userModel",
      type: "Database Model",
      name: "UserModel",
      path: "src/models/user.py",
      language: "python",
      description: "ORM model for the users table.",
      signature: "userModel@1",
    },
    {
      id: "postgres",
      type: "External Dependency",
      name: "PostgreSQL",
      path: "-",
      language: "sql",
      description: "Primary relational datastore.",
      signature: "postgres@1",
    },
  ],
  edges: [
    { source: "api", target: "authRouter", relationship: "exposes" },
    { source: "api", target: "userRouter", relationship: "exposes" },
    { source: "authRouter", target: "authService", relationship: "calls" },
    { source: "userRouter", target: "userService", relationship: "calls" },
    { source: "authService", target: "tokenService", relationship: "depends_on" },
    { source: "authService", target: "userRepository", relationship: "depends_on" },
    { source: "userService", target: "userRepository", relationship: "depends_on" },
    { source: "userRepository", target: "userModel", relationship: "reads" },
    { source: "userModel", target: "postgres", relationship: "writes" },
    // Layer violation: an API Endpoint reaching straight into the Repository Layer,
    // skipping the Service layer. Surfaces as the single architecture warning.
    { source: "authRouter", target: "userRepository", relationship: "depends_on" },
  ],
};

export const previous: Blueprint = {
  nodes: current.nodes
    // TokenService did not exist in the prior snapshot.
    .filter((n) => n.id !== "tokenService")
    .map((n) =>
      // AuthService and AuthRouter were rewired by the agent -> older signatures.
      n.id === "authService"
        ? { ...n, signature: "authService@1" }
        : n.id === "authRouter"
          ? { ...n, signature: "authRouter@1" }
          : n,
    ),
  edges: current.edges.filter(
    (e) =>
      // The AuthService -> TokenService dependency was introduced with TokenService.
      !(e.source === "authService" && e.target === "tokenService"),
  ),
};

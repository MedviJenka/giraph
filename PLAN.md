# Project Blueprint — Development Plan

## 1. Vision

Build an **agent-aware codebase mapping system** that automatically explains the structure of a software project and tracks how AI coding agents change that structure over time.

The system should answer four questions immediately:

1. **What exists in this project?**
2. **How are the components connected?**
3. **What did the coding agent just change?**
4. **How did those changes affect the architecture?**

The goal is not to create another file-tree viewer.

The goal is to create a **living architectural blueprint of the repository**.

---

# 2. Problem

Modern coding agents can create and modify large amounts of code extremely quickly.

A single task may result in:

- New directories
- New modules
- New classes
- New functions
- New APIs
- New dependencies
- Modified interfaces
- Deleted components
- New architectural relationships

The developer often sees only:

```text
12 files changed
428 insertions
73 deletions
```

Git accurately describes the textual changes, but it does not explain the **architectural meaning** of those changes.

As agent-generated code increases, developers need a higher-level representation of the codebase.

---

# 3. Core Concept

The system maintains a graph representation of the repository.

Example:

```text
API
 │
 ├── AuthRouter
 │      │
 │      ▼
 │   AuthService
 │      │
 │      ▼
 │   UserRepository
 │      │
 │      ▼
 │   PostgreSQL
 │
 └── UserRouter
        │
        ▼
     UserService
```

Every node represents a meaningful software component.

Possible node types:

```text
Repository
Directory
File
Module
Class
Function
API Endpoint
Service
Repository Layer
Database Model
Agent
External Dependency
```

Edges represent relationships such as:

```text
imports
calls
inherits
implements
depends_on
creates
reads
writes
exposes
```

---

# 4. Main Features

## 4.1 Repository Scanner

Scan the project directory and generate a structured representation.

Initial languages:

- Python
- TypeScript
- JavaScript

Future:

- Go
- Rust
- Java
- C#
- C++

The scanner should identify:

- Files
- Modules
- Classes
- Functions
- Imports
- Function calls
- API endpoints
- Models
- Dependencies

---

# 5. AST Analysis

Do not rely primarily on LLMs to understand code structure.

Use deterministic parsing whenever possible.

Possible technologies:

```text
Tree-sitter
Python ast
TypeScript Compiler API
Language Server Protocol
```

AST analysis should generate normalized entities.

Example:

```json
{
  "type": "function",
  "name": "authenticate_user",
  "file": "src/services/auth_service.py",
  "line": 42
}
```

---

# 6. Dependency Graph

Convert parsed entities into a graph.

Example:

```text
auth_router.py
      │
      ▼
AuthService
      │
      ▼
UserRepository
      │
      ▼
UserModel
```

Graph node:

```text
Node
├── id
├── type
├── name
├── path
├── language
├── metadata
└── description
```

Graph edge:

```text
Edge
├── source
├── target
├── relationship
└── metadata
```

Possible graph implementations:

### MVP

NetworkX

### Larger repositories

Neo4j or another graph database.

---

# 7. Semantic Layer

AST tells us:

```text
AuthService.authenticate()
```

But developers also want:

> AuthService handles authentication and token generation.

Use an LLM to generate semantic descriptions for important components.

Example:

```text
Component:
AuthService

Purpose:
Handles user authentication and token lifecycle.

Responsibilities:
- Validate credentials
- Generate access tokens
- Refresh authentication tokens

Dependencies:
- UserRepository
- TokenService
```

Cache these descriptions and regenerate them only when relevant code changes.

---

# 8. Architecture Map

Generate a readable architecture view.

Example:

```text
Frontend
   │
   ▼
API
   │
   ├───────────────┐
   ▼               ▼
AuthService     UserService
   │               │
   ▼               ▼
TokenService    UserRepository
   │               │
   └───────┬───────┘
           ▼
        Database
```

The UI should support multiple zoom levels.

### Level 1 — System

```text
Frontend
Backend
Database
External Services
```

### Level 2 — Modules

```text
API
Services
Repositories
Models
Agents
```

### Level 3 — Files

```text
auth_service.py
user_service.py
token_service.py
```

### Level 4 — Code

```text
classes
functions
methods
```

---

# 9. Agent Change Tracking

This is a key differentiator.

When an AI agent finishes a task, compare:

```text
Graph BEFORE
      vs
Graph AFTER
```

Generate an architectural diff.

Example:

```text
AGENT CHANGESET

Created:

+ TokenService
+ RefreshTokenModel

Modified:

~ AuthService
~ AuthRouter

Removed:

- LegacyTokenHandler
```

Architecture impact:

```text
BEFORE

AuthRouter
    │
    ▼
AuthService


AFTER

AuthRouter
    │
    ▼
AuthService
    │
    ▼
TokenService
    │
    ▼
RefreshTokenRepository
```

---

# 10. Git Integration

Git should provide the change boundary.

Useful commands:

```text
git diff
git status
git log
git show
```

Each commit can generate an architecture snapshot.

Conceptually:

```text
Commit A
   │
   ▼
Architecture Graph A

Commit B
   │
   ▼
Architecture Graph B
```

Then:

```text
GraphDiff(A, B)
```

produces the architectural change report.

---

# 11. Architecture Rules

Allow developers to define architectural constraints.

Example:

```yaml
rules:

  - name: routes-cannot-access-database
    from: routes
    disallow:
      - database

  - name: services-use-repositories
    from: services
    allow:
      - repositories

  - name: repositories-access-database
    from: repositories
    allow:
      - database
```

If an agent creates:

```text
AuthRoute
    │
    ▼
Database
```

the system should report:

```text
⚠ Architecture violation

AuthRoute directly accesses Database.

Expected:

Route
  ↓
Service
  ↓
Repository
  ↓
Database
```

---

# 12. Agent Integration

The blueprint should also be readable by coding agents.

Generate:

```text
.blueprint/
```

Example:

```text
.blueprint/
├── graph.json
├── architecture.md
├── modules.json
├── dependencies.json
├── rules.yaml
└── history/
```

An agent can read:

```text
.blueprint/architecture.md
```

before modifying the repository.

This gives the agent architectural context before it starts writing code.

---

# 13. Agent Instructions

Projects can include instructions such as:

```text
Before modifying the repository:

1. Read .blueprint/architecture.md
2. Respect .blueprint/rules.yaml
3. Do not introduce forbidden dependencies.
4. After completing the task, regenerate the blueprint.
```

This creates a feedback loop:

```text
Developer
    │
    ▼
AI Agent
    │
    ▼
Reads Blueprint
    │
    ▼
Changes Code
    │
    ▼
Blueprint Scanner
    │
    ▼
Architecture Diff
    │
    ▼
Developer Review
```

---

# 14. CLI

Initial interface:

```bash
blueprint init
```

Initialize project configuration.

```bash
blueprint scan
```

Analyze repository.

```bash
blueprint map
```

Open architecture map.

```bash
blueprint diff
```

Show architectural changes.

```bash
blueprint explain src/services/auth_service.py
```

Explain the role of a component.

```bash
blueprint check
```

Check architecture rules.

```bash
blueprint history
```

Show architecture evolution.

---

# 15. Dashboard

Future web UI.

Main screen:

```text
┌─────────────────────────────────────────────────┐
│ Project Blueprint                               │
├─────────────────────────────────────────────────┤
│                                                 │
│                 API                             │
│                  │                              │
│          ┌───────┴───────┐                     │
│          ▼               ▼                     │
│     AuthService      UserService                │
│          │               │                     │
│          ▼               ▼                     │
│     TokenService     UserRepository             │
│          │               │                     │
│          └───────┬───────┘                     │
│                  ▼                              │
│               Database                          │
│                                                 │
├─────────────────────────────────────────────────┤
│ Latest Agent Changes                            │
│                                                 │
│ + TokenService                                  │
│ ~ AuthService                                   │
│ ~ AuthRouter                                    │
│                                                 │
│ ⚠ 1 architecture warning                       │
└─────────────────────────────────────────────────┘
```

---

# 16. Recommended Architecture

```text
blueprint/
│
├── cli/
│
├── scanner/
│   ├── filesystem.py
│   ├── parser.py
│   └── languages/
│       ├── python.py
│       ├── typescript.py
│       └── javascript.py
│
├── graph/
│   ├── builder.py
│   ├── models.py
│   └── diff.py
│
├── git/
│   ├── repository.py
│   └── changes.py
│
├── architecture/
│   ├── detector.py
│   ├── rules.py
│   └── violations.py
│
├── semantic/
│   ├── analyzer.py
│   └── descriptions.py
│
├── exporters/
│   ├── json.py
│   ├── markdown.py
│   └── html.py
│
└── config/
    └── settings.py
```

---

# 17. Suggested Python Stack

Core:

```text
Python 3.12+
Pydantic
Tree-sitter
NetworkX
GitPython
Typer
Rich
```

Visualization:

```text
React
React Flow
D3.js
```

Optional backend:

```text
FastAPI
```

Large graph storage:

```text
Neo4j
```

---

# 18. MVP

Avoid building the full platform initially.

The first useful version should do only:

```text
Repository
     │
     ▼
Scan Python project
     │
     ▼
Extract files/imports/classes/functions
     │
     ▼
Build dependency graph
     │
     ▼
Compare against Git
     │
     ▼
Generate architecture.md
```

Example output:

```text
# Architecture

## API

src/api/auth.py

Depends on:

- AuthService


## Services

src/services/auth_service.py

Depends on:

- UserRepository
- TokenService


## Repositories

src/repositories/user_repository.py

Depends on:

- UserModel
```

This alone would already be useful to both developers and agents.

---

# 19. MVP Phases

## Phase 1 — Repository Scanner

Implement:

- Recursive file discovery
- Ignore `.gitignore`
- Language detection
- Python AST parsing

Output:

```text
project.json
```

---

## Phase 2 — Dependency Graph

Extract:

```text
imports
classes
functions
function calls
```

Build graph using NetworkX.

Output:

```text
graph.json
```

---

## Phase 3 — Blueprint Generator

Generate:

```text
.blueprint/architecture.md
```

containing:

- Project overview
- Modules
- Files
- Important classes
- Important functions
- Dependencies

---

## Phase 4 — Git Diff

Compare current repository against the previous blueprint.

Generate:

```text
.blueprint/latest_changes.md
```

Example:

```text
Added:
+ TokenService

Modified:
~ AuthService

Removed:
- LegacyAuthService
```

---

## Phase 5 — Architecture Diff

Compare graph snapshots.

Detect:

```text
new nodes
removed nodes
new dependencies
removed dependencies
```

Generate:

```text
Architecture Impact
```

rather than only textual diffs.

---

## Phase 6 — Architecture Rules

Implement:

```text
.blueprint/rules.yaml
```

Detect architectural violations automatically.

---

## Phase 7 — Interactive UI

Create a React Flow visualization.

Features:

- Zoom
- Search
- Module grouping
- File inspection
- Dependency highlighting
- Before/after mode
- Architecture warnings

---

# 20. Long-Term Feature — Architecture Timeline

Store architecture snapshots per commit.

Example:

```text
v1
│
├── API
├── Services
└── Database


v2
│
├── API
├── Services
├── Repository Layer
└── Database


v3
│
├── API
├── Services
├── Agent Layer
├── Repository Layer
└── Database
```

Developers could visually inspect how the system evolved over time.

---

# 21. Long-Term Feature — Agent Accountability

Track which agent introduced each architectural change.

Example:

```text
TokenService

Created by:
Claude Code

Task:
"Add refresh-token support"

Commit:
a82fc91

Created:
2026-08-30

Dependencies introduced:

TokenService
    ↓
RefreshTokenRepository
```

This turns the blueprint into an **audit trail for AI-generated software**.

---

# 22. Long-Term Feature — Impact Analysis

Before changing a component:

```bash
blueprint impact AuthService
```

Output:

```text
AuthService

Direct dependents:
- AuthRouter
- AdminRouter

Indirect dependents:
- LoginFlow
- SessionManager

Database dependencies:
- UserRepository

Risk:
MEDIUM

Potentially affected files:
8
```

This could also be exposed directly to coding agents before they modify a component.

---

# 23. Core Design Principle

The system should distinguish between:

```text
Physical Structure
```

and:

```text
Logical Architecture
```

Physical structure:

```text
src/
├── api/
├── services/
├── models/
└── utils/
```

Logical architecture:

```text
Authentication
├── AuthRouter
├── AuthService
├── TokenService
└── UserRepository
```

Developers usually care more about the second representation.

---

# 24. Product Positioning

Do not position the product as:

> A visual file explorer.

Position it as:

> **A living architectural blueprint for AI-generated codebases.**

Or:

> **See what your coding agents are building.**

The core differentiator is not visualization.

It is:

```text
Code
  +
Git History
  +
Architecture Graph
  +
Agent Changes
  +
Architecture Rules
  =
Project Blueprint
```

---

# 25. Success Criteria

The MVP is successful when a developer can enter an unfamiliar repository and within approximately one minute understand:

- What the major components are
- Where they live
- How they communicate
- Which components depend on which
- What changed recently
- What an AI agent added
- Whether the change violated the intended architecture

The system should reduce the need to manually inspect dozens of files after an AI coding agent completes a task.

---

# 26. First Milestone

Build the following end-to-end flow:

```text
blueprint scan
        │
        ▼
Python AST Parser
        │
        ▼
Dependency Graph
        │
        ▼
graph.json
        │
        ▼
architecture.md
```

Then add:

```text
Git Commit A
      │
      ▼
Graph A

Git Commit B
      │
      ▼
Graph B

      │
      ▼
Architecture Diff
```

Only after this works reliably should visualization, LLM semantic analysis, IDE integration, and multi-language support be added.

---

# 27. North Star

Every time a coding agent finishes working, the developer should be able to open one view and immediately understand:

> **What did the agent build, where did it put it, how does it connect to the rest of my system, and did it make architectural sense?**
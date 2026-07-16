# TaskFlow Architecture and Design

## System overview

TaskFlow uses a three-tier architecture:

1. Next.js presentation layer
2. Express REST API and authorization layer
3. PostgreSQL persistence layer

```mermaid
flowchart LR
    U[Browser User] --> W[Next.js Frontend]
    W -->|REST API with credentials| A[Express API]
    A --> M[Authentication and RBAC Middleware]
    M --> R[Route Handlers]
    R --> D[(PostgreSQL)]
```

## Frontend architecture

The frontend uses the Next.js App Router.

Main pages:

- `/login`
- `/dashboard`
- `/users`
- `/projects`
- `/tasks`

The authentication provider stores the authenticated user and communicates with:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Protected pages redirect unauthenticated users to `/login`.

## Backend architecture

The Express backend is divided into:

```text
src/
├── database/
├── lib/
├── middleware/
├── routes/
├── tests/
└── server.ts
```

### Route modules

- `auth.routes.ts`
- `user.routes.ts`
- `project.routes.ts`
- `task.routes.ts`

### Shared modules

- `db.ts` manages the PostgreSQL connection pool
- `auth.ts` creates and verifies authentication tokens
- `auth.middleware.ts` authenticates requests and checks roles

## Authentication flow

```mermaid
sequenceDiagram
    participant User
    participant Web as Next.js
    participant API as Express API
    participant DB as PostgreSQL

    User->>Web: Submit email and password
    Web->>API: POST /api/auth/login
    API->>DB: Find active user
    DB-->>API: User and password hash
    API->>API: Verify password and create JWT
    API-->>Web: HTTP-only cookie and user data
    Web-->>User: Open dashboard
```

## Authorization rules

```mermaid
flowchart TD
    Request[Protected API Request] --> Auth{Valid token?}
    Auth -- No --> Unauthorized[401 Unauthorized]
    Auth -- Yes --> Role{Role allowed?}
    Role -- No --> Forbidden[403 Forbidden]
    Role -- Yes --> Handler[Execute route handler]
    Handler --> Database[(PostgreSQL)]
```

## Database entities

### Users

Stores user identity, hashed passwords, roles, and account status.

### Projects

Stores project information and references its manager.

### Project members

Implements the many-to-many relationship between projects and Team Members.

### Tasks

Stores project tasks, assignees, creators, priority, status, progress, and dates.

### Task comments

Stores comments connected to tasks and their authors.

```mermaid
erDiagram
    USERS {
        uuid id PK
        string name
        string email
        string password_hash
        user_role role
        user_status status
    }

    PROJECTS {
        uuid id PK
        uuid manager_id FK
        string name
        text description
        project_status status
        date start_date
        date due_date
    }

    PROJECT_MEMBERS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
    }

    TASKS {
        uuid id PK
        uuid project_id FK
        uuid assignee_id FK
        uuid created_by FK
        string title
        task_status status
        task_priority priority
        integer progress
    }

    TASK_COMMENTS {
        uuid id PK
        uuid task_id FK
        uuid user_id FK
        text content
    }

    USERS ||--o{ PROJECTS : manages
    USERS ||--o{ PROJECT_MEMBERS : belongs_to
    PROJECTS ||--o{ PROJECT_MEMBERS : has
    PROJECTS ||--o{ TASKS : contains
    USERS ||--o{ TASKS : assigned
    USERS ||--o{ TASKS : creates
    TASKS ||--o{ TASK_COMMENTS : contains
    USERS ||--o{ TASK_COMMENTS : writes
```

## Validation

Zod schemas validate incoming API request bodies.

Validation includes:

- Email format
- Password requirements
- Allowed role and status values
- UUID parameters
- Progress between 0 and 100
- Date ordering
- Required project and assignee relationships

Database constraints provide a second validation layer.

## Continuous integration architecture

```mermaid
flowchart LR
    Push[Push or Pull Request] --> Actions[GitHub Actions]
    Actions --> B[Backend Job]
    Actions --> F[Frontend Job]
    B --> P[(PostgreSQL Service)]
    B --> T[Vitest Tests]
    B --> BB[TypeScript Build]
    F --> FB[Next.js Production Build]
```

## Design decisions

### PostgreSQL

PostgreSQL supports relational integrity, UUID identifiers, enums, foreign keys, and transactional operations.

### REST API

REST endpoints provide a clear separation between the frontend and backend and can also be tested independently.

### Role-based access control

Authorization is enforced by the backend rather than relying only on hidden frontend controls.

### HTTP-only cookies

The authentication token is unavailable to normal browser JavaScript, reducing exposure to token theft through client-side scripts.

### Feature-branch workflow

Each major capability is developed and reviewed independently before being merged into `main`.
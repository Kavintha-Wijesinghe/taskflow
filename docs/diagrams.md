# TaskFlow System Diagrams

This document contains the main architectural, database, use-case, and workflow diagrams for TaskFlow.

GitHub renders these diagrams automatically using Mermaid.

## 1. System architecture

```mermaid
flowchart LR
    Browser[User Web Browser]

    subgraph Frontend
        NextJS[Next.js Frontend]
        AuthProvider[Authentication Provider]
        Pages[Login, Dashboard, Users, Projects and Tasks Pages]
    end

    subgraph Backend
        Express[Express REST API]
        Security[Helmet, CORS and Rate Limiting]
        Routes[Auth, User, Project and Task Routes]
        PublicRoutes[Public Authentication Routes]
        ProtectedRoutes[Protected API Routes]
        Auth[JWT Authentication Middleware]
        RBAC[Role-Based Authorization]
        Validation[Zod Request Validation]
    end

    Database[(PostgreSQL Database)]

    Browser --> NextJS
    NextJS --> AuthProvider
    AuthProvider --> Pages
    Pages -->|HTTP requests with credentials| Express

    Express --> Security
    Security --> Routes
    Routes --> PublicRoutes
    Routes --> ProtectedRoutes
    PublicRoutes --> Validation
    ProtectedRoutes --> Auth
    Auth --> RBAC
    RBAC --> Validation
    Validation -->|Parameterized SQL queries| Database
```

## 2. Development and continuous-integration architecture

```mermaid
flowchart TB
    Developer[Developer]

    subgraph LocalEnvironment[Local Development Environment]
        VSCode[Visual Studio Code]
        Git[Git]
        Frontend[Next.js Development Server :3000]
        Backend[Express Development Server :4000]
        Docker[Docker Compose]
        PostgreSQL[(PostgreSQL :5432)]
    end

    subgraph GitHubEnvironment[GitHub]
        Repository[TaskFlow Repository]
        PullRequests[Pull Requests]
        Actions[GitHub Actions CI]
    end

    Developer --> VSCode
    VSCode --> Git
    VSCode --> Frontend
    VSCode --> Backend

    Backend --> PostgreSQL
    Docker --> PostgreSQL
    Frontend --> Backend

    Git --> Repository
    Repository --> PullRequests
    PullRequests --> Actions

    Actions --> BackendChecks[Backend Tests and Build]
    Actions --> FrontendChecks[Frontend Lint and Production Build]
    Actions --> TestDatabase[(PostgreSQL Service Container)]
    BackendChecks --> TestDatabase
```

## 3. Entity relationship diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar name
        varchar email UK
        varchar password_hash
        user_role role
        user_status status
        timestamp created_at
        timestamp updated_at
    }

    PROJECTS {
        uuid id PK
        varchar name
        text description
        project_status status
        date start_date
        date due_date
        uuid manager_id FK
        timestamp created_at
        timestamp updated_at
    }

    PROJECT_MEMBERS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        timestamp joined_at
    }

    TASKS {
        uuid id PK
        uuid project_id FK
        uuid assignee_id FK
        uuid created_by FK
        varchar title
        text description
        task_status status
        task_priority priority
        integer progress
        date start_date
        date due_date
        timestamp created_at
        timestamp updated_at
    }

    TASK_COMMENTS {
        uuid id PK
        uuid task_id FK
        uuid user_id FK
        text content
        timestamp created_at
        timestamp updated_at
    }

    USERS ||--o{ PROJECTS : manages
    USERS ||--o{ PROJECT_MEMBERS : joins
    PROJECTS ||--o{ PROJECT_MEMBERS : contains
    PROJECTS ||--o{ TASKS : contains
    USERS ||--o{ TASKS : assigned_to
    USERS ||--o{ TASKS : creates
    TASKS ||--o{ TASK_COMMENTS : contains
    USERS ||--o{ TASK_COMMENTS : writes
```

## 4. Role-based use-case diagram

```mermaid
flowchart LR
    Admin[Administrator]
    Manager[Project Manager]
    Member[Team Member]

    Login((Log in and log out))
    Dashboard((View dashboard))
    ViewProjects((View accessible projects))
    CreateProjects((Create projects))
    UpdateProjects((Update project status))
    AssignMembers((Assign Team Members))
    ViewTasks((View accessible tasks))
    CreateTasks((Create and assign tasks))
    UpdateTasks((Update task status and progress))
    CommentTasks((Add task comments))
    ManageUsers((Create and manage users))

    Admin --> Login
    Admin --> Dashboard
    Admin --> ManageUsers
    Admin --> ViewProjects
    Admin --> CreateProjects
    Admin --> UpdateProjects
    Admin --> AssignMembers
    Admin --> ViewTasks
    Admin --> CreateTasks
    Admin --> UpdateTasks
    Admin --> CommentTasks

    Manager --> Login
    Manager --> Dashboard
    Manager --> ViewProjects
    Manager --> CreateProjects
    Manager --> UpdateProjects
    Manager --> AssignMembers
    Manager --> ViewTasks
    Manager --> CreateTasks
    Manager --> UpdateTasks
    Manager --> CommentTasks

    Member --> Login
    Member --> Dashboard
    Member --> ViewProjects
    Member --> ViewTasks
    Member --> UpdateTasks
    Member --> CommentTasks
```

## 5. Authentication sequence

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Next.js Frontend
    participant API as Express API
    participant DB as PostgreSQL

    User->>Frontend: Enter email and password
    Frontend->>API: POST /api/auth/login
    API->>DB: Find active user by email
    DB-->>API: User record and password hash
    API->>API: Compare password using bcrypt

    alt Credentials are valid
        API->>API: Create signed JWT
        API-->>Frontend: Set HTTP-only cookie and return user
        Frontend->>Frontend: Store authenticated user state
        Frontend-->>User: Redirect to dashboard
    else Credentials are invalid
        API-->>Frontend: Return 401 error
        Frontend-->>User: Display login error
    end
```

## 6. Protected API request sequence

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Next.js Frontend
    participant API as Express Route Handler
    participant Auth as Authentication Middleware
    participant RBAC as Authorization Middleware
    participant Validation as Zod Validation
    participant DB as PostgreSQL

    User->>Frontend: Perform protected action
    Frontend->>API: API request with cookie or bearer token
    API->>Auth: Validate JWT

    alt Token is missing or invalid
        Auth-->>Frontend: 401 Unauthorized
    else Token is valid
        Auth->>RBAC: Check required role or resource access

        alt Access is not permitted
            RBAC-->>Frontend: 403 Forbidden
        else Access is permitted
            RBAC->>Validation: Validate request data

            alt Request data is invalid
                Validation-->>Frontend: 400 Validation error
            else Request data is valid
                Validation->>DB: Execute parameterized SQL query
                DB-->>Validation: Query result
                Validation-->>Frontend: Successful JSON response
                Frontend-->>User: Update interface
            end
        end
    end
```

## 7. Project creation workflow

```mermaid
sequenceDiagram
    actor User as Administrator or Project Manager
    participant Frontend as Projects Page
    participant API as Project API
    participant Auth as Auth and RBAC Middleware
    participant DB as PostgreSQL

    User->>Frontend: Complete project form
    Frontend->>API: POST /api/projects
    API->>Auth: Authenticate and authorize

    alt User is unauthorized
        Auth-->>Frontend: 401 or 403 response
    else User is authorized
        API->>API: Validate fields with Zod
        API->>DB: Validate project manager
        DB-->>API: Manager result
        API->>DB: Insert project
        DB-->>API: Created project
        API-->>Frontend: Project created
        Frontend->>API: GET /api/projects
        API-->>Frontend: Refreshed project list
        Frontend-->>User: Show success message and project card
    end
```

## 8. Task creation workflow

```mermaid
sequenceDiagram
    actor User as Administrator or Project Manager
    participant Frontend as Tasks Page
    participant API as Task API
    participant DB as PostgreSQL

    User->>Frontend: Complete task form
    Frontend->>API: POST /api/tasks
    API->>API: Authenticate, authorize and validate
    API->>DB: Validate project access
    DB-->>API: Project result
    API->>DB: Confirm assignee is an active project member

    alt Assignee is not assigned to project
        API-->>Frontend: Return validation error
        Frontend-->>User: Display error message
    else Assignee is valid
        API->>DB: Insert task
        DB-->>API: Created task
        API-->>Frontend: Task created successfully
        Frontend->>API: GET /api/tasks
        API-->>Frontend: Refreshed task list
        Frontend-->>User: Display new task card
    end
```

## 9. Git and pull-request workflow

```mermaid
gitGraph
    commit id: "Initialize repository"
    branch feature
    checkout feature
    commit id: "Implement feature"
    commit id: "Test and verify"
    checkout main
    merge feature id: "Merge pull request"
    branch next-feature
    checkout next-feature
    commit id: "Implement next feature"
    commit id: "Run tests and builds"
    checkout main
    merge next-feature id: "Merge reviewed changes"
```

## 10. Continuous integration workflow

```mermaid
flowchart TD
    Event[Push to main or Pull Request to main]
    Checkout[Check out repository]

    Event --> Checkout

    Checkout --> BackendJob
    Checkout --> FrontendJob

    subgraph BackendJob[Backend tests and build]
        StartPostgres[Start PostgreSQL service]
        PinNpm[Install compatible npm version]
        InstallBackend[Run npm ci]
        InitializeDB[Initialize database schema]
        RunTests[Run Vitest tests]
        BuildBackend[Compile TypeScript]

        StartPostgres --> PinNpm
        PinNpm --> InstallBackend
        InstallBackend --> InitializeDB
        InitializeDB --> RunTests
        RunTests --> BuildBackend
    end

    subgraph FrontendJob[Frontend lint and build]
        InstallFrontend[Run npm ci]
        LintFrontend[Run ESLint]
        BuildFrontend[Run Next.js production build]

        InstallFrontend --> LintFrontend
        LintFrontend --> BuildFrontend
    end

    BuildBackend --> BackendResult{Backend job passed?}
    BuildFrontend --> FrontendResult{Frontend job passed?}

    BackendResult --> Gate{Did both jobs pass?}
    FrontendResult --> Gate

    Gate -->|Yes| Success[CI passes]
    Gate -->|No| Failure[CI fails]
```
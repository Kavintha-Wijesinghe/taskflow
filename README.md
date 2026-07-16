# TaskFlow — Project and Team Task Management Platform

TaskFlow is a full-stack web application for managing projects, project teams, tasks, progress, and user access. It was developed as a full-stack internship assignment using Next.js, Node.js, Express, TypeScript, PostgreSQL, Docker, and GitHub Actions.

## Features

### Authentication and security

- Secure email and password login
- Password hashing with bcrypt
- JSON Web Token authentication
- HTTP-only authentication cookies
- Role-based access control
- Request validation with Zod
- Security headers with Helmet
- Authentication rate limiting
- Protected frontend routes and backend endpoints

### User management

Administrators can:

- View system users
- Create new users
- Assign Administrator, Project Manager, or Team Member roles
- Manage account access and user status

### Project management

Administrators and Project Managers can:

- Create projects
- Set project dates and status
- Assign Project Managers
- Assign Team Members
- Update project status

Project visibility is role-based:

- Administrators can view every project
- Project Managers can view projects they manage
- Team Members can view projects assigned to them

### Task management

Administrators and Project Managers can:

- Create tasks
- Select a project
- Assign tasks to project Team Members
- Set priority, status, progress, and dates

Authorized users can:

- View tasks available to their role
- Update task status and progress
- Add task comments
- Monitor progress using visual indicators

## Technology stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Next.js App Router

### Backend

- Node.js
- Express
- TypeScript
- Zod
- JSON Web Token
- bcrypt
- Helmet
- express-rate-limit

### Database

- PostgreSQL
- `pg` PostgreSQL client
- Docker Compose for local database development

### Testing and delivery

- Vitest
- Supertest
- Git and GitHub
- GitHub Actions continuous integration

## Project structure

```text
taskflow/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
├── server/
│   ├── database/
│   │   └── schema.sql
│   ├── src/
│   │   ├── database/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── tests/
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── vitest.config.ts
├── web/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── projects/
│   │   ├── tasks/
│   │   └── users/
│   ├── components/
│   ├── lib/
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
└── README.md
```

## User roles

| Role | Permissions |
|---|---|
| Administrator | Manage users, view all projects and tasks, create projects and tasks, assign managers and members |
| Project Manager | Manage assigned projects, assign Team Members, create tasks, update project and task progress |
| Team Member | View assigned projects and tasks, update task progress, add comments |

## Database relationships

- One user can manage many projects
- Projects and Team Members have a many-to-many relationship
- One project can contain many tasks
- One Team Member can be assigned many tasks
- One task can contain many comments
- Every task comment belongs to a user and a task

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : manages
    USERS ||--o{ PROJECT_MEMBERS : joins
    PROJECTS ||--o{ PROJECT_MEMBERS : contains
    PROJECTS ||--o{ TASKS : contains
    USERS ||--o{ TASKS : assigned_to
    USERS ||--o{ TASKS : creates
    TASKS ||--o{ TASK_COMMENTS : contains
    USERS ||--o{ TASK_COMMENTS : writes
```

## Prerequisites

Install the following software:

- Node.js 22 or later
- npm
- Docker Desktop
- Git

## Environment configuration

### Backend

Copy the example backend environment file:

```powershell
Copy-Item server\.env.example server\.env
```

Required backend variables:

```env
PORT=4000
DATABASE_URL=postgresql://taskflow:taskflow_password@localhost:5432/taskflow
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
COOKIE_SECURE=false
```

Use a long, unpredictable `JWT_SECRET` outside local development.

### Frontend

Copy the example frontend environment file:

```powershell
Copy-Item web\.env.example web\.env.local
```

Frontend variable:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Local installation

### 1. Clone the repository

```powershell
git clone https://github.com/Kavintha-Wijesinghe/taskflow.git
cd taskflow
```

### 2. Start PostgreSQL

```powershell
docker compose up -d postgres
```

### 3. Install backend dependencies

```powershell
cd server
npm install
```

### 4. Initialize and seed the database

```powershell
npm run db:init
npm run db:seed
```

### 5. Start the backend

```powershell
npm run dev
```

The API runs at:

```text
http://localhost:4000
```

### 6. Install and start the frontend

Open another PowerShell window:

```powershell
cd web
npm install
npm run dev
```

The web application runs at:

```text
http://localhost:3000
```

## Demo accounts

The seed command creates these accounts:

| Role | Email | Password |
|---|---|---|
| Administrator | admin@taskflow.dev | Password@123 |
| Project Manager | manager@taskflow.dev | Password@123 |
| Team Member | member@taskflow.dev | Password@123 |

These credentials are intended only for local demonstration.

## API overview

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Authenticate a user |
| POST | `/api/auth/logout` | Clear the authentication session |
| GET | `/api/auth/me` | Return the authenticated user |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List users as an Administrator |
| POST | `/api/users` | Create a user |
| PATCH | `/api/users/:id` | Update user role or account status |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects` | List role-accessible projects |
| POST | `/api/projects` | Create a project |
| PATCH | `/api/projects/:projectId` | Update a project |
| GET | `/api/projects/team-members` | List active Team Members |
| POST | `/api/projects/:projectId/members` | Assign a Team Member |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | List role-accessible tasks |
| POST | `/api/tasks` | Create and assign a task |
| PATCH | `/api/tasks/:taskId/progress` | Update status and progress |
| POST | `/api/tasks/:taskId/comments` | Add a task comment |

## Available commands

### Backend

```powershell
npm run dev
npm run build
npm start
npm run db:init
npm run db:seed
npm test
npm run test:watch
```

### Frontend

```powershell
npm run dev
npm run build
npm start
npm run lint
```

## Automated testing

The backend includes Vitest tests for authentication-token utilities:

- Token generation for all three roles
- Token verification
- Invalid token signatures
- Verification using a different secret
- Missing JWT secret handling

Run the tests:

```powershell
cd server
npm test
```

Current automated test result:

```text
7 tests passed
```

## Continuous integration

The GitHub Actions workflow runs for pushes and Pull Requests targeting `main`.

The workflow performs:

- Backend dependency installation
- PostgreSQL service startup
- Database schema initialization
- Backend automated tests
- Backend TypeScript build
- Frontend production build

Workflow file:

```text
.github/workflows/ci.yml
```

## Git workflow

Development uses feature branches and Pull Requests:

```text
feature/backend-foundation
feature/database-foundation
feature/authentication-rbac
feature/user-management
feature/project-management
feature/task-management
feature/frontend-authentication
feature/frontend-user-management
feature/frontend-project-management
feature/frontend-task-management
feature/automated-testing
feature/continuous-integration
feature/project-documentation
```

Each feature is developed, tested, committed, pushed, reviewed through a Pull Request, and merged into `main`.

## Security notes

- Passwords are never stored as plain text
- Authentication tokens are signed using a server-side secret
- Authentication cookies are HTTP-only
- Protected API endpoints validate authentication and role permissions
- SQL queries use parameterized values
- Incoming API data is validated before database operations
- Login attempts are rate-limited
- Helmet adds common HTTP security headers
- Environment files containing secrets are excluded from Git

## Additional documentation

- [Architecture and design](docs/architecture.md)
- API collection and detailed endpoint documentation will be stored in `docs/`

## AI assistance disclosure

AI tools were used as a development assistant for explanations, troubleshooting, code review, and documentation support. The project was implemented and tested through a structured Git feature-branch workflow, with functionality manually verified and automated checks executed before integration.

## Author

**Kavintha Wijesinghe**

GitHub repository: `Kavintha-Wijesinghe/taskflow`
# TaskFlow REST API Documentation

## Server and API URLs

Local backend server:

```text
http://localhost:4000
```

API base URL:

```text
http://localhost:4000/api
```

The endpoint examples in this document include the complete `/api` path.

Protected endpoints accept either:

- The HTTP-only authentication cookie created by the login endpoint
- A bearer token supplied through the `Authorization` header

```text
Authorization: Bearer <token>
```

Requests containing JSON should include:

```text
Content-Type: application/json
```

## Response conventions

Successful responses generally follow this structure:

```json
{
  "success": true
}
```

Failed responses generally follow this structure:

```json
{
  "success": false,
  "message": "Description of the error"
}
```

Validation failures may also include field-specific errors:

```json
{
  "success": false,
  "message": "Invalid information",
  "errors": {
    "fieldName": [
      "Validation message"
    ]
  }
}
```

## Roles

TaskFlow supports three roles:

```text
ADMIN
PROJECT_MANAGER
TEAM_MEMBER
```

## Authentication endpoints

### Log in

```http
POST /api/auth/login
```

Access: Public

Request:

```json
{
  "email": "admin@taskflow.dev",
  "password": "Password@123"
}
```

Successful response:

```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "name": "Administrator",
    "email": "admin@taskflow.dev",
    "role": "ADMIN",
    "status": "ACTIVE"
  }
}
```

The server also sets an HTTP-only authentication cookie. Clients using cookie authentication must preserve and send that cookie with later protected requests.

Possible errors:

- `400` — Invalid request data
- `401` — Invalid email or password
- `403` — Account is inactive
- `429` — Too many authentication attempts

### Get authenticated user

```http
GET /api/auth/me
```

Access: Authenticated users

Successful response:

```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "name": "Administrator",
    "email": "admin@taskflow.dev",
    "role": "ADMIN",
    "status": "ACTIVE"
  }
}
```

Possible errors:

- `401` — Authentication token is missing or invalid

### Log out

```http
POST /api/auth/logout
```

Access: Authenticated users

Successful response:

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

The authentication cookie is cleared. Bearer-token clients should also discard the token locally.

## User endpoints

All user-management endpoints require the `ADMIN` role.

### List users

```http
GET /api/users
```

Successful response:

```json
{
  "success": true,
  "users": [
    {
      "id": "user-uuid",
      "name": "Project Manager",
      "email": "manager@taskflow.dev",
      "role": "PROJECT_MANAGER",
      "status": "ACTIVE",
      "created_at": "2026-07-16T08:00:00.000Z",
      "updated_at": "2026-07-16T08:00:00.000Z"
    }
  ]
}
```

### Create a user

```http
POST /api/users
```

Request:

```json
{
  "name": "New Team Member",
  "email": "newmember@taskflow.dev",
  "password": "Password@123",
  "role": "TEAM_MEMBER"
}
```

Supported roles:

```text
ADMIN
PROJECT_MANAGER
TEAM_MEMBER
```

Possible errors:

- `400` — Validation failed
- `403` — Administrator role required
- `409` — Email already exists

### Update a user

```http
PATCH /api/users/:id
```

Each request field is optional, but at least one field must be supplied. Include only the fields that must change.

```json
{
  "name": "Updated Name",
  "role": "PROJECT_MANAGER",
  "status": "ACTIVE"
}
```

Supported account statuses:

```text
ACTIVE
INACTIVE
```

An Administrator cannot deactivate their own currently authenticated account. Passwords and password hashes are never returned by the API.

Possible errors:

- `400` — Invalid update
- `403` — Administrator role required
- `404` — User not found

## Project endpoints

### List accessible projects

```http
GET /api/projects
```

Access:

- Administrator — all projects
- Project Manager — projects managed by the authenticated user
- Team Member — projects assigned through project membership

Successful response:

```json
{
  "success": true,
  "projects": [
    {
      "id": "project-uuid",
      "name": "TaskFlow Internship Project",
      "description": "Project and team task management platform",
      "status": "ACTIVE",
      "start_date": "2026-07-16T00:00:00.000Z",
      "due_date": "2026-07-30T00:00:00.000Z",
      "manager_id": "manager-user-uuid",
      "manager_name": "Project Manager",
      "manager_email": "manager@taskflow.dev"
    }
  ]
}
```

### Create a project

```http
POST /api/projects
```

Access:

- Administrator
- Project Manager

Administrator request:

```json
{
  "name": "Website Redesign",
  "description": "Redesign the company website.",
  "status": "PLANNING",
  "managerId": "manager-user-uuid",
  "startDate": "2026-07-20",
  "dueDate": "2026-08-20"
}
```

Project Manager request:

```json
{
  "name": "Website Redesign",
  "description": "Redesign the company website.",
  "status": "PLANNING",
  "startDate": "2026-07-20",
  "dueDate": "2026-08-20"
}
```

A Project Manager is automatically assigned as the manager of a project they create.

Supported project statuses:

```text
PLANNING
ACTIVE
ON_HOLD
COMPLETED
CANCELLED
```

The due date must be on or after the start date.

### List active Team Members

```http
GET /api/projects/team-members
```

Access:

- Administrator
- Project Manager

Successful response:

```json
{
  "success": true,
  "users": [
    {
      "id": "team-member-uuid",
      "name": "Team Member",
      "email": "member@taskflow.dev",
      "role": "TEAM_MEMBER",
      "status": "ACTIVE"
    }
  ]
}
```

### Assign a Team Member to a project

```http
POST /api/projects/:projectId/members
```

Access:

- Administrator
- Project Manager who manages the project

Request:

```json
{
  "userId": "team-member-uuid"
}
```

The selected user must:

- Exist
- Be active
- Have the `TEAM_MEMBER` role

Possible errors:

- `400` — Invalid user or project data
- `403` — The authenticated user cannot manage the project
- `404` — Project not found
- `409` — User is already assigned to the project

### Update a project

```http
PATCH /api/projects/:projectId
```

Access:

- Administrator
- Project Manager who manages the project

Each request field is optional, but at least one field must be supplied.

Example request:

```json
{
  "name": "Updated Project Name",
  "description": "Updated project description",
  "status": "ON_HOLD",
  "startDate": "2026-07-20",
  "dueDate": "2026-08-25"
}
```

Administrators may also change the manager:

```json
{
  "managerId": "new-manager-user-uuid"
}
```

Possible errors:

- `400` — Invalid project information
- `403` — Insufficient project access
- `404` — Project not found

## Task endpoints

### List accessible tasks

```http
GET /api/tasks
```

Access:

- Administrator — all tasks
- Project Manager — tasks belonging to managed projects
- Team Member — tasks assigned to the authenticated user

Successful response:

```json
{
  "success": true,
  "tasks": [
    {
      "id": "task-uuid",
      "project_id": "project-uuid",
      "project_name": "TaskFlow Internship Project",
      "assignee_id": "team-member-uuid",
      "assignee_name": "Team Member",
      "assignee_email": "member@taskflow.dev",
      "title": "Build authentication interface",
      "description": "Create the login page and connect it to the API",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "progress": 40,
      "start_date": "2026-07-16T00:00:00.000Z",
      "due_date": "2026-07-22T00:00:00.000Z"
    }
  ]
}
```

### Create a task

```http
POST /api/tasks
```

Access:

- Administrator
- Project Manager who manages the selected project

Request:

```json
{
  "projectId": "project-uuid",
  "assigneeId": "team-member-uuid",
  "title": "Build project dashboard",
  "description": "Create the project summary and progress dashboard.",
  "status": "TODO",
  "priority": "HIGH",
  "progress": 0,
  "startDate": "2026-07-21",
  "dueDate": "2026-07-28"
}
```

The assignee must be an active Team Member who is already assigned to the selected project.

Supported task statuses:

```text
TODO
IN_PROGRESS
IN_REVIEW
COMPLETED
BLOCKED
```

Supported priorities:

```text
LOW
MEDIUM
HIGH
URGENT
```

Progress must be a whole number from `0` to `100`.

### Update task status and progress

```http
PATCH /api/tasks/:taskId/progress
```

Access:

- Administrator
- Project Manager who manages the task project
- Team Member assigned to the task

At least one of `status` or `progress` must be supplied.

Request:

```json
{
  "status": "IN_REVIEW",
  "progress": 60
}
```

Possible errors:

- `400` — Invalid status or progress
- `403` — User cannot update this task
- `404` — Task not found

### Add a task comment

```http
POST /api/tasks/:taskId/comments
```

Access:

- Administrator
- Project Manager who manages the task project
- Team Member assigned to the task

Request:

```json
{
  "content": "Authentication interface reviewed successfully."
}
```

Possible errors:

- `400` — Comment content is invalid
- `403` — User cannot comment on this task
- `404` — Task not found

## Health endpoints

### API health

```http
GET /api/health
```

Example response:

```json
{
  "success": true,
  "message": "TaskFlow API is healthy"
}
```

### Database health

```http
GET /api/health/database
```

Example response:

```json
{
  "success": true,
  "message": "Database connection is healthy"
}
```

## Common HTTP status codes

| Status | Meaning |
|---|---|
| `200` | Request completed successfully |
| `201` | Resource created successfully |
| `400` | Invalid request or validation failure |
| `401` | Authentication required |
| `403` | Authenticated user lacks permission |
| `404` | Requested resource not found |
| `409` | Resource conflict |
| `429` | Too many requests |
| `500` | Internal server error |

## Example authentication flow

1. Send `POST /api/auth/login`.
2. Preserve the returned authentication cookie.
3. Send the cookie with protected requests.
4. Use `GET /api/auth/me` to verify the session.
5. Send `POST /api/auth/logout` to end the session.
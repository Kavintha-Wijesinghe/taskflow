# TaskFlow Testing Report

## Testing objectives

Testing was performed to verify:

- Authentication and security behavior
- Role-based access control
- API validation
- User-management operations
- Project-management operations
- Task-management operations
- Database connectivity and constraints
- Frontend and backend integration
- Linting and production builds
- Continuous integration

## Automated tests

Test framework:

```text
Vitest
```

Test file:

```text
server/src/tests/smoke.test.ts
```

Run the automated tests with:

```powershell
cd server
npm test
```

Recorded result:

```text
Test Files: 1 passed
Tests: 7 passed
```

### Automated authentication-token tests

| Test | Expected result | Status |
|---|---|---|
| Create and verify an Administrator token | Token returns the correct user ID and role | Passed |
| Create and verify a Project Manager token | Token returns the correct user ID and role | Passed |
| Create and verify a Team Member token | Token returns the correct user ID and role | Passed |
| Verify a token with an invalid signature | Verification throws an error | Passed |
| Verify a token with a different JWT secret | Verification throws an error | Passed |
| Create a token without `JWT_SECRET` | A clear configuration error is thrown | Passed |
| Verify a token without `JWT_SECRET` | A clear configuration error is thrown | Passed |

## Backend build testing

Command:

```powershell
cd server
npm run build
```

Expected result:

- TypeScript compilation completes without errors.
- Compiled output is created in `server/dist`.

Recorded result:

```text
Passed
```

## Frontend lint testing

Command:

```powershell
cd web
npm run lint
```

Expected result:

- ESLint completes without errors or warnings.

Recorded result:

```text
Passed
```

## Frontend production-build testing

Command:

```powershell
cd web
npm run build
```

Expected result:

- The Next.js production compilation succeeds.
- TypeScript validation succeeds.
- Static application pages are generated successfully.

Verified application routes:

```text
/
/dashboard
/login
/projects
/tasks
/users
```

Recorded result:

```text
Passed
```

## Manual authentication tests

| Test case | Expected result | Result |
|---|---|---|
| Administrator login with correct credentials | User is redirected to the dashboard | Passed |
| Login with an invalid password | An error message is displayed | Passed |
| Authenticated request to `/api/auth/me` | Authenticated user information is returned | Passed |
| Log out | Authentication cookie is cleared | Passed |
| Access a protected page after logout | User is redirected to the login page | Passed |
| Send a protected API request after logout | API returns `401 Unauthorized` | Passed |
| Team Member accesses an Administrator-only API | API returns `403 Forbidden` | Passed |
| Inactive user attempts to log in | Login is rejected | Passed |

## Manual user-management tests

| Test case | Expected result | Result |
|---|---|---|
| Administrator views all users | User table loads successfully | Passed |
| Administrator creates a Team Member | New user appears in the user table | Passed |
| Administrator creates a user with a duplicate email | Conflict error is returned | Passed |
| Non-Administrator accesses a user-management endpoint | API returns `403 Forbidden` | Passed |
| Administrator changes another user's role | Updated role is saved and persists after refresh | Passed |
| Administrator deactivates another user | Updated status is saved and persists after refresh | Passed |
| Administrator reactivates another user | Account returns to the active state | Passed |
| Administrator attempts to deactivate their own account | Action is prevented | Passed |
| Update button is used without changing values | Update action remains disabled or validation prevents submission | Passed |

## Manual project-management tests

| Test case | Expected result | Result |
|---|---|---|
| Administrator views all projects | Project cards load successfully | Passed |
| Administrator creates a project | Project is created and displayed | Passed |
| Administrator selects a Project Manager | Selected manager is stored correctly | Passed |
| Project Manager creates a project | Project Manager is assigned automatically | Passed |
| Team Member views assigned projects | Only accessible projects are returned | Passed |
| Assign an active Team Member to a project | Assignment succeeds | Passed |
| Assign a user who is not a Team Member | Validation fails | Passed |
| Assign the same member twice | Conflict response is returned | Passed |
| Update project status | Status badge refreshes with the saved value | Passed |
| Enter a due date before the start date | Validation prevents submission | Passed |

## Manual task-management tests

| Test case | Expected result | Result |
|---|---|---|
| Administrator views all tasks | Task cards load successfully | Passed |
| Project Manager views managed-project tasks | Accessible tasks are returned | Passed |
| Team Member views assigned tasks | Assigned tasks are returned | Passed |
| Create a task for an assigned project member | Task is created successfully | Passed |
| Assign a task to a user outside the project | Validation fails | Passed |
| Update task status | Saved status is displayed after refresh | Passed |
| Update task progress | Progress bar and percentage refresh | Passed |
| Enter progress below `0` or above `100` | Validation fails | Passed |
| Add a task comment | Comment request succeeds | Passed |
| Unauthorized user attempts to update a task | API returns `403 Forbidden` | Passed |

## Database testing

Database platform:

```text
PostgreSQL 16
```

Start the local database with:

```powershell
docker compose up -d postgres
```

Initialize the schema with:

```powershell
cd server
npm run db:init
```

Load the demonstration data with:

```powershell
npm run db:seed
```

The following database behavior was verified through schema initialization, seed execution, application testing, and source-code review:

- Foreign-key relationships
- Unique user-email enforcement
- Project date constraints
- Task-progress range constraints
- Project-membership uniqueness
- Parameterized SQL queries
- Active-user filtering
- Role-based query filtering

## Security testing and review

The following protections were manually tested or reviewed:

- bcrypt password hashing
- Signed JWT creation and verification
- HTTP-only authentication cookies
- Bearer-token authentication support
- Authentication middleware
- Role-based authorization middleware
- Resource-level project and task access checks
- Zod request validation
- Parameterized SQL statements
- Helmet security headers
- CORS configuration
- Login rate limiting
- Inactive-account rejection
- Prevention of Administrator self-deactivation
- Environment-secret exclusion from Git

## Continuous-integration testing

Workflow file:

```text
.github/workflows/ci.yml
```

The workflow runs for:

- Pull requests targeting `main`
- Pushes to `main`

### Backend CI job

The backend job:

1. Checks out the repository.
2. Sets up Node.js.
3. Starts a PostgreSQL service container.
4. Installs the pinned compatible npm version.
5. Installs backend dependencies using `npm ci`.
6. Initializes the test database.
7. Runs the Vitest test suite.
8. Compiles the backend TypeScript application.

### Frontend CI job

The frontend job:

1. Checks out the repository.
2. Sets up Node.js.
3. Installs frontend dependencies using `npm ci`.
4. Runs ESLint.
5. Runs the Next.js production build.

Recorded final result:

```text
Backend tests and build: Passed
Frontend lint and build: Passed
```

## Browser testing

The application was manually tested using a Chromium-based desktop browser.

Verified interface behavior:

- Login and logout
- Dashboard navigation
- User creation, role updates, and account-status controls
- Project creation and project cards
- Team Member assignment
- Project-status updates
- Task creation and task cards
- Task-status and progress controls
- Task-comment submission
- Loading, success, validation, and error messages

## Known testing limitations

The current project does not yet include:

- Automated REST API integration tests
- Frontend component tests
- End-to-end browser tests
- Automated accessibility tests
- Cross-browser test automation
- Load or performance testing
- Automated dependency or security scanning

These are recommended improvements for future development.

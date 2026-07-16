"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api";

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "COMPLETED"
  | "BLOCKED";

type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  project_id: string;
  project_name: string;
  assignee_id: string;
  assignee_name: string;
  assignee_email: string;
}

interface Project {
  id: string;
  name: string;
  manager_name: string;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PROJECT_MANAGER" | "TEAM_MEMBER";
  status: "ACTIVE" | "INACTIVE";
}

interface TasksResponse {
  success: boolean;
  tasks: Task[];
}

interface ProjectsResponse {
  success: boolean;
  projects: Project[];
}

interface UsersResponse {
  success: boolean;
  users: SystemUser[];
}

interface ActionResponse {
  success: boolean;
  message?: string;
}

const statusLabels: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function formatDate(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export default function TasksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<SystemUser[]>([]);

  const [loadingTasks, setLoadingTasks] = useState(true);
  const [creatingTask, setCreatingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(
    null
  );
  const [commentingTaskId, setCommentingTaskId] = useState<
    string | null
  >(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [newTaskStatus, setNewTaskStatus] =
    useState<TaskStatus>("TODO");
  const [priority, setPriority] =
    useState<TaskPriority>("MEDIUM");
  const [initialProgress, setInitialProgress] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [taskStatusUpdates, setTaskStatusUpdates] = useState<
    Record<string, TaskStatus>
  >({});

  const [taskProgressUpdates, setTaskProgressUpdates] = useState<
    Record<string, number>
  >({});

  const [taskComments, setTaskComments] = useState<
    Record<string, string>
  >({});

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canCreateTasks =
    user?.role === "ADMIN" ||
    user?.role === "PROJECT_MANAGER";

  const loadTasks = useCallback(async () => {
    try {
      const response =
        await apiRequest<TasksResponse>("/api/tasks");

      setTasks(response.tasks);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load tasks"
      );
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }
    const authenticatedUser = user;
    let ignore = false;

    async function initializeTasksPage() {
      try {
        const tasksRequest =
          apiRequest<TasksResponse>("/api/tasks");

        const referencesRequest =
          authenticatedUser.role === "ADMIN" ||
          authenticatedUser.role === "PROJECT_MANAGER"
            ? Promise.all([
                apiRequest<ProjectsResponse>("/api/projects"),
                apiRequest<UsersResponse>(
                  "/api/projects/team-members"
                ),
              ])
            : Promise.resolve(null);

        const [tasksResponse, referencesResponse] =
          await Promise.all([
            tasksRequest,
            referencesRequest,
          ]);

        if (ignore) {
          return;
        }

        setTasks(tasksResponse.tasks);

        if (referencesResponse) {
          const [
            projectsResponse,
            membersResponse,
          ] = referencesResponse;

          setProjects(projectsResponse.projects);
          setTeamMembers(membersResponse.users);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load task information"
          );
        }
      } finally {
        if (!ignore) {
          setLoadingTasks(false);
        }
      }
    }

    void initializeTasksPage();

    return () => {
      ignore = true;
    };
  }, [loading, user, router]);

  async function handleCreateTask(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canCreateTasks) {
      return;
    }

    if (!projectId) {
      setError("Please select a project.");
      setSuccess("");
      return;
    }

    if (!assigneeId) {
      setError("Please select a Team Member.");
      setSuccess("");
      return;
    }

    if (
      !Number.isInteger(initialProgress) ||
      initialProgress < 0 ||
      initialProgress > 100
    ) {
      setError(
        "Initial progress must be a whole number between 0 and 100."
      );
      setSuccess("");
      return;
    }

    if (startDate && dueDate && dueDate < startDate) {
      setError(
        "The due date cannot be earlier than the start date."
      );
      setSuccess("");
      return;
    }

    setCreatingTask(true);
    setError("");
    setSuccess("");

    const requestBody: {
      projectId: string;
      assigneeId: string;
      title: string;
      description?: string;
      status: TaskStatus;
      priority: TaskPriority;
      progress: number;
      startDate?: string;
      dueDate?: string;
    } = {
      projectId,
      assigneeId,
      title: title.trim(),
      status: newTaskStatus,
      priority,
      progress: initialProgress,
    };

    if (description.trim()) {
      requestBody.description = description.trim();
    }

    if (startDate) {
      requestBody.startDate = startDate;
    }

    if (dueDate) {
      requestBody.dueDate = dueDate;
    }

    try {
      await apiRequest<ActionResponse>("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      setTitle("");
      setDescription("");
      setProjectId("");
      setAssigneeId("");
      setNewTaskStatus("TODO");
      setPriority("MEDIUM");
      setInitialProgress(0);
      setStartDate("");
      setDueDate("");

      setSuccess("Task created successfully.");

      await loadTasks();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create task"
      );
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleUpdateTask(task: Task) {
    const nextStatus =
      taskStatusUpdates[task.id] ?? task.status;

    const nextProgress =
      taskProgressUpdates[task.id] ?? task.progress;

    if (
      nextStatus === task.status &&
      nextProgress === task.progress
    ) {
      setError(
        "Change the task status or progress before updating."
      );
      setSuccess("");
      return;
    }

    if (
      !Number.isInteger(nextProgress) ||
      nextProgress < 0 ||
      nextProgress > 100
    ) {
      setError(
        "Progress must be a whole number between 0 and 100."
      );
      setSuccess("");
      return;
    }

    setUpdatingTaskId(task.id);
    setError("");
    setSuccess("");

    try {
      await apiRequest<ActionResponse>(
        `/api/tasks/${task.id}/progress`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
            progress: nextProgress,
          }),
        }
      );

      setTaskStatusUpdates((currentValues) => {
        const updatedValues = { ...currentValues };
        delete updatedValues[task.id];
        return updatedValues;
      });

      setTaskProgressUpdates((currentValues) => {
        const updatedValues = { ...currentValues };
        delete updatedValues[task.id];
        return updatedValues;
      });

      setSuccess(
        `${task.title} was updated successfully.`
      );

      await loadTasks();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update task"
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleAddComment(task: Task) {
    const content = taskComments[task.id]?.trim();

    if (!content) {
      setError("Enter a comment before submitting.");
      setSuccess("");
      return;
    }

    setCommentingTaskId(task.id);
    setError("");
    setSuccess("");

    try {
      await apiRequest<ActionResponse>(
        `/api/tasks/${task.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
          }),
        }
      );

      setTaskComments((currentValues) => ({
        ...currentValues,
        [task.id]: "",
      }));

      setSuccess(`Comment added to ${task.title}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to add comment"
      );
    } finally {
      setCommentingTaskId(null);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Tasks
            </h1>

            <p className="text-sm text-slate-500">
              View assignments and monitor task progress
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <p className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p className="mb-6 rounded-lg bg-green-50 p-4 text-green-700">
            {success}
          </p>
        )}

        {canCreateTasks && (
          <form
            onSubmit={handleCreateTask}
            className="mb-8 rounded-2xl bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                Create task
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Create a task and assign it to a project Team
                Member.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="task-title"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Task title
                </label>

                <input
                  id="task-title"
                  type="text"
                  required
                  minLength={2}
                  maxLength={150}
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  placeholder="Enter task title"
                />
              </div>

              <div>
                <label
                  htmlFor="task-project"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Project
                </label>

                <select
                  id="task-project"
                  required
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setAssigneeId("");
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">Select a project</option>

                  {projects.map((project) => (
                    <option
                      key={project.id}
                      value={project.id}
                    >
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-assignee"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Assign to
                </label>

                <select
                  id="task-assignee"
                  required
                  value={assigneeId}
                  onChange={(event) =>
                    setAssigneeId(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">
                    Select a Team Member
                  </option>

                  {teamMembers.map((teamMember) => (
                    <option
                      key={teamMember.id}
                      value={teamMember.id}
                    >
                      {teamMember.name} — {teamMember.email}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-slate-500">
                  The selected Team Member must already be
                  assigned to the selected project.
                </p>
              </div>

              <div>
                <label
                  htmlFor="task-priority"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Priority
                </label>

                <select
                  id="task-priority"
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target.value as TaskPriority
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  {Object.entries(priorityLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-task-status"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Status
                </label>

                <select
                  id="new-task-status"
                  value={newTaskStatus}
                  onChange={(event) =>
                    setNewTaskStatus(
                      event.target.value as TaskStatus
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  {Object.entries(statusLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="initial-progress"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Initial progress
                </label>

                <input
                  id="initial-progress"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={initialProgress}
                  onChange={(event) =>
                    setInitialProgress(
                      Number(event.target.value)
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="task-start-date"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Start date
                </label>

                <input
                  id="task-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="task-due-date"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Due date
                </label>

                <input
                  id="task-due-date"
                  type="date"
                  min={startDate || undefined}
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="task-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="task-description"
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  placeholder="Describe the task"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingTask}
              className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingTask
                ? "Creating..."
                : "Create task"}
            </button>
          </form>
        )}

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">
            Available tasks
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Tasks available for your account and role.
          </p>
        </div>

        {loadingTasks ? (
          <p className="text-slate-600">
            Loading tasks...
          </p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              No tasks found
            </h2>

            <p className="mt-2 text-slate-500">
              There are no tasks available for your account.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {tasks.map((task) => {
              const selectedStatus =
                taskStatusUpdates[task.id] ?? task.status;

              const selectedProgress =
                taskProgressUpdates[task.id] ??
                task.progress;

              const hasTaskChanges =
                selectedStatus !== task.status ||
                selectedProgress !== task.progress;

              return (
                <article
                  key={task.id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-blue-600">
                        {task.project_name}
                      </p>

                      <h2 className="mt-1 text-xl font-semibold text-slate-900">
                        {task.title}
                      </h2>
                    </div>

                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                      {statusLabels[task.status]}
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-slate-600">
                    {task.description ||
                      "No description provided."}
                  </p>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-500">
                      Assigned to
                    </p>

                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {task.assignee_name}
                      </p>

                      <p className="text-xs text-slate-400">
                        {task.assignee_email}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      Priority
                    </p>

                    <p className="text-sm font-medium text-slate-900">
                      {priorityLabels[task.priority]}
                    </p>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        Progress
                      </span>

                      <span className="font-medium text-slate-900">
                        {task.progress}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, task.progress)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-sm">
                    <div>
                      <p className="text-slate-500">
                        Start date
                      </p>

                      <p className="mt-1 font-medium text-slate-900">
                        {formatDate(task.start_date)}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        Due date
                      </p>

                      <p className="mt-1 font-medium text-slate-900">
                        {formatDate(task.due_date)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Update task progress
                    </h3>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`status-${task.id}`}
                          className="mb-2 block text-sm text-slate-600"
                        >
                          Status
                        </label>

                        <select
                          id={`status-${task.id}`}
                          value={selectedStatus}
                          onChange={(event) =>
                            setTaskStatusUpdates(
                              (currentValues) => ({
                                ...currentValues,
                                [task.id]:
                                  event.target
                                    .value as TaskStatus,
                              })
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                        >
                          {Object.entries(
                            statusLabels
                          ).map(([value, label]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`progress-${task.id}`}
                          className="mb-2 block text-sm text-slate-600"
                        >
                          Progress percentage
                        </label>

                        <input
                          id={`progress-${task.id}`}
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={selectedProgress}
                          onChange={(event) =>
                            setTaskProgressUpdates(
                              (currentValues) => ({
                                ...currentValues,
                                [task.id]: Number(
                                  event.target.value
                                ),
                              })
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={selectedProgress}
                      onChange={(event) =>
                        setTaskProgressUpdates(
                          (currentValues) => ({
                            ...currentValues,
                            [task.id]: Number(
                              event.target.value
                            ),
                          })
                        )
                      }
                      className="mt-4 w-full"
                      aria-label={`Progress for ${task.title}`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateTask(task)
                      }
                      disabled={
                        updatingTaskId === task.id ||
                        !hasTaskChanges
                      }
                      className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingTaskId === task.id
                        ? "Updating..."
                        : "Update task"}
                    </button>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Add comment
                    </h3>

                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={taskComments[task.id] || ""}
                      onChange={(event) =>
                        setTaskComments(
                          (currentValues) => ({
                            ...currentValues,
                            [task.id]: event.target.value,
                          })
                        )
                      }
                      className="mt-3 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                      placeholder="Write a task comment"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handleAddComment(task)
                      }
                      disabled={
                        commentingTaskId === task.id ||
                        !taskComments[task.id]?.trim()
                      }
                      className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {commentingTaskId === task.id
                        ? "Adding..."
                        : "Add comment"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
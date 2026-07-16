"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api";

type ProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  manager_id: string;
  manager_name: string;
  manager_email: string;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PROJECT_MANAGER" | "TEAM_MEMBER";
  status: "ACTIVE" | "INACTIVE";
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

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
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

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<SystemUser[]>([]);
  const [teamMembers, setTeamMembers] = useState<SystemUser[]>([]);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [assigningProjectId, setAssigningProjectId] = useState<
    string | null
  >(null);

  const [updatingProjectId, setUpdatingProjectId] = useState<
    string | null
  >(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNING");
  const [managerId, setManagerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [selectedMemberIds, setSelectedMemberIds] = useState<
    Record<string, string>
  >({});

  const [projectStatusUpdates, setProjectStatusUpdates] = useState<
    Record<string, ProjectStatus>
  >({});

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canManageProjects =
    user?.role === "ADMIN" ||
    user?.role === "PROJECT_MANAGER";

  const loadProjects = useCallback(async () => {
    try {
      const response =
        await apiRequest<ProjectsResponse>("/api/projects");

      setProjects(response.projects);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load projects"
      );
    } finally {
      setLoadingProjects(false);
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

    async function initializeProjectsPage() {
      try {
        const projectsRequest =
          apiRequest<ProjectsResponse>("/api/projects");

        const managersRequest =
          authenticatedUser.role === "ADMIN"
            ? apiRequest<UsersResponse>("/api/users")
            : Promise.resolve<UsersResponse | null>(null);

        const teamMembersRequest =
          authenticatedUser.role === "ADMIN" ||
          authenticatedUser.role === "PROJECT_MANAGER"
            ? apiRequest<UsersResponse>(
                "/api/projects/team-members"
              )
            : Promise.resolve<UsersResponse | null>(null);

        const [
          projectsResponse,
          managersResponse,
          teamMembersResponse,
        ] = await Promise.all([
          projectsRequest,
          managersRequest,
          teamMembersRequest,
        ]);

        if (ignore) {
          return;
        }

        setProjects(projectsResponse.projects);

        if (managersResponse) {
          const availableManagers =
            managersResponse.users.filter(
              (systemUser) =>
                systemUser.status === "ACTIVE" &&
                (systemUser.role === "ADMIN" ||
                  systemUser.role === "PROJECT_MANAGER")
            );

          setManagers(availableManagers);
        }

        if (teamMembersResponse) {
          setTeamMembers(teamMembersResponse.users);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load project information"
          );
        }
      } finally {
        if (!ignore) {
          setLoadingProjects(false);
        }
      }
    }

    void initializeProjectsPage();

    return () => {
      ignore = true;
    };
  }, [loading, user, router]);

  async function handleCreateProject(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user || !canManageProjects) {
      return;
    }

    if (user.role === "ADMIN" && !managerId) {
      setError("Please select a project manager.");
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

    setSubmitting(true);
    setError("");
    setSuccess("");

    const requestBody: {
      name: string;
      description?: string;
      status: ProjectStatus;
      managerId?: string;
      startDate?: string;
      dueDate?: string;
    } = {
      name: name.trim(),
      status,
    };

    if (description.trim()) {
      requestBody.description = description.trim();
    }

    if (user.role === "ADMIN") {
      requestBody.managerId = managerId;
    }

    if (startDate) {
      requestBody.startDate = startDate;
    }

    if (dueDate) {
      requestBody.dueDate = dueDate;
    }

    try {
      await apiRequest<ActionResponse>("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      setName("");
      setDescription("");
      setStatus("PLANNING");
      setManagerId("");
      setStartDate("");
      setDueDate("");
      setSuccess("Project created successfully.");

      await loadProjects();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create project"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProjectStatus(
    project: Project
  ) {
    const nextStatus =
      projectStatusUpdates[project.id] ?? project.status;

    if (nextStatus === project.status) {
      setError("Select a different project status.");
      setSuccess("");
      return;
    }

    setUpdatingProjectId(project.id);
    setError("");
    setSuccess("");

    try {
      await apiRequest<ActionResponse>(
        `/api/projects/${project.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      setProjectStatusUpdates((currentValues) => {
        const updatedValues = { ...currentValues };
        delete updatedValues[project.id];
        return updatedValues;
      });

      setSuccess(
        `${project.name} was updated successfully.`
      );

      await loadProjects();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update project"
      );
    } finally {
      setUpdatingProjectId(null);
    }
  }

  async function handleAssignMember(projectId: string) {
    const userId = selectedMemberIds[projectId];

    if (!userId) {
      setError("Please select a team member.");
      setSuccess("");
      return;
    }

    setAssigningProjectId(projectId);
    setError("");
    setSuccess("");

    try {
      await apiRequest<ActionResponse>(
        `/api/projects/${projectId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
          }),
        }
      );

      const assignedMember = teamMembers.find(
        (teamMember) => teamMember.id === userId
      );

      setSelectedMemberIds((currentValues) => ({
        ...currentValues,
        [projectId]: "",
      }));

      setSuccess(
        assignedMember
          ? `${assignedMember.name} was assigned to the project successfully.`
          : "Team member assigned successfully."
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to assign team member"
      );
    } finally {
      setAssigningProjectId(null);
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
              Projects
            </h1>

            <p className="text-sm text-slate-500">
              View and manage project information
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

        {canManageProjects && (
          <form
            onSubmit={handleCreateProject}
            className="mb-8 rounded-2xl bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                Create project
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add a new project and assign its manager.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Project name
                </label>

                <input
                  id="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Status
                </label>

                <select
                  id="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value as ProjectStatus
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

              {user.role === "ADMIN" && (
                <div className="md:col-span-2">
                  <label
                    htmlFor="manager"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Project manager
                  </label>

                  <select
                    id="manager"
                    required
                    value={managerId}
                    onChange={(event) =>
                      setManagerId(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select a project manager
                    </option>

                    {managers.map((manager) => (
                      <option
                        key={manager.id}
                        value={manager.id}
                      >
                        {manager.name} — {manager.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {user.role === "PROJECT_MANAGER" && (
                <div className="md:col-span-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
                  You will automatically be assigned as the
                  manager of this project.
                </div>
              )}

              <div>
                <label
                  htmlFor="startDate"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Start date
                </label>

                <input
                  id="startDate"
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
                  htmlFor="dueDate"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Due date
                </label>

                <input
                  id="dueDate"
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
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="description"
                  rows={4}
                  maxLength={1000}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  placeholder="Describe the project"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Creating..."
                : "Create project"}
            </button>
          </form>
        )}

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">
            Available projects
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Projects available for your account and role.
          </p>
        </div>

        {loadingProjects ? (
          <p className="text-slate-600">
            Loading projects...
          </p>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              No projects found
            </h2>

            <p className="mt-2 text-slate-500">
              There are no projects available for your
              account.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {project.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Manager: {project.manager_name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {project.manager_email}
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    {statusLabels[project.status]}
                  </span>
                </div>

                <p className="mt-5 text-sm text-slate-600">
                  {project.description ||
                    "No description provided."}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">
                      Start date
                    </p>

                    <p className="mt-1 font-medium text-slate-900">
                      {formatDate(project.start_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Due date
                    </p>

                    <p className="mt-1 font-medium text-slate-900">
                      {formatDate(project.due_date)}
                    </p>
                  </div>
                </div>

                {canManageProjects && (
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Update project status
                    </h3>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <select
                        value={
                          projectStatusUpdates[project.id] ??
                          project.status
                        }
                        onChange={(event) =>
                          setProjectStatusUpdates(
                            (currentValues) => ({
                              ...currentValues,
                              [project.id]:
                                event.target
                                  .value as ProjectStatus,
                            })
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                      >
                        {Object.entries(statusLabels).map(
                          ([value, label]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateProjectStatus(project)
                        }
                        disabled={
                          updatingProjectId === project.id ||
                          (projectStatusUpdates[project.id] ??
                            project.status) === project.status
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingProjectId === project.id
                          ? "Updating..."
                          : "Update"}
                      </button>
                    </div>
                  </div>
                )}

                {canManageProjects && (
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Assign team member
                    </h3>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <select
                        value={
                          selectedMemberIds[project.id] || ""
                        }
                        onChange={(event) =>
                          setSelectedMemberIds(
                            (currentValues) => ({
                              ...currentValues,
                              [project.id]:
                                event.target.value,
                            })
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                      >
                        <option value="">
                          Select a team member
                        </option>

                        {teamMembers.map((teamMember) => (
                          <option
                            key={teamMember.id}
                            value={teamMember.id}
                          >
                            {teamMember.name} —{" "}
                            {teamMember.email}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          handleAssignMember(project.id)
                        }
                        disabled={
                          assigningProjectId === project.id ||
                          !selectedMemberIds[project.id]
                        }
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {assigningProjectId === project.id
                          ? "Assigning..."
                          : "Assign"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
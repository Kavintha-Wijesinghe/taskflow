"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api";

type UserRole = "ADMIN" | "PROJECT_MANAGER" | "TEAM_MEMBER";
type UserStatus = "ACTIVE" | "INACTIVE";

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at?: string;
}

interface UsersResponse {
  success: boolean;
  users: SystemUser[];
}

interface ActionResponse {
  success: boolean;
  message?: string;
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrator",
  PROJECT_MANAGER: "Project Manager",
  TEAM_MEMBER: "Team Member",
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

function formatDate(date?: string) {
  if (!date) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export default function UsersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(
    null
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newUserRole, setNewUserRole] =
    useState<UserRole>("TEAM_MEMBER");

  const [roleUpdates, setRoleUpdates] = useState<
    Record<string, UserRole>
  >({});

  const [statusUpdates, setStatusUpdates] = useState<
    Record<string, UserStatus>
  >({});

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);

      const response =
        await apiRequest<UsersResponse>("/api/users");

      setUsers(response.users);

      const initialRoles: Record<string, UserRole> = {};
      const initialStatuses: Record<string, UserStatus> = {};

      response.users.forEach((systemUser) => {
        initialRoles[systemUser.id] = systemUser.role;
        initialStatuses[systemUser.id] = systemUser.status;
      });

      setRoleUpdates(initialRoles);
      setStatusUpdates(initialStatuses);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load users"
      );
    } finally {
      setLoadingUsers(false);
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

    if (user.role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }

    let ignore = false;

    async function initializeUsersPage() {
      try {
        const response =
          await apiRequest<UsersResponse>("/api/users");

        if (ignore) {
          return;
        }

        const initialRoles: Record<string, UserRole> = {};
        const initialStatuses: Record<string, UserStatus> = {};

        response.users.forEach((systemUser) => {
          initialRoles[systemUser.id] = systemUser.role;
          initialStatuses[systemUser.id] =
            systemUser.status;
        });

        setUsers(response.users);
        setRoleUpdates(initialRoles);
        setStatusUpdates(initialStatuses);
      } catch (requestError) {
        if (!ignore) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load users"
          );
        }
      } finally {
        if (!ignore) {
          setLoadingUsers(false);
        }
      }
    }

    void initializeUsersPage();

    return () => {
      ignore = true;
    };
  }, [loading, user, router]);

  async function handleCreateUser(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setCreatingUser(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest<ActionResponse>("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: newUserRole,
        }),
      });

      setName("");
      setEmail("");
      setPassword("");
      setNewUserRole("TEAM_MEMBER");
      setSuccess("User created successfully.");

      await loadUsers();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create user"
      );
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleUpdateUser(systemUser: SystemUser) {
    const selectedRole =
      roleUpdates[systemUser.id] ?? systemUser.role;

    const selectedStatus =
      statusUpdates[systemUser.id] ?? systemUser.status;

    if (
      selectedRole === systemUser.role &&
      selectedStatus === systemUser.status
    ) {
      setError("Change the role or account status before updating.");
      setSuccess("");
      return;
    }

    setUpdatingUserId(systemUser.id);
    setError("");
    setSuccess("");

    try {
      await apiRequest<ActionResponse>(
        `/api/users/${systemUser.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: selectedRole,
            status: selectedStatus,
          }),
        }
      );

      setSuccess(`${systemUser.name} was updated successfully.`);

      await loadUsers();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update user"
      );

      setRoleUpdates((currentValues) => ({
        ...currentValues,
        [systemUser.id]: systemUser.role,
      }));

      setStatusUpdates((currentValues) => ({
        ...currentValues,
        [systemUser.id]: systemUser.status,
      }));
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (loading || !user || user.role !== "ADMIN") {
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
              User management
            </h1>

            <p className="text-sm text-slate-500">
              Create users and manage roles and account access
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

        <form
          onSubmit={handleCreateUser}
          className="mb-8 rounded-2xl bg-white p-6 shadow-sm"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Create user
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Add a new user and select their initial role.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Full name
              </label>

              <input
                id="name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Temporary password
              </label>

              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="new-user-role"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Role
              </label>

              <select
                id="new-user-role"
                value={newUserRole}
                onChange={(event) =>
                  setNewUserRole(event.target.value as UserRole)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={creatingUser}
            className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingUser ? "Creating..." : "Create user"}
          </button>
        </form>

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">
            System users
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Update user roles and activate or deactivate accounts.
          </p>
        </div>

        {loadingUsers ? (
          <p className="text-slate-600">Loading users...</p>
        ) : users.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              No users found
            </h3>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {users.map((systemUser) => {
                  const selectedRole =
                    roleUpdates[systemUser.id] ?? systemUser.role;

                  const selectedStatus =
                    statusUpdates[systemUser.id] ??
                    systemUser.status;

                  const hasChanges =
                    selectedRole !== systemUser.role ||
                    selectedStatus !== systemUser.status;

                  const isCurrentUser = systemUser.id === user.id;

                  return (
                    <tr key={systemUser.id}>
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {systemUser.name}
                          {isCurrentUser && (
                            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              You
                            </span>
                          )}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {systemUser.email}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <select
                          value={selectedRole}
                          onChange={(event) =>
                            setRoleUpdates((currentValues) => ({
                              ...currentValues,
                              [systemUser.id]:
                                event.target.value as UserRole,
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                        >
                          {Object.entries(roleLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <select
                          value={selectedStatus}
                          disabled={isCurrentUser}
                          onChange={(event) =>
                            setStatusUpdates((currentValues) => ({
                              ...currentValues,
                              [systemUser.id]:
                                event.target.value as UserStatus,
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          {Object.entries(statusLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>

                        {isCurrentUser && (
                          <p className="mt-1 text-xs text-slate-400">
                            Your own account cannot be deactivated.
                          </p>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {formatDate(systemUser.created_at)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateUser(systemUser)
                          }
                          disabled={
                            updatingUserId === systemUser.id ||
                            !hasChanges
                          }
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updatingUserId === systemUser.id
                            ? "Updating..."
                            : "Update"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
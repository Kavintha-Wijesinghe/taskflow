"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAuth,
  UserRole,
} from "@/components/auth-provider";
import { apiRequest } from "@/lib/api";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

interface UsersResponse {
  success: boolean;
  users: ManagedUser[];
}

interface CreateUserResponse {
  success: boolean;
  message: string;
  user: ManagedUser;
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrator",
  PROJECT_MANAGER: "Project Manager",
  TEAM_MEMBER: "Team Member",
};

export default function UsersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("TEAM_MEMBER");
  const [creating, setCreating] = useState(false);

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

    async function loadUsers() {
      try {
        const response = await apiRequest<UsersResponse>(
          "/api/users"
        );

        setUsers(response.users);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load users"
        );
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, [loading, user, router]);

  async function handleCreateUser(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setCreating(true);

    try {
      const response = await apiRequest<CreateUserResponse>(
        "/api/users",
        {
          method: "POST",
          body: {
            name,
            email,
            password,
            role,
          },
        }
      );

      setUsers((currentUsers) => [
        response.user,
        ...currentUsers,
      ]);

      setName("");
      setEmail("");
      setPassword("");
      setRole("TEAM_MEMBER");
      setSuccessMessage(response.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create user"
      );
    } finally {
      setCreating(false);
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
              User Management
            </h1>

            <p className="text-sm text-slate-500">
              Manage users, roles, and account access
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

      <section className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        {error && (
          <p className="rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {successMessage && (
          <p className="rounded-lg bg-green-50 p-4 text-green-700">
            {successMessage}
          </p>
        )}

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Create user
          </h2>

          <form
            onSubmit={handleCreateUser}
            className="mt-6 grid gap-5 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Full name
              </label>

              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                minLength={8}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Role
              </label>

              <select
                id="role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as UserRole)
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="TEAM_MEMBER">
                  Team Member
                </option>
                <option value="PROJECT_MANAGER">
                  Project Manager
                </option>
                <option value="ADMIN">
                  Administrator
                </option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create user"}
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              System users
            </h2>
          </div>

          {loadingUsers ? (
            <p className="p-6 text-slate-600">
              Loading users...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-sm text-slate-600">
                  <tr>
                    <th className="px-6 py-3 font-medium">
                      Name
                    </th>
                    <th className="px-6 py-3 font-medium">
                      Email
                    </th>
                    <th className="px-6 py-3 font-medium">
                      Role
                    </th>
                    <th className="px-6 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {users.map((managedUser) => (
                    <tr key={managedUser.id}>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {managedUser.name}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {managedUser.email}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {roleLabels[managedUser.role]}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={
                            managedUser.status === "ACTIVE"
                              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                              : "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
                          }
                        >
                          {managedUser.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const roleLabels = {
  ADMIN: "Administrator",
  PROJECT_MANAGER: "Project Manager",
  TEAM_MEMBER: "Team Member",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
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
              TaskFlow
            </h1>
            <p className="text-sm text-slate-500">
              Project and Team Task Management Platform
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-blue-600">
            {roleLabels[user.role]}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Welcome, {user.name}
          </h2>

          <p className="mt-2 text-slate-600">{user.email}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">
                Projects
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                View and manage project information.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">
                Tasks
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                View assigned tasks and update progress.
              </p>
            </div>

            {user.role === "ADMIN" && (
              <div className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">
                  Users
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Manage users, roles, and account access.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
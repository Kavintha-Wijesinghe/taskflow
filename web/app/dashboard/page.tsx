"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status:
    | "PLANNING"
    | "ACTIVE"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
  start_date: string | null;
  due_date: string | null;
  manager_id: string;
  manager_name: string;
  manager_email: string;
}

interface ProjectsResponse {
  success: boolean;
  projects: Project[];
}

const statusLabels: Record<Project["status"], string> = {
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
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    async function loadProjects() {
      try {
        const response = await apiRequest<ProjectsResponse>("/api/projects");
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
    }

    loadProjects();
  }, [loading, user, router]);

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
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>

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

        {loadingProjects ? (
          <p className="text-slate-600">Loading projects...</p>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              No projects found
            </h2>

            <p className="mt-2 text-slate-500">
              There are no projects available for your account.
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
                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    {statusLabels[project.status]}
                  </span>
                </div>

                <p className="mt-5 text-sm text-slate-600">
                  {project.description || "No description provided."}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Start date</p>

                    <p className="mt-1 font-medium text-slate-900">
                      {formatDate(project.start_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Due date</p>

                    <p className="mt-1 font-medium text-slate-900">
                      {formatDate(project.due_date)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db";
import {
  authenticate,
  authorize,
} from "../middleware/auth.middleware";

const router = Router();

const createProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(2000).optional(),
    status: z
      .enum([
        "PLANNING",
        "ACTIVE",
        "ON_HOLD",
        "COMPLETED",
        "CANCELLED",
      ])
      .default("PLANNING"),
    managerId: z.string().uuid().optional(),
    startDate: z.string().date().optional(),
    dueDate: z.string().date().optional(),
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.dueDate ||
      data.dueDate >= data.startDate,
    {
      message: "Due date must be on or after the start date",
      path: ["dueDate"],
    }
  );

router.use(authenticate);

router.get("/", async (request, response) => {
  try {
    const role = request.auth?.role;
    const userId = request.auth?.userId;

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.status,
        p.start_date,
        p.due_date,
        p.created_at,
        p.updated_at,
        manager.id AS manager_id,
        manager.name AS manager_name,
        manager.email AS manager_email
      FROM projects p
      INNER JOIN users manager ON manager.id = p.manager_id
    `;

    const values: string[] = [];

    if (role === "PROJECT_MANAGER") {
      query += `
        WHERE p.manager_id = $1
      `;
      values.push(userId as string);
    }

    if (role === "TEAM_MEMBER") {
      query += `
        INNER JOIN project_members pm
          ON pm.project_id = p.id
        WHERE pm.user_id = $1
      `;
      values.push(userId as string);
    }

    query += `
      ORDER BY p.created_at DESC
    `;

    const result = await pool.query(query, values);

    return response.status(200).json({
      success: true,
      projects: result.rows,
    });
  } catch (error) {
    console.error("Unable to load projects:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to load projects",
    });
  }
});

router.post(
  "/",
  authorize("ADMIN", "PROJECT_MANAGER"),
  async (request, response) => {
    const validation = createProjectSchema.safeParse(request.body);

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: "Invalid project information",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    try {
      const managerId =
        request.auth?.role === "PROJECT_MANAGER"
          ? request.auth.userId
          : validation.data.managerId;

      if (!managerId) {
        return response.status(400).json({
          success: false,
          message: "A project manager is required",
        });
      }

      const managerResult = await pool.query(
        `
          SELECT id
          FROM users
          WHERE id = $1
            AND status = 'ACTIVE'
            AND role IN ('ADMIN', 'PROJECT_MANAGER')
          LIMIT 1
        `,
        [managerId]
      );

      if (managerResult.rows.length === 0) {
        return response.status(400).json({
          success: false,
          message:
            "The selected manager must be an active Administrator or Project Manager",
        });
      }

      const result = await pool.query(
        `
          INSERT INTO projects (
            name,
            description,
            status,
            manager_id,
            start_date,
            due_date
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING
            id,
            name,
            description,
            status,
            manager_id,
            start_date,
            due_date,
            created_at,
            updated_at
        `,
        [
          validation.data.name,
          validation.data.description ?? null,
          validation.data.status,
          managerId,
          validation.data.startDate ?? null,
          validation.data.dueDate ?? null,
        ]
      );

      return response.status(201).json({
        success: true,
        message: "Project created successfully",
        project: result.rows[0],
      });
    } catch (error) {
      console.error("Unable to create project:", error);

      return response.status(500).json({
        success: false,
        message: "Unable to create project",
      });
    }
  }
);

const addProjectMemberSchema = z.object({
  userId: z.string().uuid(),
});

router.post(
  "/:projectId/members",
  authorize("ADMIN", "PROJECT_MANAGER"),
  async (request, response) => {
    const validation = addProjectMemberSchema.safeParse(request.body);

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: "Invalid team member information",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    try {
      const projectId = request.params.projectId;

      const projectResult =
        request.auth?.role === "ADMIN"
          ? await pool.query(
              `
                SELECT id
                FROM projects
                WHERE id = $1
                LIMIT 1
              `,
              [projectId]
            )
          : await pool.query(
              `
                SELECT id
                FROM projects
                WHERE id = $1
                  AND manager_id = $2
                LIMIT 1
              `,
              [projectId, request.auth?.userId]
            );

      if (projectResult.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: "Project not found or you cannot manage this project",
        });
      }

      const userResult = await pool.query(
        `
          SELECT id, name, email, role, status
          FROM users
          WHERE id = $1
            AND role = 'TEAM_MEMBER'
            AND status = 'ACTIVE'
          LIMIT 1
        `,
        [validation.data.userId]
      );

      if (userResult.rows.length === 0) {
        return response.status(400).json({
          success: false,
          message: "The selected user must be an active Team Member",
        });
      }

      const memberResult = await pool.query(
        `
          INSERT INTO project_members (
            project_id,
            user_id
          )
          VALUES ($1, $2)
          ON CONFLICT (project_id, user_id)
          DO NOTHING
          RETURNING id, project_id, user_id, joined_at
        `,
        [projectId, validation.data.userId]
      );

      if (memberResult.rows.length === 0) {
        return response.status(409).json({
          success: false,
          message: "This user is already assigned to the project",
        });
      }

      return response.status(201).json({
        success: true,
        message: "Team member assigned successfully",
        membership: memberResult.rows[0],
        user: userResult.rows[0],
      });
    } catch (error) {
      console.error("Unable to assign team member:", error);

      return response.status(500).json({
        success: false,
        message: "Unable to assign team member",
      });
    }
  }
);

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).optional(),
    status: z
      .enum([
        "PLANNING",
        "ACTIVE",
        "ON_HOLD",
        "COMPLETED",
        "CANCELLED",
      ])
      .optional(),
    managerId: z.string().uuid().optional(),
    startDate: z.string().date().optional(),
    dueDate: z.string().date().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.managerId !== undefined ||
      data.startDate !== undefined ||
      data.dueDate !== undefined,
    {
      message: "At least one project field must be provided",
    }
  )
  .refine(
    (data) =>
      !data.startDate ||
      !data.dueDate ||
      data.dueDate >= data.startDate,
    {
      message: "Due date must be on or after the start date",
      path: ["dueDate"],
    }
  );

router.patch(
  "/:projectId",
  authorize("ADMIN", "PROJECT_MANAGER"),
  async (request, response) => {
    const validation = updateProjectSchema.safeParse(request.body);

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: "Invalid project information",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    try {
      const projectId = request.params.projectId;

      const projectResult =
        request.auth?.role === "ADMIN"
          ? await pool.query(
              `
                SELECT id, manager_id
                FROM projects
                WHERE id = $1
                LIMIT 1
              `,
              [projectId]
            )
          : await pool.query(
              `
                SELECT id, manager_id
                FROM projects
                WHERE id = $1
                  AND manager_id = $2
                LIMIT 1
              `,
              [projectId, request.auth?.userId]
            );

      if (projectResult.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message: "Project not found or you cannot manage this project",
        });
      }

      let managerId: string | null = null;

      if (validation.data.managerId) {
        if (request.auth?.role !== "ADMIN") {
          return response.status(403).json({
            success: false,
            message: "Only an Administrator can change the project manager",
          });
        }

        const managerResult = await pool.query(
          `
            SELECT id
            FROM users
            WHERE id = $1
              AND status = 'ACTIVE'
              AND role IN ('ADMIN', 'PROJECT_MANAGER')
            LIMIT 1
          `,
          [validation.data.managerId]
        );

        if (managerResult.rows.length === 0) {
          return response.status(400).json({
            success: false,
            message:
              "The selected manager must be an active Administrator or Project Manager",
          });
        }

        managerId = validation.data.managerId;
      }

      const result = await pool.query(
        `
          UPDATE projects
          SET
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            status = COALESCE($3::project_status, status),
            manager_id = COALESCE($4::uuid, manager_id),
            start_date = COALESCE($5::date, start_date),
            due_date = COALESCE($6::date, due_date),
            updated_at = NOW()
          WHERE id = $7
          RETURNING
            id,
            name,
            description,
            status,
            manager_id,
            start_date,
            due_date,
            created_at,
            updated_at
        `,
        [
          validation.data.name ?? null,
          validation.data.description ?? null,
          validation.data.status ?? null,
          managerId,
          validation.data.startDate ?? null,
          validation.data.dueDate ?? null,
          projectId,
        ]
      );

      return response.status(200).json({
        success: true,
        message: "Project updated successfully",
        project: result.rows[0],
      });
    } catch (error: unknown) {
      const databaseError = error as { code?: string };

      if (databaseError.code === "23514") {
        return response.status(400).json({
          success: false,
          message: "Due date must be on or after the start date",
        });
      }

      console.error("Unable to update project:", error);

      return response.status(500).json({
        success: false,
        message: "Unable to update project",
      });
    }
  }
);

export default router;

import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db";
import {
  authenticate,
  authorize,
} from "../middleware/auth.middleware";

const router = Router();

const createTaskSchema = z
  .object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    status: z
      .enum([
        "TODO",
        "IN_PROGRESS",
        "IN_REVIEW",
        "COMPLETED",
        "BLOCKED",
      ])
      .default("TODO"),
    priority: z
      .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
      .default("MEDIUM"),
    progress: z.number().int().min(0).max(100).default(0),
    assigneeId: z.string().uuid(),
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
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.progress,
        t.start_date,
        t.due_date,
        t.created_at,
        t.updated_at,
        p.name AS project_name,
        assignee.id AS assignee_id,
        assignee.name AS assignee_name,
        creator.id AS created_by_id,
        creator.name AS created_by_name
      FROM tasks t
      INNER JOIN projects p
        ON p.id = t.project_id
      LEFT JOIN users assignee
        ON assignee.id = t.assignee_id
      INNER JOIN users creator
        ON creator.id = t.created_by
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
        WHERE t.assignee_id = $1
      `;
      values.push(userId as string);
    }

    query += `
      ORDER BY t.created_at DESC
    `;

    const result = await pool.query(query, values);

    return response.status(200).json({
      success: true,
      tasks: result.rows,
    });
  } catch (error) {
    console.error("Unable to load tasks:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to load tasks",
    });
  }
});

router.post(
  "/",
  authorize("ADMIN", "PROJECT_MANAGER"),
  async (request, response) => {
    const validation = createTaskSchema.safeParse(request.body);

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: "Invalid task information",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    try {
      const projectResult =
        request.auth?.role === "ADMIN"
          ? await pool.query(
              `
                SELECT id
                FROM projects
                WHERE id = $1
                LIMIT 1
              `,
              [validation.data.projectId]
            )
          : await pool.query(
              `
                SELECT id
                FROM projects
                WHERE id = $1
                  AND manager_id = $2
                LIMIT 1
              `,
              [
                validation.data.projectId,
                request.auth?.userId,
              ]
            );

      if (projectResult.rows.length === 0) {
        return response.status(404).json({
          success: false,
          message:
            "Project not found or you cannot manage this project",
        });
      }

      const assigneeResult = await pool.query(
        `
          SELECT u.id, u.name, u.email
          FROM users u
          INNER JOIN project_members pm
            ON pm.user_id = u.id
          WHERE u.id = $1
            AND pm.project_id = $2
            AND u.role = 'TEAM_MEMBER'
            AND u.status = 'ACTIVE'
          LIMIT 1
        `,
        [
          validation.data.assigneeId,
          validation.data.projectId,
        ]
      );

      if (assigneeResult.rows.length === 0) {
        return response.status(400).json({
          success: false,
          message:
            "The assignee must be an active Team Member assigned to this project",
        });
      }

      const result = await pool.query(
        `
          INSERT INTO tasks (
            project_id,
            title,
            description,
            status,
            priority,
            progress,
            assignee_id,
            created_by,
            start_date,
            due_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING
            id,
            project_id,
            title,
            description,
            status,
            priority,
            progress,
            assignee_id,
            created_by,
            start_date,
            due_date,
            created_at,
            updated_at
        `,
        [
          validation.data.projectId,
          validation.data.title,
          validation.data.description ?? null,
          validation.data.status,
          validation.data.priority,
          validation.data.progress,
          validation.data.assigneeId,
          request.auth?.userId,
          validation.data.startDate ?? null,
          validation.data.dueDate ?? null,
        ]
      );

      return response.status(201).json({
        success: true,
        message: "Task created successfully",
        task: result.rows[0],
        assignee: assigneeResult.rows[0],
      });
    } catch (error) {
      console.error("Unable to create task:", error);

      return response.status(500).json({
        success: false,
        message: "Unable to create task",
      });
    }
  }
);

const updateTaskProgressSchema = z
  .object({
    status: z
      .enum([
        "TODO",
        "IN_PROGRESS",
        "IN_REVIEW",
        "COMPLETED",
        "BLOCKED",
      ])
      .optional(),
    progress: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.progress !== undefined,
    {
      message: "Status or progress must be provided",
    }
  )
  .refine(
    (data) =>
      data.status !== "COMPLETED" ||
      data.progress === undefined ||
      data.progress === 100,
    {
      message: "A completed task must have 100 percent progress",
      path: ["progress"],
    }
  );

router.patch(
  "/:taskId/progress",
  async (request, response) => {
    const validation = updateTaskProgressSchema.safeParse(
      request.body
    );

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: "Invalid task progress information",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    try {
      const taskResult = await pool.query(
        `
          SELECT
            t.id,
            t.assignee_id,
            p.manager_id
          FROM tasks t
          INNER JOIN projects p
            ON p.id = t.project_id
          WHERE t.id = $1
          LIMIT 1
        `,
        [request.params.taskId]
      );

      const task = taskResult.rows[0];

      if (!task) {
        return response.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      const role = request.auth?.role;
      const userId = request.auth?.userId;

      const canUpdate =
        role === "ADMIN" ||
        (role === "PROJECT_MANAGER" &&
          task.manager_id === userId) ||
        (role === "TEAM_MEMBER" &&
          task.assignee_id === userId);

      if (!canUpdate) {
        return response.status(403).json({
          success: false,
          message:
            "You do not have permission to update this task",
        });
      }

      const result = await pool.query(
        `
          UPDATE tasks
          SET
            status = COALESCE($1::task_status, status),
            progress = COALESCE($2, progress),
            updated_at = NOW()
          WHERE id = $3
          RETURNING
            id,
            project_id,
            title,
            description,
            status,
            priority,
            progress,
            assignee_id,
            created_by,
            start_date,
            due_date,
            created_at,
            updated_at
        `,
        [
          validation.data.status ?? null,
          validation.data.progress ?? null,
          request.params.taskId,
        ]
      );

      return response.status(200).json({
        success: true,
        message: "Task progress updated successfully",
        task: result.rows[0],
      });
    } catch (error) {
      console.error("Unable to update task progress:", error);

      return response.status(500).json({
        success: false,
        message: "Unable to update task progress",
      });
    }
  }
);

const addTaskCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

router.post(
  "/:taskId/comments",
  async (request, response) => {
    const validation = addTaskCommentSchema.safeParse(request.body);

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: "Invalid comment information",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    try {
      const taskResult = await pool.query(
        `
          SELECT
            t.id,
            t.assignee_id,
            p.manager_id
          FROM tasks t
          INNER JOIN projects p
            ON p.id = t.project_id
          WHERE t.id = $1
          LIMIT 1
        `,
        [request.params.taskId]
      );

      const task = taskResult.rows[0];

      if (!task) {
        return response.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      const role = request.auth?.role;
      const userId = request.auth?.userId;

      const canComment =
        role === "ADMIN" ||
        (role === "PROJECT_MANAGER" &&
          task.manager_id === userId) ||
        (role === "TEAM_MEMBER" &&
          task.assignee_id === userId);

      if (!canComment) {
        return response.status(403).json({
          success: false,
          message:
            "You do not have permission to comment on this task",
        });
      }

      const result = await pool.query(
        `
          INSERT INTO task_comments (
            task_id,
            user_id,
            content
          )
          VALUES ($1, $2, $3)
          RETURNING
            id,
            task_id,
            user_id,
            content,
            created_at,
            updated_at
        `,
        [
          request.params.taskId,
          userId,
          validation.data.content,
        ]
      );

      return response.status(201).json({
        success: true,
        message: "Comment added successfully",
        comment: result.rows[0],
      });
    } catch (error) {
      console.error("Unable to add task comment:", error);

      return response.status(500).json({
        success: false,
        message: "Unable to add task comment",
      });
    }
  }
);


export default router;

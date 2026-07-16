import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../lib/db";
import {
  authenticate,
  authorize,
} from "../middleware/auth.middleware";

const router = Router();

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER"]),
});

router.use(authenticate);
router.use(authorize("ADMIN"));

router.get("/", async (_request, response) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          role,
          status,
          created_at,
          updated_at
        FROM users
        ORDER BY created_at DESC
      `
    );

    return response.status(200).json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error("Unable to load users:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to load users",
    });
  }
});

router.post("/", async (request, response) => {
  const validation = createUserSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Invalid user information",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const existingUser = await pool.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [validation.data.email]
    );

    if (existingUser.rows.length > 0) {
      return response.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(
      validation.data.password,
      12
    );

    const result = await pool.query(
      `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role,
          status
        )
        VALUES ($1, $2, $3, $4, 'ACTIVE')
        RETURNING
          id,
          name,
          email,
          role,
          status,
          created_at,
          updated_at
      `,
      [
        validation.data.name,
        validation.data.email.toLowerCase(),
        passwordHash,
        validation.data.role,
      ]
    );

    return response.status(201).json({
      success: true,
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Unable to create user:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to create user",
    });
  }
});


router.patch("/:id", async (request, response) => {
  const validation = z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      role: z
        .enum(["ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER"])
        .optional(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .refine(
      (data) =>
        data.name !== undefined ||
        data.role !== undefined ||
        data.status !== undefined,
      {
        message: "At least one field must be provided",
      }
    )
    .safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Invalid user information",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  if (
    request.params.id === request.auth?.userId &&
    validation.data.status === "INACTIVE"
  ) {
    return response.status(400).json({
      success: false,
      message: "You cannot deactivate your own account",
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET
          name = COALESCE($1, name),
          role = COALESCE($2, role),
          status = COALESCE($3, status),
          updated_at = NOW()
        WHERE id = $4
        RETURNING
          id,
          name,
          email,
          role,
          status,
          created_at,
          updated_at
      `,
      [
        validation.data.name ?? null,
        validation.data.role ?? null,
        validation.data.status ?? null,
        request.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return response.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return response.status(200).json({
      success: true,
      message: "User updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Unable to update user:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to update user",
    });
  }
});

export default router;

import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { createAuthToken, UserRole } from "../lib/auth";
import { pool } from "../lib/db";
import { authenticate } from "../middleware/auth.middleware";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
}

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const cookieSettings = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "lax" as const,
  path: "/",
};

router.post("/login", async (request, response) => {
  const validation = loginSchema.safeParse(request.body);

  if (!validation.success) {
    return response.status(400).json({
      success: false,
      message: "Invalid login information",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await pool.query<AuthUser>(
      `
        SELECT id, name, email, password_hash, role, status
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [validation.data.email]
    );

    const user = result.rows[0];

    if (!user) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "ACTIVE") {
      return response.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    const passwordMatches = await bcrypt.compare(
      validation.data.password,
      user.password_hash
    );

    if (!passwordMatches) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = createAuthToken(user.id, user.role);

    response.cookie("taskflow_token", token, {
      ...cookieSettings,
      maxAge: 8 * 60 * 60 * 1000,
    });

    return response.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to complete login",
    });
  }
});

router.post("/logout", (_request, response) => {
  response.clearCookie("taskflow_token", cookieSettings);

  return response.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

router.get("/me", authenticate, async (request, response) => {
  try {
    const result = await pool.query<
      Omit<AuthUser, "password_hash">
    >(
      `
        SELECT id, name, email, role, status
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [request.auth?.userId]
    );

    const user = result.rows[0];

    if (!user || user.status !== "ACTIVE") {
      return response.status(401).json({
        success: false,
        message: "User account is unavailable",
      });
    }

    return response.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Unable to load current user:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to load current user",
    });
  }
});

export default router;

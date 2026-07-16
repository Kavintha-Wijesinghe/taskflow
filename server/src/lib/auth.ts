import "dotenv/config";
import jwt from "jsonwebtoken";

export type UserRole = "ADMIN" | "PROJECT_MANAGER" | "TEAM_MEMBER";

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

export function createAuthToken(
  userId: string,
  role: UserRole
): string {
  return jwt.sign(
    {
      userId,
      role,
    },
    getJwtSecret(),
    {
      expiresIn: "8h",
    }
  );
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  if (
    typeof decoded === "string" ||
    typeof decoded.userId !== "string" ||
    !["ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER"].includes(decoded.role)
  ) {
    throw new Error("Invalid authentication token");
  }

  return {
    userId: decoded.userId,
    role: decoded.role as UserRole,
  };
}

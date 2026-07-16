import { NextFunction, Request, Response } from "express";
import {
  AuthTokenPayload,
  UserRole,
  verifyAuthToken,
} from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function authenticate(
  request: Request,
  response: Response,
  next: NextFunction
): Response | void {
  const cookieToken = request.cookies?.taskflow_token as
    | string
    | undefined;

  const authorizationHeader = request.headers.authorization;

  const bearerToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.substring(7)
    : undefined;

  const token = cookieToken || bearerToken;

  if (!token) {
    return response.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    request.auth = verifyAuthToken(token);
    next();
  } catch {
    return response.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (
    request: Request,
    response: Response,
    next: NextFunction
  ): Response | void => {
    if (!request.auth) {
      return response.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(request.auth.role)) {
      return response.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    next();
  };
}

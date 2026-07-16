import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAuthToken,
  verifyAuthToken,
  type UserRole,
} from "../lib/auth";

describe("authentication token utilities", () => {
  beforeEach(() => {
    process.env.JWT_SECRET =
      "taskflow-test-secret-that-is-long-enough-for-automated-tests";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it.each<UserRole>([
    "ADMIN",
    "PROJECT_MANAGER",
    "TEAM_MEMBER",
  ])("creates and verifies a token for the %s role", (role) => {
    const token = createAuthToken("test-user-id", role);
    const payload = verifyAuthToken(token);

    expect(token).toBeTypeOf("string");
    expect(payload).toEqual({
      userId: "test-user-id",
      role,
    });
  });

  it("rejects a token with an invalid signature", () => {
    const token = createAuthToken(
      "test-user-id",
      "TEAM_MEMBER"
    );

    const [header, payload] = token.split(".");
    const tamperedToken =
      `${header}.${payload}.invalid-signature`;

    expect(() => verifyAuthToken(tamperedToken)).toThrow();
  });

  it("rejects a token verified with a different secret", () => {
    const token = createAuthToken(
      "test-user-id",
      "ADMIN"
    );

    process.env.JWT_SECRET =
      "a-different-test-secret-for-verification";

    expect(() => verifyAuthToken(token)).toThrow();
  });

  it("requires JWT_SECRET when creating a token", () => {
    delete process.env.JWT_SECRET;

    expect(() =>
      createAuthToken("test-user-id", "ADMIN")
    ).toThrow("JWT_SECRET is not configured");
  });

  it("requires JWT_SECRET when verifying a token", () => {
    const token = createAuthToken(
      "test-user-id",
      "PROJECT_MANAGER"
    );

    delete process.env.JWT_SECRET;

    expect(() => verifyAuthToken(token)).toThrow(
      "JWT_SECRET is not configured"
    );
  });
});
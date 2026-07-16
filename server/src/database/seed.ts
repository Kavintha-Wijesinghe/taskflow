import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../lib/db";

const demoUsers = [
  {
    name: "System Administrator",
    email: "admin@taskflow.dev",
    password: "Password@123",
    role: "ADMIN",
  },
  {
    name: "Project Manager",
    email: "manager@taskflow.dev",
    password: "Password@123",
    role: "PROJECT_MANAGER",
  },
  {
    name: "Team Member",
    email: "member@taskflow.dev",
    password: "Password@123",
    role: "TEAM_MEMBER",
  },
];

async function seedDatabase(): Promise<void> {
  try {
    for (const user of demoUsers) {
      const passwordHash = await bcrypt.hash(user.password, 12);

      await pool.query(
        `
          INSERT INTO users (
            name,
            email,
            password_hash,
            role,
            status
          )
          VALUES ($1, $2, $3, $4, 'ACTIVE')
          ON CONFLICT (email)
          DO UPDATE SET
            name = EXCLUDED.name,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            status = 'ACTIVE',
            updated_at = NOW()
        `,
        [
          user.name,
          user.email,
          passwordHash,
          user.role,
        ]
      );
    }

    console.log("Demo users created successfully.");
    console.log("Demo password: Password@123");
  } catch (error) {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedDatabase();

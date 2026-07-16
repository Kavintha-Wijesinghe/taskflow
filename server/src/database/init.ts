import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../lib/db";

async function initializeDatabase(): Promise<void> {
  try {
    const schemaPath = path.join(process.cwd(), "database", "schema.sql");
    const schema = await readFile(schemaPath, "utf8");

    await pool.query(schema);

    console.log("Database schema initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initializeDatabase();

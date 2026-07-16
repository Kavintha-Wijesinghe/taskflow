import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

export const pool = new Pool({
  connectionString,
});

export async function testDatabaseConnection(): Promise<Date> {
  const result = await pool.query<{ now: Date }>("SELECT NOW() AS now");
  return result.rows[0].now;
}

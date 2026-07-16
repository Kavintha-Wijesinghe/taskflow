import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { testDatabaseConnection } from "./lib/db";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (_request: Request, response: Response) => {
  response.status(200).json({
    success: true,
    message: "TaskFlow API is running",
  });
});

app.get(
  "/api/health/database",
  async (_request: Request, response: Response) => {
    try {
      const databaseTime = await testDatabaseConnection();

      response.status(200).json({
        success: true,
        message: "PostgreSQL connection is working",
        databaseTime,
      });
    } catch (error) {
      console.error("Database connection failed:", error);

      response.status(500).json({
        success: false,
        message: "PostgreSQL connection failed",
      });
    }
  }
);

app.listen(port, () => {
  console.log("TaskFlow API running at http://localhost:" + port);
});

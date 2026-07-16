import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { testDatabaseConnection } from "./lib/db";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import projectRoutes from "./routes/project.routes";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

app.use("/api/auth", authenticationLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);

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

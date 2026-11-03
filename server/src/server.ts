
import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";

import { database } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";

import { errorHandler } from "./middleware/errorHandler.js";
import { sendErrorResponse } from "./utils/response.js";

const app = express();

// HTTP Request Logging
app.use(
    pinoHttp({
        logger,

        autoLogging: {
            ignore: (request) =>
                request.url === "/api/health",
        },

        serializers: {
            req: (request) => ({
                method: request.method,
                url: request.url,
            }),

            res: (response) => ({
                statusCode: response.statusCode,
            }),
        },
    })
);

// CORS Middleware
app.use(cors());

// JSON Middleware
app.use(express.json());

// Health Check
app.get(
    "/api/health",
    async (_request, response) => {
        try {
            const result = await database.query(
                "SELECT NOW() AS current_time"
            );

            return response.status(200).json({
                success: true,
                message:
                    "RBAC API and database are running",
                databaseTime:
                    result.rows[0].current_time,
            });
        } catch (error) {
            logger.error(
                { err: error },
                "Database connection failed"
            );

            return sendErrorResponse(
                response,
                500,
                "Database connection failed"
            );
        }
    }
);

// Auth Routes
app.use("/api/auth", authRoutes);

// User Routes
app.use("/api/users", userRoutes);

// Role Management Routes
app.use("/api/roles", roleRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Start Server
app.listen(env.port, () => {
    logger.info(
        { port: env.port },
        "RBAC API server started"
    );
});


// Before — Console Logging
// console.log(
//     `Server running on http://localhost:${env.port}`
// );

// After — Pino Logging
// logger.info(
//     { port: env.port },
//     "RBAC API server started"
// );
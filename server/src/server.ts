import cors from "cors";
import express from "express";

import {
    database,
} from "./config/database.js";

import {
    env,
} from "./config/env.js";

import authRoutes
    from "./routes/authRoutes.js";

import userRoutes
    from "./routes/userRoutes.js";

import {
    sendErrorResponse,
} from "./utils/response.js";

import { errorHandler } from "./middleware/errorHandler.js";

const app =
    express();


app.use(
    cors()
);


app.use(
    express.json()
);


// Health Check
app.get(
    "/api/health",
    async (
        _request,
        response
    ) => {

        try {

            const result =
                await database.query(
                    "SELECT NOW() AS current_time"
                );


            return response
                .status(
                    200
                )
                .json({
                    success: true,

                    message:
                        "RBAC API and database are running",

                    databaseTime:
                        result.rows[0]
                            .current_time,
                });

        } catch (
            error
        ) {

            console.error(
                "Database connection failed:",
                error
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
app.use(
    "/api/auth",
    authRoutes
);


// User Routes
app.use(
    "/api/users",
    userRoutes
);


// Error handling middleware
app.use(errorHandler);


// Start Server
app.listen(
    env.port,
    () => {

        console.log(
            `Server running on http://localhost:${env.port}`
        );
    }
);
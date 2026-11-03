
import type {
    NextFunction,
    Response,
} from "express";

import { logger } from "../config/logger.js";

import {
    getUserPermissions,
} from "../services/permissionService.js";

import {
    sendErrorResponse,
} from "../utils/response.js";

import type {
    AuthenticatedRequest,
} from "./authenticate.js";

// Check whether the authenticated user
// currently has the required permission.

export const authorize = (requiredPermission: string) => {
    return async (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction
    ) => {
        try {
            const userId = request.user?.userId;

            if (!userId) {
                return sendErrorResponse(
                    response,
                    401,
                    "User is not authenticated"
                );
            }

            // Fetch current permissions from PostgreSQL
            // using Prisma.
            const permissions = await getUserPermissions(
                userId
            );

            const hasPermission = permissions.includes(
                requiredPermission
            );

            if (!hasPermission) {
                logger.warn(
                    {
                        event: "PERMISSION_DENIED",
                        userId,
                        requiredPermission,
                        method: request.method,
                        path: request.originalUrl,
                    },
                    "Permission denied"
                );

                return sendErrorResponse(
                    response,
                    403,
                    "Permission denied"
                );
            }

            next();

        } catch (error) {
            logger.error(
                {
                    err: error,
                    event: "AUTHORIZATION_ERROR",
                },
                "Authorization failed"
            );

            return sendErrorResponse(
                response,
                500,
                "Internal server error"
            );
        }
    };
};

import type {
    NextFunction,
    Response,
} from "express";

import {
    database,
} from "../config/database.js";

import {
    sendErrorResponse,
} from "../utils/response.js";

import type {
    AuthenticatedRequest,
} from "./authenticate.js";


export const authorize = (
    requiredPermission: string
) => {

    return async (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction
    ) => {

        try {

            const userId =
                request.user?.userId;


            if (!userId) {

                return sendErrorResponse(
                    response,
                    401,
                    "User is not authenticated"
                );
            }


            const permissionResult =
                await database.query(
                    `
                    SELECT p.name
                    FROM user_roles ur
                    JOIN roles r
                        ON r.id = ur.role_id
                    JOIN role_permissions rp
                        ON rp.role_id = r.id
                    JOIN permissions p
                        ON p.id = rp.permission_id
                    WHERE ur.user_id = $1
                      AND p.name = $2
                    `,
                    [
                        userId,
                        requiredPermission,
                    ]
                );


            if (
                permissionResult.rows.length === 0
            ) {

                return sendErrorResponse(
                    response,
                    403,
                    "Permission denied"
                );
            }


            next();

        } catch (
            error
        ) {

            console.error(
                "Authorization failed:",
                error
            );


            return sendErrorResponse(
                response,
                500,
                "Internal server error"
            );
        }
    };
};
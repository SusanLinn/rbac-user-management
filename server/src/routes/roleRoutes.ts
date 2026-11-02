
import { Router } from "express";
import type { Response, NextFunction } from "express";

import { database } from "../config/database.js";
import {
    authenticate,
    type AuthenticatedRequest,
} from "../middleware/authenticate.js";

import {
    getAllRoles,
    createRole,
    updateRole,
} from "../services/roleService.js";

import { sendErrorResponse } from "../utils/response.js";

const router = Router();

// Only ADMIN can manage roles
const requireAdmin = async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
) => {
    try {
        const userId = request.user?.userId;

        if (!userId) {
            return sendErrorResponse(response, 401, "Unauthorized");
        }

        const result = await database.query(
            `
            SELECT 1
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.id = $1
              AND u.is_active = true
              AND r.name = 'ADMIN'
            LIMIT 1
            `,
            [userId]
        );

        if (result.rows.length === 0) {
            return sendErrorResponse(response, 403, "Admin access required");
        }

        next();
    } catch (error) {
        next(error);
    }
};

// GET all roles with permissions
router.get("/", authenticate, requireAdmin, async (
    _request,
    response,
    next
) => {
    try {
        const roles = await getAllRoles();

        return response.status(200).json({
            success: true,
            roles,
        });
    } catch (error) {
        next(error);
    }
});

// CREATE a role with permissions
router.post("/", authenticate, requireAdmin, async (
    request,
    response,
    next
) => {
    try {
        const { name, description = "", permissions } = request.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof description !== "string" ||
            !Array.isArray(permissions) ||
            !permissions.every((p) => typeof p === "string")
        ) {
            return sendErrorResponse(response, 400, "Invalid role data");
        }

        const role = await createRole(
            name,
            description,
            permissions
        );

        console.info("[ROLE_CREATED]", {
            roleId: role.id,
            roleName: role.name,
            permissions: role.permissions,
            createdAt: new Date().toISOString(),
        });

        return response.status(201).json({
            success: true,
            message: "Role created successfully",
            role,
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "Role already exists") {
                return sendErrorResponse(response, 409, error.message);
            }

            if (
                error.message === "Invalid permission" ||
                error.message === "Permission not found in database"
            ) {
                return sendErrorResponse(response, 400, error.message);
            }
        }

        next(error);
    }
});


router.put(
    "/:id",
    authenticate,
    requireAdmin,
    async (request, response, next) => {
        try {
            const { id } = request.params;
            const { name, description, permissions } = request.body;

            if (
                typeof id !== "string" ||
                typeof name !== "string" ||
                !name.trim() ||
                typeof description !== "string" ||
                !Array.isArray(permissions) ||
                !permissions.every(
                    (permission) => typeof permission === "string"
                )
            ) {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid role data"
                );
            }

            const role = await updateRole(
                id,
                name,
                description,
                permissions
            );

            if (!role) {
                return sendErrorResponse(
                    response,
                    404,
                    "Role not found"
                );
            }

            return response.status(200).json({
                success: true,
                message: "Role updated successfully",
                role,
            });

        } catch (error) {
            if (error instanceof Error) {
                if (error.message === "Role already exists") {
                    return sendErrorResponse(response, 409, error.message);
                }

                if (
                    [
                        "System roles cannot be edited",
                        "Invalid role name",
                        "Invalid permission",
                        "Permission not found in database",
                    ].includes(error.message)
                ) {
                    return sendErrorResponse(response, 400, error.message);
                }
            }

            next(error);
        }
    }
);


export default router;

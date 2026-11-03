import { Router } from "express";
import type { Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { authenticate, type AuthenticatedRequest } from "../middleware/authenticate.js";
import { getAllRoles, createRole, updateRole } from "../services/roleService.js";
import { sendErrorResponse } from "../utils/response.js";

const router = Router();

interface RoleBody {
    name?: unknown;
    description?: unknown;
    permissions?: unknown;
}

const isAdmin = async (userId: string): Promise<boolean> => {
    const user = await prisma.users.findFirst({
        where: {
            id: userId,
            is_active: true,
            user_roles: { some: { roles: { name: "ADMIN" } } },
        },
        select: { id: true },
    });
    return user !== null;
};

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
        if (!(await isAdmin(userId))) {
            return sendErrorResponse(response, 403, "Admin access required");
        }
        next();
    } catch (error) {
        next(error);
    }
};

const isValidRoleBody = (
    body: RoleBody,
    requireDescription: boolean
): boolean => {
    return (
        typeof body.name === "string" &&
        body.name.trim().length > 0 &&
        (requireDescription
            ? typeof body.description === "string"
            : body.description === undefined || typeof body.description === "string") &&
        Array.isArray(body.permissions) &&
        body.permissions.every((permission: unknown) => typeof permission === "string")
    );
};

const handleRoleError = (error: unknown, response: Response): boolean => {
    if (error instanceof Error) {
        if (error.message === "Role already exists") {
            sendErrorResponse(response, 409, error.message);
            return true;
        }
        if ([
            "Role name is required",
            "System roles cannot be edited",
            "Invalid role name",
            "Invalid permission",
            "Permission not found in database",
        ].includes(error.message)) {
            sendErrorResponse(response, 400, error.message);
            return true;
        }
    }
    if (typeof error === "object" && error !== null && "code" in error) {
        if (error.code === "P2002") {
            sendErrorResponse(response, 409, "Role already exists");
            return true;
        }
        if (error.code === "P2034") {
            sendErrorResponse(response, 409, "Concurrent role update; please retry");
            return true;
        }
    }
    return false;
};

// ADMIN, users.create, or users.update may list roles.
router.get("/", authenticate, async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
) => {
    try {
        const userId = request.user?.userId;
        if (!userId) {
            return sendErrorResponse(response, 401, "Unauthorized");
        }
        const user = await prisma.users.findFirst({
            where: {
                id: userId,
                is_active: true,
                user_roles: {
                    some: {
                        roles: {
                            OR: [
                                { name: "ADMIN" },
                                { role_permissions: {
                                    some: { permissions: { name: { in: ["users.create", "users.update"] } } },
                                } },
                            ],
                        },
                    },
                },
            },
            select: { id: true },
        });
        if (!user) {
            return sendErrorResponse(response, 403, "Permission denied");
        }
        const roles = await getAllRoles();
        return response.status(200).json({ success: true, roles });
    } catch (error) {
        next(error);
    }
});

router.post("/", authenticate, requireAdmin, async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
) => {
    try {
        const body = (request.body ?? {}) as RoleBody;
        if (!isValidRoleBody(body, false)) {
            return sendErrorResponse(response, 400, "Invalid role data");
        }
        const role = await createRole(body.name as string, (body.description ?? "") as string, body.permissions as string[]);
        logger.info({
            event: "ROLE_CREATED",
            roleId: role.id,
            roleName: role.name,
            permissions: role.permissions,
            performedBy: request.user?.userId,
        }, "Role created successfully");
        return response.status(201).json({ success: true, message: "Role created successfully", role });
    } catch (error) {
        if (handleRoleError(error, response)) return;
        next(error);
    }
});

router.put("/:id", authenticate, requireAdmin, async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
) => {
    try {
        const { id } = request.params;
        const body = (request.body ?? {}) as RoleBody;
        if (typeof id !== "string" || !isValidRoleBody(body, true)) {
            return sendErrorResponse(response, 400, "Invalid role data");
        }
        const role = await updateRole(id, body.name as string, body.description as string, body.permissions as string[]);
        if (!role) {
            return sendErrorResponse(response, 404, "Role not found");
        }
        logger.info({
            event: "ROLE_UPDATED",
            roleId: role.id,
            roleName: role.name,
            permissions: role.permissions,
            performedBy: request.user?.userId,
        }, "Role updated successfully");
        return response.status(200).json({ success: true, message: "Role updated successfully", role });
    } catch (error) {
        if (handleRoleError(error, response)) return;
        next(error);
    }
});

export default router;

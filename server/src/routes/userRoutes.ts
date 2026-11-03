
import { Router } from "express";
import type { Response, NextFunction } from "express";

import { database } from "../config/database.js";

import {
    authenticate,
    type AuthenticatedRequest,
} from "../middleware/authenticate.js";

import { authorize } from "../middleware/authorize.js";

import {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
} from "../services/userService.js";

import { sendErrorResponse } from "../utils/response.js";

const router = Router();

// ==================== TYPES ====================

interface CreateUserBody {
    fullName?: string;
    email?: string;
    password?: string;
    role?: string;
}

interface UpdateUserBody {
    fullName?: string;
    email?: string;
    isActive?: boolean;
    role?: string;
}

// ==================== VALIDATION HELPERS ====================

// Check whether a value is a non-empty string.
const isNonEmptyString = (value: unknown): value is string => {
    return typeof value === "string" && value.trim().length > 0;
};

// Validate email format.
const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Validate minimum password length.
const isValidPassword = (password: string): boolean => {
    return password.length >= 8;
};

// Detect PostgreSQL unique constraint violations.
const isUniqueViolation = (error: unknown): boolean => {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
    );
};

// ==================== SECURITY HELPERS ====================

// Check whether the logged-in user currently has the ADMIN role.
// Always check PostgreSQL instead of trusting the JWT role.
const isCurrentUserAdmin = async (
    userId: string
): Promise<boolean> => {
    const result = await database.query(
        `
        SELECT 1
        FROM users u
        JOIN user_roles ur
            ON ur.user_id = u.id
        JOIN roles r
            ON r.id = ur.role_id
        WHERE u.id = $1
          AND u.is_active = true
          AND r.name = 'ADMIN'
        LIMIT 1
        `,
        [userId]
    );

    return result.rows.length > 0;
};

// Check whether the target user currently has the ADMIN role.
const isTargetUserAdmin = async (
    targetUserId: string
): Promise<boolean> => {
    const result = await database.query(
        `
        SELECT 1
        FROM user_roles ur
        JOIN roles r
            ON r.id = ur.role_id
        WHERE ur.user_id = $1
          AND r.name = 'ADMIN'
        LIMIT 1
        `,
        [targetUserId]
    );

    return result.rows.length > 0;
};

// ==================== GET ALL USERS ====================

// Required permission: users.read
router.get(
    "/",
    authenticate,
    authorize("users.read"),
    async (_request, response, next) => {
        try {
            const users = await getAllUsers();

            return response.status(200).json({
                success: true,
                users,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== GET USER BY ID ====================

// Required permission: users.read
router.get(
    "/:id",
    authenticate,
    authorize("users.read"),
    async (request, response, next) => {
        try {
            const { id } = request.params;

            if (typeof id !== "string") {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid user ID"
                );
            }

            const user = await getUserById(id);

            if (!user) {
                return sendErrorResponse(
                    response,
                    404,
                    "User not found"
                );
            }

            return response.status(200).json({
                success: true,
                user,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== CREATE USER ====================

// Required permission: users.create
//
// Security rules:
// 1. ADMIN can create users with any existing role.
// 2. Non-ADMIN users cannot assign the ADMIN role.
// 3. Direct API requests are protected by backend checks.

router.post(
    "/",
    authenticate,
    authorize("users.create"),
    async (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction
    ) => {
        try {
            const {
                fullName,
                email,
                password,
                role = "USER",
            } = request.body as CreateUserBody;

            // Validate required fields.
            if (
                !isNonEmptyString(fullName) ||
                !isNonEmptyString(email) ||
                !isNonEmptyString(password)
            ) {
                return sendErrorResponse(
                    response,
                    400,
                    "Full name, email and password are required"
                );
            }

            // Validate email.
            if (!isValidEmail(email.trim())) {
                return sendErrorResponse(
                    response,
                    400,
                    "Please provide a valid email address"
                );
            }

            // Validate password.
            if (!isValidPassword(password)) {
                return sendErrorResponse(
                    response,
                    400,
                    "Password must be at least 8 characters long"
                );
            }

            // Validate role.
            if (!isNonEmptyString(role)) {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid role"
                );
            }

            const requestedRole = role.trim();

            const currentUserId = request.user?.userId;

            if (!currentUserId) {
                return sendErrorResponse(
                    response,
                    401,
                    "Unauthorized"
                );
            }

            // SECURITY:
            // Only ADMIN can create another ADMIN user.
            if (requestedRole === "ADMIN") {
                const isAdmin = await isCurrentUserAdmin(
                    currentUserId
                );

                if (!isAdmin) {
                    return sendErrorResponse(
                        response,
                        403,
                        "Only ADMIN can create another ADMIN user"
                    );
                }
            }

            // Create user and assign role.
            const user = await createUser(
                fullName.trim(),
                email.trim(),
                password,
                requestedRole
            );

            if (!user) {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid role"
                );
            }

            return response.status(201).json({
                success: true,
                message: "User created successfully",
                user,
            });

        } catch (error) {
            if (isUniqueViolation(error)) {
                return sendErrorResponse(
                    response,
                    409,
                    "Email already exists"
                );
            }

            next(error);
        }
    }
);

// ==================== UPDATE USER ====================

// Required permission: users.update
//
// Security rules:
// 1. ADMIN can update any user.
// 2. Non-ADMIN users cannot assign the ADMIN role.
// 3. Non-ADMIN users cannot modify existing ADMIN accounts.

router.put(
    "/:id",
    authenticate,
    authorize("users.update"),
    async (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction
    ) => {
        try {
            const { id } = request.params;

            const {
                fullName,
                email,
                isActive,
                role,
            } = request.body as UpdateUserBody;

            // Validate user ID.
            if (typeof id !== "string") {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid user ID"
                );
            }

            // Validate required fields.
            if (
                !isNonEmptyString(fullName) ||
                !isNonEmptyString(email) ||
                typeof isActive !== "boolean" ||
                !isNonEmptyString(role)
            ) {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid user data"
                );
            }

            // Validate email.
            if (!isValidEmail(email.trim())) {
                return sendErrorResponse(
                    response,
                    400,
                    "Please provide a valid email address"
                );
            }

            const currentUserId = request.user?.userId;

            if (!currentUserId) {
                return sendErrorResponse(
                    response,
                    401,
                    "Unauthorized"
                );
            }

            const requestedRole = role.trim();

            const isAdmin = await isCurrentUserAdmin(
                currentUserId
            );

            // SECURITY:
            // Non-ADMIN users cannot assign ADMIN roles
            // or modify existing ADMIN accounts.
            if (!isAdmin) {
                if (requestedRole === "ADMIN") {
                    return sendErrorResponse(
                        response,
                        403,
                        "Only ADMIN can assign the ADMIN role"
                    );
                }

                const targetIsAdmin = await isTargetUserAdmin(
                    id
                );

                if (targetIsAdmin) {
                    return sendErrorResponse(
                        response,
                        403,
                        "Only ADMIN can modify ADMIN accounts"
                    );
                }
            }

            // Update user details and role.
            const user = await updateUser(
                id,
                fullName.trim(),
                email.trim(),
                isActive,
                requestedRole
            );

            if (!user) {
                return sendErrorResponse(
                    response,
                    404,
                    "User not found"
                );
            }

            if ("invalidRole" in user) {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid role"
                );
            }

            return response.status(200).json({
                success: true,
                message: "User updated successfully",
                user,
            });

        } catch (error) {
            if (isUniqueViolation(error)) {
                return sendErrorResponse(
                    response,
                    409,
                    "Email already exists"
                );
            }

            next(error);
        }
    }
);

// ==================== DELETE USER ====================

// Required permission: users.delete
//
// Additional security:
// Only ADMIN can delete an ADMIN account.

router.delete(
    "/:id",
    authenticate,
    authorize("users.delete"),
    async (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction
    ) => {
        try {
            const { id } = request.params;

            if (typeof id !== "string") {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid user ID"
                );
            }

            const currentUserId = request.user?.userId;

            if (!currentUserId) {
                return sendErrorResponse(
                    response,
                    401,
                    "Unauthorized"
                );
            }

            // Prevent deleting an ADMIN account
            // unless the current user is ADMIN.
            const targetIsAdmin = await isTargetUserAdmin(id);

            if (targetIsAdmin) {
                const isAdmin = await isCurrentUserAdmin(
                    currentUserId
                );

                if (!isAdmin) {
                    return sendErrorResponse(
                        response,
                        403,
                        "Only ADMIN can delete ADMIN accounts"
                    );
                }
            }

            const user = await deleteUser(id);

            if (!user) {
                return sendErrorResponse(
                    response,
                    404,
                    "User not found"
                );
            }

            return response.status(200).json({
                success: true,
                message: "User deleted successfully",
                user,
            });

        } catch (error) {
            next(error);
        }
    }
);

export default router;

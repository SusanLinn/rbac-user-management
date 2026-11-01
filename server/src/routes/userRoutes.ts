
import { Router } from "express";

import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

import { sendErrorResponse } from "../utils/response.js";

import {
    createUser,
    deleteUser,
    getAllUsers,
    getUserById,
    updateUser,
} from "../services/userService.js";

import {
    getMissingFields,
    isValidEmail,
    isValidPassword,
} from "../utils/validation.js";

const router = Router();

// Check PostgreSQL unique constraint violation
const isUniqueViolation = (error: unknown): boolean => {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
    );
};

// GET ALL USERS
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
            return next(error);
        }
    }
);

// GET USER BY ID
router.get(
    "/:id",
    authenticate,
    authorize("users.read"),
    async (request, response, next) => {
        try {
            const idParam = request.params.id;
            const id = Array.isArray(idParam)
                ? idParam[0]
                : idParam;

            if (!id) {
                return sendErrorResponse(
                    response,
                    400,
                    "User ID is required"
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
            return next(error);
        }
    }
);

// CREATE USER
router.post(
    "/",
    authenticate,
    authorize("users.create"),
    async (request, response, next) => {
        try {
            const {
                fullName,
                email,
                password,
                role = "USER",
            } = request.body;

            const missingFields = getMissingFields({
                fullName,
                email,
                password,
            });

            if (missingFields.length > 0) {
                return sendErrorResponse(
                    response,
                    400,
                    `Missing required fields: ${missingFields.join(", ")}`
                );
            }

            if (!isValidEmail(email)) {
                return sendErrorResponse(
                    response,
                    400,
                    "Please provide a valid email address"
                );
            }

            if (!isValidPassword(password)) {
                return sendErrorResponse(
                    response,
                    400,
                    "Password must be at least 8 characters long"
                );
            }

            const user = await createUser(
                fullName,
                email,
                password,
                role
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

            return next(error);
        }
    }
);

// UPDATE USER
router.put(
    "/:id",
    authenticate,
    authorize("users.update"),
    async (request, response, next) => {
        try {
            const idParam = request.params.id;
            const id = Array.isArray(idParam)
                ? idParam[0]
                : idParam;

            if (!id) {
                return sendErrorResponse(
                    response,
                    400,
                    "User ID is required"
                );
            }

            const {
                fullName,
                email,
                isActive,
                role,
            } = request.body;

            const missingFields = getMissingFields({
                fullName,
                email,
                isActive,
                role,
            });

            if (missingFields.length > 0) {
                return sendErrorResponse(
                    response,
                    400,
                    `Missing required fields: ${missingFields.join(", ")}`
                );
            }

            if (typeof fullName !== "string") {
                return sendErrorResponse(
                    response,
                    400,
                    "Full name must be a string"
                );
            }

            if (!isValidEmail(email)) {
                return sendErrorResponse(
                    response,
                    400,
                    "Please provide a valid email address"
                );
            }

            if (typeof isActive !== "boolean") {
                return sendErrorResponse(
                    response,
                    400,
                    "isActive must be a boolean"
                );
            }

            if (typeof role !== "string") {
                return sendErrorResponse(
                    response,
                    400,
                    "Role must be a string"
                );
            }

            const user = await updateUser(
                id,
                fullName.trim(),
                email.trim(),
                isActive,
                role.trim()
            );

            if (user && "invalidRole" in user) {
                return sendErrorResponse(
                    response,
                    400,
                    "Invalid role"
                );
            }

            if (!user) {
                return sendErrorResponse(
                    response,
                    404,
                    "User not found"
                );
            }

            return response.status(200).json({
                success: true,
                message: "User updated successfully",
                user,
            });
        } catch (error) {
            return next(error);
        }
    }
);

// DELETE USER
router.delete(
    "/:id",
    authenticate,
    authorize("users.delete"),
    async (request, response, next) => {
        try {
            const idParam = request.params.id;
            const id = Array.isArray(idParam)
                ? idParam[0]
                : idParam;

            if (!id) {
                return sendErrorResponse(
                    response,
                    400,
                    "User ID is required"
                );
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
            return next(error);
        }
    }
);

export default router;

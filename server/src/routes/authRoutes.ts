import {
    Router,
} from "express";

import {
    authenticate,
    type AuthenticatedRequest,
} from "../middleware/authenticate.js";

import {
    loginUser,
} from "../services/authService.js";

import {
    sendErrorResponse,
} from "../utils/response.js";

import { getUserPermissions } from "../services/permissionService.js";

const router =
    Router();


router.post(
    "/login",
    async (
        request,
        response
    ) => {

        try {

            const {
                email,
                password,
            } =
                request.body;


            if (
                !email ||
                !password
            ) {

                return sendErrorResponse(
                    response,
                    400,
                    "Email and password are required"
                );
            }


            const result =
                await loginUser(
                    email,
                    password
                );


            if (
                !result.success
            ) {

                if (
                    result.reason === "INACTIVE"
                ) {

                    return sendErrorResponse(
                        response,
                        403,
                        "User account is inactive"
                    );
                }


                return sendErrorResponse(
                    response,
                    401,
                    "Invalid email or password"
                );
            }


            return response
                .status(
                    200
                )
                .json({
                    success: true,

                    message:
                        "Login successful",

                    token:
                        result.token,
                });

        } catch (
            error
        ) {

            console.error(
                "Login failed:",
                error
            );


            return sendErrorResponse(
                response,
                500,
                "Internal server error"
            );
        }
    }
);



router.get(
    "/profile",
    authenticate,
    async (
        request: AuthenticatedRequest,
        response
    ) => {
        try {
            const user = request.user;

            if (!user) {
                return sendErrorResponse(
                    response,
                    401,
                    "Unauthorized"
                );
            }

            const permissions = await getUserPermissions(
                user.userId
            );

            return response.status(200).json({
                success: true,
                message: "Protected profile accessed",
                user: {
                    ...user,
                    permissions,
                },
            });

        } catch (error) {
            console.error("Profile failed:", error);

            return sendErrorResponse(
                response,
                500,
                "Internal server error"
            );
        }
    }
);



export default router;
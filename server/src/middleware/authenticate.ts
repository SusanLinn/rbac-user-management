
import type {
    NextFunction,
    Request,
    Response,
} from "express";

import { verifyToken } from "../utils/token.js";
import { sendErrorResponse } from "../utils/response.js";

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: string;
    };
}

export const authenticate = (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
) => {
    try {
        const authorizationHeader =
            request.headers.authorization;

        if (
            !authorizationHeader ||
            !authorizationHeader.startsWith("Bearer ")
        ) {
            return sendErrorResponse(
                response,
                401,
                "Authorization token is required"
            );
        }

        const token = authorizationHeader.split(" ")[1];

        if (!token) {
            return sendErrorResponse(
                response,
                401,
                "Authorization token is required"
            );
        }

        const decodedToken = verifyToken(token);

        if (
            typeof decodedToken === "string" ||
            typeof decodedToken.userId !== "string" ||
            typeof decodedToken.email !== "string" ||
            typeof decodedToken.role !== "string" ||
            !decodedToken.role.trim()
        ) {
            return sendErrorResponse(
                response,
                401,
                "Invalid token payload"
            );
        }

        request.user = {
            userId: decodedToken.userId,
            email: decodedToken.email,
            role: decodedToken.role,
        };

        next();

    } catch (error) {
        return sendErrorResponse(
            response,
            401,
            "Invalid or expired token"
        );
    }
};

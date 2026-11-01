import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next
): void => {
    console.error("Unhandled Error:", error);

    response.status(500).json({
        success: false,
        message: "Internal server error",
    });
};
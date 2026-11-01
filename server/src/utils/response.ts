import type {
    Response,
} from "express";


export const sendErrorResponse = (
    response: Response,
    statusCode: number,
    message: string
) => {

    return response
        .status(
            statusCode
        )
        .json({
            success:
                false,

            message:
                message,
        });
};
import jwt from "jsonwebtoken";

import {
    env,
} from "../config/env.js";

export const generateToken = (
    userId: string,
    email: string,
    role: string
): string => {

    //JWT token create
    const token =
        jwt.sign(       //JWT token တစ်ခု create လုပ်ပြီး secret နဲ့ sign လုပ်ပါ
            {
                userId,
                email,
                role,
            },
            env.jwtSecret,
            {
                expiresIn: "1h",
            }
        );

    return token;
};

export const verifyToken = (
    token: string
) => {

    const decodedToken =
        jwt.verify(
            token,
            env.jwtSecret
        );

    return decodedToken;
};
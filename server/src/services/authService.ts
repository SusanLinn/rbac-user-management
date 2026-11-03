
import { prisma } from "../config/prisma.js";
import { comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/token.js";

export const loginUser = async (
    email: string,
    password: string
) => {
    const user = await prisma.users.findUnique({
        where: {
            email,
        },
        select: {
            id: true,
            full_name: true,
            email: true,
            password_hash: true,
            is_active: true,
            user_roles: {
                select: {
                    roles: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    });

    if (!user || user.user_roles.length === 0) {
        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    if (!user.is_active) {
        return {
            success: false,
            reason: "INACTIVE",
        };
    }

    const passwordMatches = await comparePassword(
        password,
        user.password_hash
    );

    if (!passwordMatches) {
        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    const role = user.user_roles[0]?.roles.name;

    if (
        typeof role !== "string" ||
        !role.trim()
    ) {
        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    const token = generateToken(
        user.id,
        user.email,
        role
    );

    return {
        success: true,
        token,
    };
};

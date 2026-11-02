
import { database } from "../config/database.js";
import { comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/token.js";

export const loginUser = async (
    email: string,
    password: string
) => {
    const userResult = await database.query(
        `
        SELECT
            u.id,
            u.full_name,
            u.email,
            u.password_hash,
            u.is_active,
            r.name AS role
        FROM users u
        INNER JOIN user_roles ur
            ON ur.user_id = u.id
        INNER JOIN roles r
            ON r.id = ur.role_id
        WHERE u.email = $1
        `,
        [email]
    );

    if (userResult.rows.length === 0) {
        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    const user = userResult.rows[0];

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

    if (
        typeof user.role !== "string" ||
        !user.role.trim()
    ) {
        return {
            success: false,
            reason: "INVALID_CREDENTIALS",
        };
    }

    const token = generateToken(
        user.id,
        user.email,
        user.role
    );

    return {
        success: true,
        token,
    };
};

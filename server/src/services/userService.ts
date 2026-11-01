
import {
    database,
} from "../config/database.js";

import {
    hashPassword,
} from "../utils/password.js";


export const getAllUsers = async () => {

    const result =
        await database.query(
            `
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.is_active,
                u.created_at,
                u.updated_at,
                r.name AS role
            FROM users u
            LEFT JOIN user_roles ur
                ON ur.user_id = u.id
            LEFT JOIN roles r
                ON r.id = ur.role_id
            ORDER BY u.created_at DESC
            `
        );


    return result.rows;
};


export const getUserById = async (
    id: string
) => {

    const result =
        await database.query(
            `
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.is_active,
                u.created_at,
                u.updated_at,
                r.name AS role
            FROM users u
            LEFT JOIN user_roles ur
                ON ur.user_id = u.id
            LEFT JOIN roles r
                ON r.id = ur.role_id
            WHERE u.id = $1
            `,
            [
                id,
            ]
        );


    return result.rows[0];
};


export const createUser = async (
    fullName: string,
    email: string,
    password: string,
    role: string
) => {

    const client =
        await database.connect();


    try {

        await client.query(
            "BEGIN"
        );


        const hashedPassword =
            await hashPassword(
                password
            );


        const userResult =
            await client.query(
                `
                INSERT INTO users (
                    full_name,
                    email,
                    password_hash
                )
                VALUES ($1, $2, $3)
                RETURNING
                    id,
                    full_name,
                    email,
                    is_active,
                    created_at
                `,
                [
                    fullName,
                    email,
                    hashedPassword,
                ]
            );


        const user =
            userResult.rows[0];


        const roleResult =
            await client.query(
                `
                SELECT id
                FROM roles
                WHERE name = $1
                `,
                [
                    role,
                ]
            );


        if (
            roleResult.rows.length === 0
        ) {

            await client.query(
                "ROLLBACK"
            );

            return null;
        }


        const roleId =
            roleResult.rows[0].id;


        await client.query(
            `
            INSERT INTO user_roles (
                user_id,
                role_id
            )
            VALUES ($1, $2)
            `,
            [
                user.id,
                roleId,
            ]
        );


        await client.query(
            "COMMIT"
        );


        return {
            ...user,
            role,
        };

    } catch (
        error
    ) {

        await client.query(
            "ROLLBACK"
        );

        throw error;

    } finally {

        client.release();
    }
};


export const updateUser = async (
    id: string,
    fullName: string,
    email: string,
    isActive: boolean,
    role: string
) => {

    const client =
        await database.connect();


    try {

        await client.query(
            "BEGIN"
        );


        const userResult =
            await client.query(
                `
                UPDATE users
                SET
                    full_name = $1,
                    email = $2,
                    is_active = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING
                    id,
                    full_name,
                    email,
                    is_active,
                    created_at,
                    updated_at
                `,
                [
                    fullName,
                    email,
                    isActive,
                    id,
                ]
            );


        if (
            userResult.rows.length === 0
        ) {

            await client.query(
                "ROLLBACK"
            );

            return null;
        }


        const roleResult =
            await client.query(
                `
                SELECT id
                FROM roles
                WHERE name = $1
                `,
                [
                    role,
                ]
            );


        if (
            roleResult.rows.length === 0
        ) {

            await client.query(
                "ROLLBACK"
            );

            return {
                invalidRole: true,
            };
        }


        const roleId =
            roleResult.rows[0].id;


        await client.query(
            `
            DELETE FROM user_roles
            WHERE user_id = $1
            `,
            [
                id,
            ]
        );


        await client.query(
            `
            INSERT INTO user_roles (
                user_id,
                role_id
            )
            VALUES ($1, $2)
            `,
            [
                id,
                roleId,
            ]
        );


        await client.query(
            "COMMIT"
        );


        return {
            ...userResult.rows[0],
            role,
        };

    } catch (
        error
    ) {

        await client.query(
            "ROLLBACK"
        );

        throw error;

    } finally {

        client.release();
    }
};


export const deleteUser = async (
    id: string
) => {

    const result =
        await database.query(
            `
            DELETE FROM users
            WHERE id = $1
            RETURNING
                id,
                full_name,
                email
            `,
            [
                id,
            ]
        );


    return result.rows[0];
};

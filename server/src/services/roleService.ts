
import { randomUUID } from "node:crypto";
import { database } from "../config/database.js";

const allowedPermissions = [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
];

export const getAllRoles = async () => {
    const result = await database.query(`
        SELECT
            r.id,
            r.name,
            r.description,
            COALESCE(
                array_agg(p.name)
                FILTER (WHERE p.name IS NOT NULL),
                '{}'
            ) AS permissions
        FROM roles r
        LEFT JOIN role_permissions rp
            ON rp.role_id = r.id
        LEFT JOIN permissions p
            ON p.id = rp.permission_id
        GROUP BY r.id, r.name, r.description
        ORDER BY r.name
    `);

    return result.rows;
};

export const createRole = async (
    name: string,
    description: string,
    permissions: string[]
) => {
    const client = await database.connect();

    try {
        await client.query("BEGIN");

        const roleName = name.trim().toUpperCase();
        const selectedPermissions = [...new Set(permissions)];

        if (!roleName) {
            throw new Error("Role name is required");
        }

        if (
            selectedPermissions.some(
                (permission) =>
                    !allowedPermissions.includes(permission)
            )
        ) {
            throw new Error("Invalid permission");
        }

        const existingRole = await client.query(
            "SELECT id FROM roles WHERE LOWER(name) = LOWER($1)",
            [roleName]
        );

        if (existingRole.rows.length > 0) {
            throw new Error("Role already exists");
        }

        const permissionResult = await client.query(
            "SELECT id FROM permissions WHERE name = ANY($1::text[])",
            [selectedPermissions]
        );

        if (
            permissionResult.rows.length !==
            selectedPermissions.length
        ) {
            throw new Error("Permission not found in database");
        }

        const roleId = randomUUID();

        await client.query(
            `INSERT INTO roles (id, name, description)
             VALUES ($1, $2, $3)`,
            [roleId, roleName, description.trim()]
        );

        for (const permission of permissionResult.rows) {
            await client.query(
                `INSERT INTO role_permissions
                 (role_id, permission_id)
                 VALUES ($1, $2)`,
                [roleId, permission.id]
            );
        }

        await client.query("COMMIT");

        return {
            id: roleId,
            name: roleName,
            description: description.trim(),
            permissions: selectedPermissions,
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

};


export const updateRole = async (
    id: string,
    name: string,
    description: string,
    permissions: string[]
) => {
    const client = await database.connect();

    try {
        await client.query("BEGIN");

        const existingRole = await client.query(
            "SELECT name FROM roles WHERE id = $1 FOR UPDATE",
            [id]
        );

        if (existingRole.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        if (existingRole.rows[0].name.toUpperCase() === "ADMIN") {
            throw new Error("System roles cannot be edited");
        }

        const roleName = name.trim().toUpperCase();
        const selectedPermissions = [...new Set(permissions)];

        if (!roleName || roleName === "ADMIN") {
            throw new Error("Invalid role name");
        }

        if (
            selectedPermissions.some(
                (permission) => !allowedPermissions.includes(permission)
            )
        ) {
            throw new Error("Invalid permission");
        }

        const duplicate = await client.query(
            `SELECT id FROM roles
             WHERE LOWER(name) = LOWER($1) AND id <> $2`,
            [roleName, id]
        );

        if (duplicate.rows.length > 0) {
            throw new Error("Role already exists");
        }

        const permissionResult = await client.query(
            "SELECT id FROM permissions WHERE name = ANY($1::text[])",
            [selectedPermissions]
        );

        if (permissionResult.rows.length !== selectedPermissions.length) {
            throw new Error("Permission not found in database");
        }

        await client.query(
            `UPDATE roles
             SET name = $1, description = $2
             WHERE id = $3`,
            [roleName, description.trim(), id]
        );

        await client.query(
            "DELETE FROM role_permissions WHERE role_id = $1",
            [id]
        );

        for (const permission of permissionResult.rows) {
            await client.query(
                `INSERT INTO role_permissions (role_id, permission_id)
                 VALUES ($1, $2)`,
                [id, permission.id]
            );
        }

        await client.query("COMMIT");

        console.info("[ROLE_UPDATED]", {
            roleId: id,
            roleName,
            permissions: selectedPermissions,
            updatedAt: new Date().toISOString(),
        });

        return {
            id,
            name: roleName,
            description: description.trim(),
            permissions: selectedPermissions,
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};


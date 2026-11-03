import { database } from "../config/database.js";

interface PermissionRow {
    name: string;
}

export const getUserPermissions = async (
    userId: string
): Promise<string[]> => {

    const result = await database.query<PermissionRow>(
        `
        SELECT DISTINCT p.name
        FROM user_roles ur
        JOIN roles r
            ON r.id = ur.role_id
        JOIN role_permissions rp
            ON rp.role_id = r.id
        JOIN permissions p
            ON p.id = rp.permission_id
        JOIN users u
            ON u.id = ur.user_id
        WHERE ur.user_id = $1
          AND u.is_active = true
        `,
        [userId]
    );

    return result.rows.map(
        (row) => row.name
    );
};
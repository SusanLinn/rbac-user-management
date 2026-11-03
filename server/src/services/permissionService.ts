
import { prisma } from "../config/prisma.js";

// Get permissions assigned to an active user
// through all of their roles.

export const getUserPermissions = async (
    userId: string
): Promise<string[]> => {
    const user = await prisma.users.findUnique({
        where: {
            id: userId,
        },
        select: {
            is_active: true,
            user_roles: {
                select: {
                    roles: {
                        select: {
                            role_permissions: {
                                select: {
                                    permissions: {
                                        select: {
                                            name: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    // Missing or inactive users have no permissions.
    if (!user || !user.is_active) {
        return [];
    }

    const permissions = user.user_roles.flatMap(
        (userRole) =>
            userRole.roles.role_permissions.map(
                (rolePermission) =>
                    rolePermission.permissions.name
            )
    );

    // Remove duplicate permissions.
    return [...new Set(permissions)];
};

import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

const allowedPermissions = [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
];

const prepareRole = (name: string, description: string, permissions: string[]) => ({
    roleName: name.trim().toUpperCase(),
    roleDescription: description.trim(),
    selectedPermissions: [...new Set(permissions)],
});

export const getAllRoles = async () => {
    const roles = await prisma.roles.findMany({
        select: {
            id: true,
            name: true,
            description: true,
            role_permissions: {
                select: { permissions: { select: { name: true } } },
            },
        },
        orderBy: { name: "asc" },
    });

    return roles.map(({ role_permissions, ...role }) => ({
        ...role,
        permissions: role_permissions.map((item) => item.permissions.name),
    }));
};

export const createRole = async (
    name: string,
    description: string,
    permissions: string[]
) => {
    const { roleName, roleDescription, selectedPermissions } = prepareRole(name, description, permissions);
    if (!roleName) throw new Error("Role name is required");
    if (selectedPermissions.some((permission) => !allowedPermissions.includes(permission))) {
        throw new Error("Invalid permission");
    }

    return prisma.$transaction(async (tx) => {
        const existingRole = await tx.roles.findFirst({
            where: { name: { equals: roleName, mode: "insensitive" } },
            select: { id: true },
        });
        if (existingRole) throw new Error("Role already exists");

        const permissionRecords = await tx.permissions.findMany({
            where: { name: { in: selectedPermissions } },
            select: { id: true, name: true },
        });
        if (permissionRecords.length !== selectedPermissions.length) {
            throw new Error("Permission not found in database");
        }

        const role = await tx.roles.create({
            data: {
                name: roleName,
                description: roleDescription,
                role_permissions: {
                    create: permissionRecords.map((permission) => ({
                        permissions: { connect: { id: permission.id } },
                    })),
                },
            },
            select: { id: true, name: true, description: true },
        });

        return { ...role, permissions: selectedPermissions };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

export const updateRole = async (
    id: string,
    name: string,
    description: string,
    permissions: string[]
) => {
    const { roleName, roleDescription, selectedPermissions } = prepareRole(name, description, permissions);

    return prisma.$transaction(async (tx) => {
        const existingRole = await tx.roles.findUnique({
            where: { id },
            select: { id: true, name: true },
        });
        if (!existingRole) return null;
        if (existingRole.name.toUpperCase() === "ADMIN") {
            throw new Error("System roles cannot be edited");
        }
        if (!roleName || roleName === "ADMIN") throw new Error("Invalid role name");
        if (selectedPermissions.some((permission) => !allowedPermissions.includes(permission))) {
            throw new Error("Invalid permission");
        }

        const duplicate = await tx.roles.findFirst({
            where: {
                id: { not: id },
                name: { equals: roleName, mode: "insensitive" },
            },
            select: { id: true },
        });
        if (duplicate) throw new Error("Role already exists");

        const permissionRecords = await tx.permissions.findMany({
            where: { name: { in: selectedPermissions } },
            select: { id: true, name: true },
        });
        if (permissionRecords.length !== selectedPermissions.length) {
            throw new Error("Permission not found in database");
        }

        const role = await tx.roles.update({
            where: { id },
            data: {
                name: roleName,
                description: roleDescription,
                role_permissions: {
                    deleteMany: {},
                    create: permissionRecords.map((permission) => ({
                        permissions: { connect: { id: permission.id } },
                    })),
                },
            },
            select: { id: true, name: true, description: true },
        });

        return { ...role, permissions: selectedPermissions };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

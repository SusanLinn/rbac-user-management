
import { prisma } from "../config/prisma.js";
import { hashPassword } from "../utils/password.js";

// ==================== TYPES ====================

type UserWithRole = {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    role: string | null;
};

// ==================== GET ALL USERS ====================

export const getAllUsers = async (): Promise<UserWithRole[]> => {
    const users = await prisma.users.findMany({
        select: {
            id: true,
            full_name: true,
            email: true,
            is_active: true,
            created_at: true,
            updated_at: true,
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
        orderBy: {
            created_at: "desc",
        },
    });

    return users.flatMap(
        (user): UserWithRole[] => {
            const { user_roles, ...details } = user;

            if (user_roles.length === 0) {
                return [{
                    ...details,
                    role: null,
                }];
            }

            return user_roles.map((item) => ({
                ...details,
                role: item.roles.name,
            }));
        }
    );
};

// ==================== GET USER BY ID ====================

export const getUserById = async (id: string) => {
    const user = await prisma.users.findUnique({
        where: { id },
        select: {
            id: true,
            full_name: true,
            email: true,
            is_active: true,
            created_at: true,
            updated_at: true,
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

    if (!user) {
        return undefined;
    }

    const { user_roles, ...details } = user;

    return {
        ...details,
        role: user_roles[0]?.roles.name ?? null,
    };
};

// ==================== CREATE USER ====================

export const createUser = async (
    fullName: string,
    email: string,
    password: string,
    role: string
) => {
    const hashedPassword = await hashPassword(password);

    return prisma.$transaction(async (tx) => {
        const selectedRole = await tx.roles.findUnique({
            where: { name: role },
            select: { id: true },
        });

        if (!selectedRole) {
            return null;
        }

        const user = await tx.users.create({
            data: {
                full_name: fullName,
                email,
                password_hash: hashedPassword,
            },
            select: {
                id: true,
                full_name: true,
                email: true,
                is_active: true,
                created_at: true,
            },
        });

        await tx.user_roles.create({
            data: {
                user_id: user.id,
                role_id: selectedRole.id,
            },
        });

        return {
            ...user,
            role,
        };
    });
};

// ==================== UPDATE USER ====================

export const updateUser = async (
    id: string,
    fullName: string,
    email: string,
    isActive: boolean,
    role: string
) => {
    return prisma.$transaction(async (tx) => {
        const existingUser = await tx.users.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existingUser) {
            return null;
        }

        const selectedRole = await tx.roles.findUnique({
            where: { name: role },
            select: { id: true },
        });

        if (!selectedRole) {
            return { invalidRole: true };
        }

        const user = await tx.users.update({
            where: { id },
            data: {
                full_name: fullName,
                email,
                is_active: isActive,
                updated_at: new Date(),
            },
            select: {
                id: true,
                full_name: true,
                email: true,
                is_active: true,
                created_at: true,
                updated_at: true,
            },
        });

        await tx.user_roles.deleteMany({
            where: { user_id: id },
        });

        await tx.user_roles.create({
            data: {
                user_id: id,
                role_id: selectedRole.id,
            },
        });

        return {
            ...user,
            role,
        };
    });
};

// ==================== DELETE USER ====================

export const deleteUser = async (id: string) => {
    return prisma.$transaction(async (tx) => {
        const user = await tx.users.findUnique({
            where: { id },
            select: {
                id: true,
                full_name: true,
                email: true,
            },
        });

        if (!user) {
            return undefined;
        }

        await tx.users.delete({
            where: { id },
        });

        return user;
    });
};

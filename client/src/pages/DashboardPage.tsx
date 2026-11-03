
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { api } from "../api/axios";

import FormFieldError, {
    ERROR_MESSAGES,
} from "../components/FormFieldError";

// ==================== TYPES ====================

type UserRole = string;

interface User {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    role: string;
}

interface UsersResponse {
    success: boolean;
    users: User[];
}

interface RoleOption {
    id: string;
    name: string;
}

interface RolesResponse {
    success: boolean;
    roles: RoleOption[];
}

interface ProfileResponse {
    success: boolean;
    user: {
        userId: string;
        email: string;
        role: UserRole;
        permissions: string[];
    };
}

interface DashboardSummary {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
}

interface NewUser {
    fullName: string;
    email: string;
    password: string;
    role: string;
}

interface EditUserForm {
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    role: string;
}

interface EditUserErrors {
    fullName?: string;
    email?: string;
}

interface CreateUserErrors {
    fullName?: string;
    email?: string;
    password?: string;
}

// ==================== CACHE ====================

const getCachedSummary = (): DashboardSummary => {
    const cached = sessionStorage.getItem("dashboardSummary");

    if (cached) {
        try {
            const parsed = JSON.parse(cached) as DashboardSummary;

            if (
                typeof parsed.totalUsers === "number" &&
                typeof parsed.activeUsers === "number" &&
                typeof parsed.inactiveUsers === "number"
            ) {
                return parsed;
            }
        } catch {
            sessionStorage.removeItem("dashboardSummary");
        }
    }

    return {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
    };
};

// ==================== DASHBOARD ====================

const DashboardPage = () => {
    const navigate = useNavigate();

    // ==================== USERS ====================

    const [users, setUsers] = useState<User[]>([]);

    const [summary, setSummary] =
        useState<DashboardSummary>(getCachedSummary);

    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [successMessage, setSuccessMessage] = useState("");
    const [actionError, setActionError] = useState("");

    // ==================== AUTHENTICATION ====================

    const [currentUserRole, setCurrentUserRole] =
        useState<UserRole | null>(null);

    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState("");

    const [permissions, setPermissions] = useState<string[]>([]);

    // ==================== RBAC PERMISSIONS ====================

    const canRead = permissions.includes("users.read");
    const canCreate = permissions.includes("users.create");
    const canUpdate = permissions.includes("users.update");
    const canDelete = permissions.includes("users.delete");

    const canManageUsers = canUpdate || canDelete;

    // Only ADMIN can assign the ADMIN role.
    const isAdmin = currentUserRole === "ADMIN";

    // ==================== ROLES ====================

    const [availableRoles, setAvailableRoles] =
        useState<RoleOption[]>([]);

    const [rolesLoading, setRolesLoading] = useState(false);
    const [rolesError, setRolesError] = useState("");

    // Filter ADMIN from the dropdown for all non-ADMIN roles.
    const assignableRoles = useMemo(() => {
        return availableRoles.filter(
            (role) => isAdmin || role.name !== "ADMIN"
        );
    }, [availableRoles, isAdmin]);

    // ==================== CREATE USER ====================

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    const [newUser, setNewUser] = useState<NewUser>({
        fullName: "",
        email: "",
        password: "",
        role: "USER",
    });

    const [fieldErrors, setFieldErrors] =
        useState<CreateUserErrors>({});

    // ==================== EDIT USER ====================

    const [editingUser, setEditingUser] =
        useState<EditUserForm | null>(null);

    const [editErrors, setEditErrors] =
        useState<EditUserErrors>({});

    const [editError, setEditError] = useState("");
    const [updating, setUpdating] = useState(false);

    // ==================== DELETE USER ====================

    const [deletingUserId, setDeletingUserId] =
        useState<string | null>(null);

    // ==================== HELPERS ====================

    const getDefaultRole = useCallback(
        (roles: RoleOption[]): string => {
            return (
                roles.find((role) => role.name === "USER")?.name ??
                roles[0]?.name ??
                ""
            );
        },
        []
    );

    // ==================== FETCH PROFILE ====================

    const fetchProfile = useCallback(async () => {
        try {
            setProfileLoading(true);
            setProfileError("");
            setCurrentUserRole(null);
            setPermissions([]);

            const response =
                await api.get<ProfileResponse>("/auth/profile");

            const profile = response.data.user;
            const role = profile?.role;

            if (typeof role !== "string" || !role.trim()) {
                setProfileError("Unable to verify your user role.");
                return;
            }

            setCurrentUserRole(role);

            setPermissions(
                Array.isArray(profile.permissions)
                    ? profile.permissions.filter(
                        (permission): permission is string =>
                            typeof permission === "string"
                    )
                    : []
            );

        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.status === 401
            ) {
                localStorage.removeItem("token");
                sessionStorage.removeItem("dashboardSummary");

                navigate("/", { replace: true });
                return;
            }

            const message = axios.isAxiosError(error)
                ? error.response?.data?.message
                : undefined;

            setProfileError(
                message || "Failed to load user profile."
            );

        } finally {
            setProfileLoading(false);
        }
    }, [navigate]);

    // ==================== FETCH USERS ====================

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response =
                await api.get<UsersResponse>("/users");

            const fetchedUsers = response.data.users;

            setUsers(fetchedUsers);

            const newSummary: DashboardSummary = {
                totalUsers: fetchedUsers.length,
                activeUsers: fetchedUsers.filter(
                    (user) => user.is_active
                ).length,
                inactiveUsers: fetchedUsers.filter(
                    (user) => !user.is_active
                ).length,
            };

            setSummary(newSummary);

            sessionStorage.setItem(
                "dashboardSummary",
                JSON.stringify(newSummary)
            );

        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.status === 401
            ) {
                localStorage.removeItem("token");
                sessionStorage.removeItem("dashboardSummary");

                navigate("/", { replace: true });
                return;
            }

            const message = axios.isAxiosError(error)
                ? error.response?.data?.message
                : undefined;

            setError(message || "Failed to load users.");

        } finally {
            setLoading(false);
        }
    }, [navigate]);

    // ==================== INITIAL LOAD ====================

    useEffect(() => {
        void fetchProfile();
        void fetchUsers();
    }, [fetchProfile, fetchUsers]);

    // ==================== FETCH ROLES ====================

    useEffect(() => {
        if (profileLoading || (!canCreate && !canUpdate)) {
            setAvailableRoles([]);
            return;
        }

        let cancelled = false;

        const fetchRoles = async () => {
            setRolesLoading(true);
            setRolesError("");

            try {
                const response =
                    await api.get<RolesResponse>("/roles");

                if (!cancelled) {
                    setAvailableRoles(response.data.roles);
                }

            } catch (error) {
                if (!cancelled) {
                    setAvailableRoles([]);

                    const message = axios.isAxiosError(error)
                        ? error.response?.data?.message
                        : undefined;

                    setRolesError(
                        message || "Failed to load roles."
                    );
                }

            } finally {
                if (!cancelled) {
                    setRolesLoading(false);
                }
            }
        };

        void fetchRoles();

        return () => {
            cancelled = true;
        };
    }, [profileLoading, canCreate, canUpdate]);

    // Keep the selected Create role valid after filtering.
    useEffect(() => {
        setNewUser((current) => {
            if (
                assignableRoles.some(
                    (role) => role.name === current.role
                )
            ) {
                return current;
            }

            return {
                ...current,
                role: getDefaultRole(assignableRoles),
            };
        });
    }, [assignableRoles, getDefaultRole]);

    // ==================== SEARCH ====================

    const filteredUsers = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) {
            return users;
        }

        return users.filter((user) =>
            [
                user.full_name,
                user.email,
                user.role ?? "",
            ].some((value) =>
                value.toLowerCase().includes(keyword)
            )
        );
    }, [users, search]);

    // ==================== CREATE USER ====================

    const handleCreateUser = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!canCreate) return;

        setCreateError("");

        // Frontend role assignment protection.
        if (
            !assignableRoles.some(
                (role) => role.name === newUser.role
            )
        ) {
            setCreateError(
                "You cannot assign this role."
            );
            return;
        }

        const errors: CreateUserErrors = {};

        if (!newUser.fullName.trim()) {
            errors.fullName = ERROR_MESSAGES.REQUIRED;
        }

        if (!newUser.email.trim()) {
            errors.email = ERROR_MESSAGES.REQUIRED;
        } else if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                newUser.email.trim()
            )
        ) {
            errors.email = ERROR_MESSAGES.INVALID_EMAIL;
        }

        if (!newUser.password) {
            errors.password = ERROR_MESSAGES.REQUIRED;
        }

        setFieldErrors(errors);

        if (Object.keys(errors).length > 0) return;

        setCreating(true);
        setSuccessMessage("");

        try {
            await api.post("/users", newUser);

            setSuccessMessage("User created successfully.");
            setShowCreateForm(false);

            setNewUser({
                fullName: "",
                email: "",
                password: "",
                role: getDefaultRole(assignableRoles),
            });

            setFieldErrors({});

            await fetchUsers();

        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message
                : undefined;

            setCreateError(
                message || ERROR_MESSAGES.CREATE_USER_FAILED
            );

        } finally {
            setCreating(false);
        }
    };

    // ==================== UPDATE USER ====================

    const handleUpdateUser = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!canUpdate || !editingUser) return;

        setEditError("");

        // Frontend role assignment protection.
        if (
            !assignableRoles.some(
                (role) => role.name === editingUser.role
            )
        ) {
            setEditError(
                "You cannot assign this role."
            );
            return;
        }

        const errors: EditUserErrors = {};

        if (!editingUser.fullName.trim()) {
            errors.fullName = ERROR_MESSAGES.REQUIRED;
        }

        if (!editingUser.email.trim()) {
            errors.email = ERROR_MESSAGES.REQUIRED;
        } else if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                editingUser.email.trim()
            )
        ) {
            errors.email = ERROR_MESSAGES.INVALID_EMAIL;
        }

        setEditErrors(errors);

        if (Object.keys(errors).length > 0) return;

        setUpdating(true);
        setSuccessMessage("");

        try {
            await api.put(`/users/${editingUser.id}`, {
                fullName: editingUser.fullName,
                email: editingUser.email,
                isActive: editingUser.isActive,
                role: editingUser.role,
            });

            setSuccessMessage("User updated successfully.");
            setEditingUser(null);
            setEditErrors({});

            await fetchUsers();

        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message
                : undefined;

            setEditError(
                message || "Failed to update user."
            );

        } finally {
            setUpdating(false);
        }
    };

    // ==================== DELETE USER ====================

    const handleDeleteUser = async (userId: string) => {
        if (!canDelete) return;

        const confirmed = window.confirm(
            "Are you sure you want to delete this user?"
        );

        if (!confirmed) return;

        setDeletingUserId(userId);
        setActionError("");
        setSuccessMessage("");

        try {
            await api.delete(`/users/${userId}`);

            setSuccessMessage("User deleted successfully.");

            await fetchUsers();

        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message
                : undefined;

            setActionError(
                message || "Failed to delete user."
            );

        } finally {
            setDeletingUserId(null);
        }
    };

    // ==================== LOGOUT ====================

    const handleLogout = () => {
        localStorage.removeItem("token");
        sessionStorage.removeItem("dashboardSummary");

        navigate("/", { replace: true });
    };

    // ==================== UI ====================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* Header */}
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

                    <div>
                        <h1 className="text-xl font-bold text-slate-800">
                            User Management
                        </h1>

                        <p className="text-sm text-slate-500">
                            Manage your system users
                        </p>

                        {!profileLoading && currentUserRole && (
                            <p className="mt-1 text-xs text-slate-500">
                                Role:{" "}
                                <span className="font-semibold text-blue-600">
                                    {currentUserRole}
                                </span>
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Logout
                    </button>

                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-8">

                {(canCreate || canUpdate) && rolesError && (
                    <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                        {rolesError}
                    </p>
                )}

                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800">
                        Dashboard
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                        Overview of your users and accounts.
                    </p>
                </div>

                {profileLoading && (
                    <p className="mb-4 text-sm text-slate-500">
                        Checking account permissions...
                    </p>
                )}

                {profileError && (
                    <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        {profileError} Actions are hidden until your
                        permissions can be verified.
                    </p>
                )}

                {/* Dashboard Summary */}
                <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">

                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">
                            Total Users
                        </p>

                        <p className="mt-2 text-3xl font-bold text-slate-800">
                            {summary.totalUsers}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">
                            Active Users
                        </p>

                        <p className="mt-2 text-3xl font-bold text-green-600">
                            {summary.activeUsers}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">
                            Inactive Users
                        </p>

                        <p className="mt-2 text-3xl font-bold text-red-600">
                            {summary.inactiveUsers}
                        </p>
                    </div>

                </div>

                {successMessage && (
                    <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        {successMessage}
                    </div>
                )}

                {actionError && (
                    <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                        {actionError}
                    </p>
                )}

                {/* Users Section */}
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

                    <div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">
                                Users
                            </h3>

                            <p className="text-sm text-slate-500">
                                {filteredUsers.length} users found
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">

                            <input
                                type="text"
                                placeholder="Search name, email or role..."
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
                            />

                            {canCreate && (
                                <button
                                    onClick={() => {
                                        setCreateError("");
                                        setFieldErrors({});
                                        setSuccessMessage("");
                                        setShowCreateForm(true);
                                    }}
                                    className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                                >
                                    + Create User
                                </button>
                            )}

                        </div>
                    </div>

                    {/* Users Table */}
                    {loading ? (
                        <div className="p-10 text-center text-slate-500">
                            Loading users...
                        </div>

                    ) : error ? (
                        <div className="p-10 text-center text-red-600">
                            {error}
                        </div>

                    ) : !canRead ? (
                        <div className="p-10 text-center text-amber-700">
                            You do not have permission to view users.
                        </div>

                    ) : (
                        <div className="overflow-x-auto">

                            <table className="w-full text-left text-sm">

                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Created At</th>

                                        {canManageUsers && (
                                            <th className="px-6 py-4">
                                                Actions
                                            </th>
                                        )}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">

                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={canManageUsers ? 6 : 5}
                                                className="px-6 py-10 text-center text-slate-500"
                                            >
                                                No users found.
                                            </td>
                                        </tr>

                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr
                                                key={user.id}
                                                className="transition hover:bg-slate-50"
                                            >
                                                <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-800">
                                                    {user.full_name}
                                                </td>

                                                <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                                                    {user.email}
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                                            user.role === "ADMIN"
                                                                ? "bg-purple-100 text-purple-700"
                                                                : "bg-blue-100 text-blue-700"
                                                        }`}
                                                    >
                                                        {user.role}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                            user.is_active
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-red-100 text-red-700"
                                                        }`}
                                                    >
                                                        {user.is_active
                                                            ? "Active"
                                                            : "Inactive"}
                                                    </span>
                                                </td>

                                                <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                                                    {new Date(
                                                        user.created_at
                                                    ).toLocaleDateString()}
                                                </td>

                                                {canManageUsers && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-2">

                                                            {canUpdate && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingUser({
                                                                            id: user.id,
                                                                            fullName: user.full_name,
                                                                            email: user.email,
                                                                            isActive: user.is_active,
                                                                            role: user.role,
                                                                        });

                                                                        setEditErrors({});
                                                                        setEditError("");
                                                                        setSuccessMessage("");
                                                                    }}
                                                                    disabled={
                                                                        !isAdmin &&
                                                                        user.role === "ADMIN"
                                                                    }
                                                                    title={
                                                                        !isAdmin &&
                                                                        user.role === "ADMIN"
                                                                            ? "Only ADMIN can edit ADMIN accounts"
                                                                            : "Edit user"
                                                                    }
                                                                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}

                                                            {canDelete && (
                                                                <button
                                                                    onClick={() =>
                                                                        handleDeleteUser(user.id)
                                                                    }
                                                                    disabled={
                                                                        deletingUserId === user.id ||
                                                                        (!isAdmin &&
                                                                            user.role === "ADMIN")
                                                                    }
                                                                    title={
                                                                        !isAdmin &&
                                                                        user.role === "ADMIN"
                                                                            ? "Only ADMIN can delete ADMIN accounts"
                                                                            : "Delete user"
                                                                    }
                                                                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                                >
                                                                    {deletingUserId === user.id
                                                                        ? "Deleting..."
                                                                        : "Delete"}
                                                                </button>
                                                            )}

                                                        </div>
                                                    </td>
                                                )}

                                            </tr>
                                        ))
                                    )}

                                </tbody>
                            </table>

                        </div>
                    )}

                </section>

            </main>

            {/* ==================== CREATE USER MODAL ==================== */}

            {canCreate && showCreateForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-800">
                                Create New User
                            </h3>

                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                className="text-2xl text-slate-400 hover:text-slate-700"
                            >
                                &times;
                            </button>
                        </div>

                        <form
                            onSubmit={handleCreateUser}
                            className="space-y-4"
                            noValidate
                        >

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Full Name
                                </label>

                                <input
                                    type="text"
                                    value={newUser.fullName}
                                    onChange={(event) => {
                                        setNewUser((current) => ({
                                            ...current,
                                            fullName: event.target.value,
                                        }));

                                        setFieldErrors((current) => ({
                                            ...current,
                                            fullName: undefined,
                                        }));
                                    }}
                                    placeholder="Enter full name"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <FormFieldError
                                    message={fieldErrors.fullName}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Email
                                </label>

                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(event) => {
                                        setNewUser((current) => ({
                                            ...current,
                                            email: event.target.value,
                                        }));

                                        setFieldErrors((current) => ({
                                            ...current,
                                            email: undefined,
                                        }));
                                    }}
                                    placeholder="Enter email address"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <FormFieldError
                                    message={fieldErrors.email}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Password
                                </label>

                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(event) => {
                                        setNewUser((current) => ({
                                            ...current,
                                            password: event.target.value,
                                        }));

                                        setFieldErrors((current) => ({
                                            ...current,
                                            password: undefined,
                                        }));
                                    }}
                                    placeholder="Enter password"
                                    autoComplete="new-password"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <FormFieldError
                                    message={fieldErrors.password}
                                />
                            </div>

                            {/* Role Dropdown: ADMIN visible only to ADMIN */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Role
                                </label>

                                <select
                                    value={newUser.role}
                                    disabled={
                                        rolesLoading ||
                                        assignableRoles.length === 0
                                    }
                                    onChange={(event) =>
                                        setNewUser((current) => ({
                                            ...current,
                                            role: event.target.value,
                                        }))
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="" disabled>
                                        {rolesLoading
                                            ? "Loading roles..."
                                            : "Select a role"}
                                    </option>

                                    {assignableRoles.map((role) => (
                                        <option
                                            key={role.id}
                                            value={role.name}
                                        >
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {createError && (
                                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                                    {createError}
                                </p>
                            )}

                            <div className="flex justify-end gap-3 pt-3">

                                <button
                                    type="button"
                                    disabled={creating}
                                    onClick={() => setShowCreateForm(false)}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        creating ||
                                        rolesLoading ||
                                        assignableRoles.length === 0
                                    }
                                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {creating
                                        ? "Creating..."
                                        : "Create User"}
                                </button>

                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== EDIT USER MODAL ==================== */}

            {canUpdate && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-800">
                                Edit User
                            </h3>

                            <button
                                type="button"
                                onClick={() => setEditingUser(null)}
                                className="text-2xl text-slate-400 hover:text-slate-700"
                            >
                                &times;
                            </button>
                        </div>

                        <form
                            onSubmit={handleUpdateUser}
                            className="space-y-4"
                            noValidate
                        >

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Full Name
                                </label>

                                <input
                                    type="text"
                                    value={editingUser.fullName}
                                    onChange={(event) => {
                                        setEditingUser({
                                            ...editingUser,
                                            fullName: event.target.value,
                                        });

                                        setEditErrors((current) => ({
                                            ...current,
                                            fullName: undefined,
                                        }));
                                    }}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <FormFieldError
                                    message={editErrors.fullName}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Email
                                </label>

                                <input
                                    type="email"
                                    value={editingUser.email}
                                    onChange={(event) => {
                                        setEditingUser({
                                            ...editingUser,
                                            email: event.target.value,
                                        });

                                        setEditErrors((current) => ({
                                            ...current,
                                            email: undefined,
                                        }));
                                    }}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <FormFieldError
                                    message={editErrors.email}
                                />
                            </div>

                            {/* Role Dropdown: ADMIN visible only to ADMIN */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Role
                                </label>

                                <select
                                    value={editingUser.role}
                                    disabled={
                                        rolesLoading ||
                                        assignableRoles.length === 0
                                    }
                                    onChange={(event) =>
                                        setEditingUser({
                                            ...editingUser,
                                            role: event.target.value,
                                        })
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="" disabled>
                                        {rolesLoading
                                            ? "Loading roles..."
                                            : "Select a role"}
                                    </option>

                                    {assignableRoles.map((role) => (
                                        <option
                                            key={role.id}
                                            value={role.name}
                                        >
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Account Status
                                </label>

                                <select
                                    value={
                                        editingUser.isActive
                                            ? "true"
                                            : "false"
                                    }
                                    onChange={(event) =>
                                        setEditingUser({
                                            ...editingUser,
                                            isActive:
                                                event.target.value === "true",
                                        })
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>

                            {editError && (
                                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                                    {editError}
                                </p>
                            )}

                            <div className="flex justify-end gap-3 pt-3">

                                <button
                                    type="button"
                                    disabled={updating}
                                    onClick={() => setEditingUser(null)}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        updating ||
                                        rolesLoading ||
                                        assignableRoles.length === 0
                                    }
                                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {updating
                                        ? "Updating..."
                                        : "Save Changes"}
                                </button>

                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default DashboardPage;

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { api } from "../api/axios";

interface Role {
    id: string;
    name: string;
    description: string | null;
    permissions: string[];
}

interface ProfileResponse {
    success: boolean;
    user: {
        role: string;
    };
}

interface RolesResponse {
    success: boolean;
    roles: Role[];
}

interface RoleResponse {
    success: boolean;
    role: Role;
}

const permissionOptions = [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
];

const protectedRoles = ["ADMIN"];

const RolesPage = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [permissions, setPermissions] = useState<string[]>([]);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const loadRoles = async () => {
            try {
                const profile = await api.get<ProfileResponse>("/auth/profile");

                if (profile.data.user.role !== "ADMIN") {
                    setError("Admin access required.");
                    return;
                }

                setIsAdmin(true);

                const response = await api.get<RolesResponse>("/roles");
                setRoles(response.data.roles);
            } catch {
                setError("Failed to load roles.");
            } finally {
                setLoading(false);
            }
        };

        void loadRoles();
    }, []);

    const resetForm = () => {
        setEditingRoleId(null);
        setName("");
        setDescription("");
        setPermissions([]);
    };

    const togglePermission = (permission: string) => {
        setPermissions((previous) =>
            previous.includes(permission)
                ? previous.filter((item) => item !== permission)
                : [...previous, permission]
        );
    };

    const startEdit = (role: Role) => {
        if (protectedRoles.includes(role.name.toUpperCase())) return;

        setEditingRoleId(role.id);
        setName(role.name);
        setDescription(role.description ?? "");
        setPermissions([...role.permissions]);
        setError("");
        setSuccess("");

        document.getElementById("role-form")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    const handleSaveRole = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!name.trim()) {
            setError("Role name is required.");
            return;
        }

        setSaving(true);

        try {
            const payload = {
                name: name.trim(),
                description: description.trim(),
                permissions,
            };

            if (editingRoleId) {
                const response = await api.put<RoleResponse>(
                    `/roles/${editingRoleId}`,
                    payload
                );

                setRoles((previous) =>
                    previous
                        .map((role) =>
                            role.id === editingRoleId ? response.data.role : role
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                );
                setSuccess("Role updated successfully.");
            } else {
                const response = await api.post<RoleResponse>("/roles", payload);

                setRoles((previous) =>
                    [...previous, response.data.role].sort((a, b) =>
                        a.name.localeCompare(b.name)
                    )
                );
                setSuccess("Role created successfully.");
            }

            resetForm();
        } catch (err) {
            if (axios.isAxiosError<{ message?: string }>(err)) {
                setError(
                    err.response?.data?.message ?? "Failed to save role."
                );
            } else {
                setError("Failed to save role.");
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8">Loading roles...</div>;
    }

    if (!isAdmin) {
        return (
            <div className="p-8 text-red-600">
                {error || "Admin access required."}
            </div>
        );
    }

    return (
        <div className="space-y-8 bg-white p-6 md:p-8">
            <div>
                <h1 className="text-3xl font-bold">Roles & Permissions</h1>
                <p className="mt-2 text-gray-500">
                    Create and edit roles with user management permissions.
                </p>
            </div>

            <form
                id="role-form"
                onSubmit={handleSaveRole}
                className="space-y-5 rounded-xl border border-gray-200 p-6"
            >
                <h2 className="text-xl font-semibold">
                    {editingRoleId ? "Edit Role" : "Create New Role"}
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                    <input
                        className="rounded-lg border border-gray-300 p-3"
                        placeholder="Role name (e.g. HR)"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={saving}
                    />
                    <input
                        className="rounded-lg border border-gray-300 p-3"
                        placeholder="Description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        disabled={saving}
                    />
                </div>

                <div>
                    <h3 className="mb-3 font-medium">Assign Permissions</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {permissionOptions.map((permission) => (
                            <label
                                key={permission}
                                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3"
                            >
                                <input
                                    type="checkbox"
                                    checked={permissions.includes(permission)}
                                    onChange={() => togglePermission(permission)}
                                    disabled={saving}
                                    className="h-4 w-4 accent-black"
                                />
                                <span>{permission}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && <p className="text-sm text-green-600">{success}</p>}

                <div className="flex flex-wrap gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                    >
                        {saving
                            ? "Saving..."
                            : editingRoleId
                              ? "Save Changes"
                              : "Create Role"}
                    </button>

                    {editingRoleId && (
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                                resetForm();
                                setError("");
                                setSuccess("");
                            }}
                            className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 disabled:opacity-50"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
            </form>

            <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 p-5">
                    <h2 className="text-xl font-semibold">Existing Roles</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4">Role</th>
                                <th className="p-4">Description</th>
                                <th className="p-4">Permissions</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map((role) => {
                                const isProtected = protectedRoles.includes(
                                    role.name.toUpperCase()
                                );

                                return (
                                    <tr key={role.id} className="border-t border-gray-200">
                                        <td className="p-4 font-semibold">{role.name}</td>
                                        <td className="p-4 text-gray-500">
                                            {role.description || "—"}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                {role.permissions.length === 0 && (
                                                    <span className="text-gray-400">
                                                        No permissions
                                                    </span>
                                                )}
                                                {role.permissions.map((permission) => (
                                                    <span
                                                        key={permission}
                                                        className="rounded-full bg-gray-100 px-3 py-1 text-xs"
                                                    >
                                                        {permission}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {isProtected ? (
                                                <span className="text-xs text-gray-400">
                                                    Protected
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(role)}
                                                    className="rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RolesPage;

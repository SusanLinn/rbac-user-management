
import { useState } from "react";

import type {
    FormEvent,
} from "react";

import axios from "axios";

import {
    useNavigate,
} from "react-router-dom";

import {
    api,
} from "../api/axios";

import FormFieldError, {
    ERROR_MESSAGES,
} from "../components/FormFieldError";


interface LoginErrors {
    email?: string;
    password?: string;
}


const LoginPage = () => {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [fieldErrors, setFieldErrors] =
        useState<LoginErrors>({});

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");


    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        setError("");

        // Validate fields
        const errors: LoginErrors = {};

        if (!email.trim()) {
            errors.email = ERROR_MESSAGES.REQUIRED;
        } else if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            errors.email = ERROR_MESSAGES.INVALID_EMAIL;
        }

        if (!password) {
            errors.password = ERROR_MESSAGES.REQUIRED;
        }

        setFieldErrors(errors);

        // Stop if validation fails
        if (Object.keys(errors).length > 0) {
            return;
        }

        setLoading(true);

        try {
            const response = await api.post("/auth/login", {
                email: email.trim(),
                password,
            });

            const data = response.data as {
                token?: unknown;
                accessToken?: unknown;
                data?: {
                    token?: unknown;
                    accessToken?: unknown;
                };
            };

            const tokenValue = [
                data.token,
                data.accessToken,
                data.data?.token,
                data.data?.accessToken,
            ].find(
                (value) =>
                    typeof value === "string" && value.length > 0
            );

            if (typeof tokenValue !== "string") {
                throw new Error(
                    "Login response does not contain a JWT token."
                );
            }

            localStorage.setItem("token", tokenValue);

            navigate("/dashboard", { replace: true });

        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message;

                setError(
                    typeof message === "string"
                        ? message
                        : "Login failed. Please try again."
                );
            } else if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("Something went wrong.");
            }
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">

            <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl lg:grid-cols-2">

                {/* Left Section */}
                <div className="hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">

                    <div>
                        <h1 className="text-2xl font-bold">
                            RBAC Admin
                        </h1>

                        <p className="mt-2 text-sm text-slate-400">
                            User Management System
                        </p>
                    </div>

                    <div>
                        <h2 className="text-4xl font-bold leading-tight">
                            Manage your users with confidence.
                        </h2>

                        <p className="mt-5 text-slate-400">
                            Secure access control and user
                            management in one place.
                        </p>
                    </div>

                    <p className="text-xs text-slate-500">
                        © 2026 RBAC User Management
                    </p>

                </div>


                {/* Login Form */}
                <div className="flex items-center justify-center p-8 sm:p-12">

                    <div className="w-full max-w-md">

                        <h2 className="text-3xl font-bold text-slate-900">
                            Welcome Back
                        </h2>

                        <p className="mt-2 text-sm text-slate-500">
                            Sign in to your account to continue.
                        </p>


                        <form
                            onSubmit={handleSubmit}
                            className="mt-8 space-y-5"
                            noValidate
                        >

                            {/* Email */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Email Address
                                </label>

                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => {
                                        setEmail(event.target.value);

                                        setFieldErrors((current) => ({
                                            ...current,
                                            email: undefined,
                                        }));
                                    }}
                                    placeholder="admin@example.com"
                                    autoComplete="email"
                                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <FormFieldError
                                    message={fieldErrors.email}
                                />
                            </div>


                            {/* Password */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Password
                                </label>

                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => {
                                        setPassword(event.target.value);

                                        setFieldErrors((current) => ({
                                            ...current,
                                            password: undefined,
                                        }));
                                    }}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <FormFieldError
                                    message={fieldErrors.password}
                                />
                            </div>


                            {/* API Error Message */}
                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}


                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading
                                    ? "Signing in..."
                                    : "Sign In"}
                            </button>

                        </form>


                        <p className="mt-8 text-center text-xs text-slate-400">
                            RBAC User Management System
                        </p>

                    </div>

                </div>

            </div>

        </div>
    );
};

export default LoginPage;

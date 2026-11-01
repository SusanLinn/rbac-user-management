export const getMissingFields = (
    fields: Record<string, unknown>
): string[] => {
    return Object.entries(fields)
        .filter(([_key, value]) =>
            value === undefined ||
            value === null ||
            (typeof value === "string" && value.trim() === "")
        )
        .map(([key]) => key);
};

export const isValidEmail = (email: unknown): boolean => {
    if (typeof email !== "string") {
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(email.trim());
};

export const isValidPassword = (password: unknown): boolean => {
    return typeof password === "string" && password.length >= 8;
};
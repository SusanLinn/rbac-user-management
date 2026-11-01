// Error Messages
export const ERROR_MESSAGES = {
    REQUIRED: "This field is required.",
    INVALID_EMAIL: "Please enter a valid email address.",
    CREATE_USER_FAILED: "Failed to create user.",
} as const;


// Form Field Error Component
interface FormFieldErrorProps {
    message?: string;
}

const FormFieldError = ({
    message,
}: FormFieldErrorProps) => {

    if (!message) {
        return null;
    }

    return (
        <p className="mt-1 text-sm text-red-600">
            {message}
        </p>
    );
};

export default FormFieldError;
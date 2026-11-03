
import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = pino({
    level: isDevelopment ? "debug" : "info",

    transport: isDevelopment
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "SYS:standard",
                  ignore: "pid,hostname",
              },
          }
        : undefined,

    redact: {
        paths: [
            "password",
            "passwordHash",
            "password_hash",
            "token",
            "accessToken",
            "refreshToken",
            "req.headers.authorization",
            "headers.authorization",
        ],
        censor: "[REDACTED]",
    },
});

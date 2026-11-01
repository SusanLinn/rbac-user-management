import {
    Pool,
} from "pg";

import {
    env,
} from "./env.js";


export const database =
    new Pool({
        connectionString:
            env.databaseUrl,

        ssl: {
            rejectUnauthorized:
                false,
        },
    });
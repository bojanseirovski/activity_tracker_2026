const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
});

export const db = drizzle(pool, { schema });

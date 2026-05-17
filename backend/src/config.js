import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill in the values.`
    );
  }
  return v.trim();
}

const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

export const config = {
  port: Number(process.env.PORT || 5174),
  frontendOrigin,
  apiBase: (process.env.AGNIC_API_BASE || 'https://api.agnic.ai').replace(/\/+$/, ''),
  clientId: required('AGNIC_CLIENT_ID'),
  redirectUri: required('AGNIC_REDIRECT_URI'),
  topupReturnUrl: (process.env.AGNIC_TOPUP_RETURN_URL || frontendOrigin).replace(/\/+$/, ''),
  sessionSecret: required('SESSION_SECRET'),
  scope: 'payments:sign balance:read',
};

// Base URL for all API calls.
// In production, set VITE_API_URL to your Render backend URL (no trailing slash).
// In development, leave unset — Vite proxy forwards /api/* to localhost:3001.
export const API = import.meta.env.VITE_API_URL || '';

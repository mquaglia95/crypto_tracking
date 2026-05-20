// In local dev, VITE_API_URL is unset so requests go to the Vite proxy (/api → localhost:3001).
// In production (Netlify), set VITE_API_URL to the Render backend URL.
export const API_BASE = import.meta.env.VITE_API_URL ?? '';

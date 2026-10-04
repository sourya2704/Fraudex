import axios from "axios";

/**
 * Axios client for FrauDex API.
 *
 * Auth strategy:
 *   - The backend sets an HttpOnly cookie (fraudex_access_token) on login.
 *   - withCredentials: true tells the browser to send that cookie on every
 *     request automatically — no manual token handling needed.
 *   - The old localStorage Bearer pattern has been removed. If you have a
 *     token stored in localStorage from a previous session, it will be
 *     ignored; just log in again to get a fresh cookie.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  withCredentials: true, // send HttpOnly cookie on every request
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;

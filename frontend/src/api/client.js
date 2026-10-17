import axios from "axios";

let _memoryToken = null;

export function setMemoryToken(token) {
  _memoryToken = token;
}

export function clearMemoryToken() {
  _memoryToken = null;
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (_memoryToken) {
    config.headers.Authorization = `Bearer ${_memoryToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearMemoryToken();
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/signup")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

/**
 * Human-readable message from an API error. FastAPI returns `detail` as a
 * string for HTTP errors but as a list of objects for 422 validation errors;
 * rendering that list directly crashes React.
 */
export function apiError(err, fallback = "Something went wrong.") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join("; ");
  }
  if (!err?.response && err?.message === "Network Error") {
    return "Cannot reach the FrauDex API. Is the backend running on port 8000?";
  }
  return fallback;
}

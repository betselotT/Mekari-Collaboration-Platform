import axios from "axios";

// When NEXT_PUBLIC_API_BASE_URL is set (e.g. in production), use it directly.
// Otherwise use same-origin "" so Next.js rewrites proxy the requests to the
// backend — this eliminates CORS in development.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("mekari_token");
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("mekari_token");
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

import axios from "axios";

const API_BASE_URL = "http://localhost:4000";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("mekari_token");
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


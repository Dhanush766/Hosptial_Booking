// Small wrapper around fetch() used by every page.
// It adds the login token, converts errors into ApiError objects and
// tells the app when the session has expired.

const BASE = "/api";
const TOKEN_KEY = "hospital_token";

// localStorage can be unavailable (private mode, blocked cookies), so every use is wrapped.
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function messageFrom(status, data) {
  if (data && typeof data === "object") {
    if (data.detail) return String(data.detail);
    const first = Object.values(data)[0];
    if (first) return Array.isArray(first) ? String(first[0]) : String(first);
  }
  if (status === 0) return "Cannot reach the server. Is the Django backend running?";
  if (status === 404) return "The requested record was not found.";
  if (status >= 500) return "The server had a problem. Please try again.";
  return `Request failed (${status}).`;
}

export class ApiError extends Error {
  constructor(status, data) {
    super(messageFrom(status, data));
    this.status = status;
    this.data = data;
  }
}

function buildUrl(path, params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) query.set(key, value);
  });
  const text = query.toString();
  return `${BASE}${path}${text ? `?${text}` : ""}`;
}

async function request(method, path, { params, body } = {}) {
  const headers = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, null);
  }

  let data = null;
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  // A 401 on any page except login means the token is no longer valid.
  if (response.status === 401 && token && !path.startsWith("/auth/login")) {
    window.dispatchEvent(new Event("auth:expired"));
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const api = {
  get: (path, params) => request("GET", path, { params }),
  post: (path, body) => request("POST", path, { body }),
  patch: (path, body) => request("PATCH", path, { body }),
  delete: (path) => request("DELETE", path),
};

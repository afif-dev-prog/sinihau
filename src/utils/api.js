const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://glossary.sarawakskills.edu.my/gateway/attendance";

export const getAuthToken = () => localStorage.getItem("token");
export const setAuthToken = (token) => localStorage.setItem("token", token);
export const removeAuthToken = () => localStorage.removeItem("token");

async function fetchWithAuth(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  console.log(`[API] Request: ${options.method || "GET"} ${endpoint}`);

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  console.log(`[API] Response: ${response.status} ${endpoint}`);

  if (response.status === 401) {
    console.warn(`[API] 401 Unauthorized at ${endpoint}.`);
    if (options.skipAuthRedirect) {
      console.log(
        `[API] skipAuthRedirect is true for ${endpoint}. No redirect.`,
      );
    } else {
      console.warn(`[API] Redirecting to login...`);
      removeAuthToken();
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Something went wrong");
    error.inner = data.inner;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) =>
    fetchWithAuth("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),
  register: (data) =>
    fetchWithAuth("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMe: () => fetchWithAuth("/auth/me"),
  changePassword: (data) =>
    fetchWithAuth("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Attendance
  setHome: (coords) =>
    fetchWithAuth("/attendance/set-home", {
      method: "POST",
      body: JSON.stringify(coords),
    }),
  clockIn: (payload) =>
    fetchWithAuth("/attendance/clock-in", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  clockOut: (payload) =>
    fetchWithAuth("/attendance/clock-out", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getStatus: () => fetchWithAuth("/attendance/status"),
  getHistory: () => fetchWithAuth("/attendance/history"),

  // HR
  getHrDashboard: () => fetchWithAuth("/hr/dashboard"),
  getHrStaff: (query = "") => fetchWithAuth(`/hr/staff${query}`),

  // Admin
  getUsers: () => fetchWithAuth("/admin/users"),
  createUser: (data) =>
    fetchWithAuth("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  resetLocation: (userId) =>
    fetchWithAuth(`/admin/users/${userId}/reset-location`, { method: "POST" }),
  resetPassword: (userId) =>
    fetchWithAuth(`/admin/users/${userId}/reset-password`, { method: "POST" }),
  deleteUser: (userId) =>
    fetchWithAuth(`/admin/users/${userId}`, { method: "DELETE" }),
  updateRole: (userId, role) =>
    fetchWithAuth(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  bulkImport: (users) =>
    fetchWithAuth("/admin/users/bulk-import", {
      method: "POST",
      body: JSON.stringify({ users }),
    }),

  // Superior
  checkSuperior: () =>
    fetchWithAuth("/superior/check", { skipAuthRedirect: true }),
  getSuperiorTeam: () => fetchWithAuth("/superior/team"),
};

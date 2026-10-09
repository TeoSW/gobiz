import { getLang } from "./i18n";

const USER_KEY = "skillsync-user";

export function getStoredUserId(): number | null {
  try {
    const v = localStorage.getItem(USER_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function storeUserId(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(USER_KEY);
    else localStorage.setItem(USER_KEY, String(id));
  } catch {
    /* storage unavailable: persona lives in memory only */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let currentUserId: number | null = getStoredUserId();
export const setApiUser = (id: number | null) => {
  currentUserId = id;
};

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (currentUserId != null) headers.set("X-User-Id", String(currentUserId));
  headers.set("Accept-Language", getLang()); // the API answers in the same language (explanations, errors)
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`/api${path}`, { ...init, headers, body });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map((d: { msg: string }) => d.msg).join("; ") : msg;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: "POST", json: json ?? {} });
export const put = <T>(path: string, json: unknown) => api<T>(path, { method: "PUT", json });

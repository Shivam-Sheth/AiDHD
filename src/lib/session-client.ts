const KEY = "aidhd_uid";

export function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setStoredUserId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, id);
}

export function clearStoredUserId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

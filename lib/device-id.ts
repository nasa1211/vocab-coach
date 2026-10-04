const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_KEY = "study_device_id";

export function parseDeviceId(value: unknown): string | null {
  if (typeof value !== "string" || !DEVICE_ID.test(value)) return null;
  return value.toLowerCase();
}

function createDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? random : (random & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export function getDeviceId() {
  const existing = parseDeviceId(localStorage.getItem(STORAGE_KEY));
  if (existing) return existing;
  const created = parseDeviceId(createDeviceId());
  if (!created) throw new Error("기기 아이디를 만들지 못했습니다.");
  localStorage.setItem(STORAGE_KEY, created);
  return created;
}

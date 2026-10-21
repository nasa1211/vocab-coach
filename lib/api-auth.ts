import { NextRequest } from "next/server";

export function verifyServerSecret(req: NextRequest): boolean {
  const secret = process.env.PUSH_SEND_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function getDeviceIdFromHeader(req: NextRequest): string | null {
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId || typeof deviceId !== "string") {
    return null;
  }
  // Validate UUID format
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(deviceId) ? deviceId : null;
}

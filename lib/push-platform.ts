const UA_MAX = 512;

export function truncateUserAgent(ua: string) {
  return ua.slice(0, UA_MAX);
}

export function detectPushPlatform(
  userAgent: string,
  client?: { standalone?: boolean } | null
) {
  const ua = userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  const android = /Android/i.test(ua);
  const standalone = client?.standalone === true;

  if (ios && standalone) return "ios-pwa";
  if (ios) return "ios-safari";
  if (android && standalone) return "android-pwa";
  if (android) return "android";
  if (/Mac/i.test(ua)) return "macos";
  return "desktop";
}
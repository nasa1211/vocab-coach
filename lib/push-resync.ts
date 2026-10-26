// Re-posts the browser's existing push subscription so the server regains it if it was dropped.
// The server upserts by endpoint, so this is idempotent.
export async function resyncPushSubscription() {
  try {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });
  } catch {
    /* best effort */
  }
}

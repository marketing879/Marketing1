// ── SmartCue Service Worker — Push Notification Handler ──────────────────────
// Place this file at: /public/sw.js
// It handles push events when the app is in background or closed.

const CACHE_NAME = "smartcue-v1";

// ── Install: skip waiting so new SW activates immediately ─────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// ── Activate: take control of all open tabs immediately ──────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// ── Push: handle incoming push notification from server ──────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "SmartCue", body: event.data?.text() || "You have a new notification." };
  }

  const {
    title   = "SmartCue",
    body    = "You have a new notification.",
    icon    = "/favicon.png",
    badge   = "/favicon.png",
    tag     = "smartcue-notification",
    url     = "/",
    type    = "",
    taskId  = "",
    actions = [],
  } = data;

  // ── Choose icon colour by notification type ───────────────────────────────
  const iconMap = {
    task_assigned:       "/favicon.png",
    task_status_changed: "/favicon.png",
    tat_breach:          "/favicon.png",
  };

  const notificationOptions = {
    body,
    icon:    iconMap[type] || icon,
    badge,
    tag,
    data:    { url, taskId, type },
    actions: actions.length ? actions : [
      { action: "open",    title: "Open Dashboard" },
      { action: "dismiss", title: "Dismiss"        },
    ],
    requireInteraction: type === "tat_breach" || type === "task_assigned",
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// ── Notification click: open the app / focus existing tab ────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If there's already a tab open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          // Send message to the tab so it can navigate to the right task
          client.postMessage({
            type:   "NOTIFICATION_CLICKED",
            taskId: event.notification.data?.taskId,
            notifType: event.notification.data?.type,
          });
          return;
        }
      }
      // No open tab — open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Push subscription change: re-subscribe automatically ─────────────────────
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then((newSubscription) => {
      // Notify the app to re-register the new subscription
      return clients.matchAll({ type: "window" }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", subscription: newSubscription });
        });
      });
    })
  );
});
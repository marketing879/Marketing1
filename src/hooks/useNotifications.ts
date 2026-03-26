// ── useNotifications.ts ───────────────────────────────────────────────────────
// Drop this hook into any dashboard (Admin, Staff, Supremo, Superadmin).
// It initialises push notifications on login and listens to socket events.
//
// Usage:
//   import { useNotifications } from "../hooks/useNotifications";
//   // Inside your component:
//   useNotifications(user, socket);

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  initNotifications,
  handleTaskNotification,
  unsubscribeNotifications,
  requestNotificationPermission,
} from "../services/NotificationService";

const SOCKET_URL = "https://adaptable-patience-production-45da.up.railway.app";

interface User {
  email: string;
  role:  "superadmin" | "supremo" | "admin" | "staff";
  name?: string;
}

// ── Shared socket instance (singleton across all dashboards) ─────────────────
let sharedSocket: Socket | null = null;

function getSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(SOCKET_URL, {
      transports:         ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay:  2000,
    });
  }
  return sharedSocket;
}

export function useNotifications(user: User | null): Socket | null {
  const initedRef    = useRef(false);
  const socketRef    = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    if (initedRef.current) return;
    initedRef.current = true;

    // ── 1. Initialise desktop + push notifications ────────────────────────
    initNotifications({ email: user.email, role: user.role, name: user.name });

    // ── 2. Connect to socket ──────────────────────────────────────────────
    const socket = getSocket();
    socketRef.current = socket;

    socket.emit("user_join", {
      email:  user.email,
      name:   user.name || user.email,
      role:   user.role,
      id:     user.email,
    });

    // ── 3. Listen for task_notification events ────────────────────────────
    socket.on("task_notification", (event) => {
      console.log("[Socket] task_notification:", event);
      handleTaskNotification(event, { email: user.email, role: user.role, name: user.name });
    });

    // ── 4. Cleanup on unmount / user change ───────────────────────────────
    return () => {
      socket.off("task_notification");
      initedRef.current = false;
    };
  }, [user?.email]);

  // Unsubscribe push on logout (when user becomes null after being set)
  useEffect(() => {
    return () => {
      if (user?.email) {
        unsubscribeNotifications(user.email).catch(() => {});
      }
    };
  }, []); // eslint-disable-line

  return socketRef.current;
}

// ── Standalone helper: request permission (call from a settings button) ───────
export { requestNotificationPermission };
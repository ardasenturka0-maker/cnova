"use client";

import { useEffect } from "react";

export function WebviewHeartbeat() {
  useEffect(() => {
    const monitorUrl = process.env.NEXT_PUBLIC_WEBVIEW_MONITOR_URL;
    if (!monitorUrl) return;

    const heartbeatUrl = `${monitorUrl}/heartbeat`;
    const closingUrl = `${monitorUrl}/closing`;

    function ping() {
      fetch(heartbeatUrl, {
        method: "POST",
        cache: "no-store",
        keepalive: true
      }).catch(() => {
        // The launcher may already be closed; the app should not surface this.
      });
    }

    function notifyClosing() {
      navigator.sendBeacon?.(closingUrl);
    }

    ping();
    const interval = window.setInterval(ping, 2000);
    window.addEventListener("pagehide", notifyClosing);
    window.addEventListener("beforeunload", notifyClosing);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", notifyClosing);
      window.removeEventListener("beforeunload", notifyClosing);
      notifyClosing();
    };
  }, []);

  return null;
}

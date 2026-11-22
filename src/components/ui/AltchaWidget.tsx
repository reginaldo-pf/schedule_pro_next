"use client";

import React, { useEffect, useRef } from "react";

interface AltchaStateEvent extends Event {
  detail?: {
    payload?: string;
    state?: "unverified" | "verifying" | "verified" | "error" | "expired";
  };
}

interface AltchaElement extends HTMLElement {
  reset?: () => void;
}

export function AltchaWidget({
  onVerify,
  resetKey = 0,
}: {
  onVerify: (payload: string) => void;
  resetKey?: number;
}) {
  const widgetRef = useRef<AltchaElement | null>(null);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  useEffect(() => {
    void Promise.all([import("altcha"), import("altcha/i18n")]);
  }, []);

  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;

    const handleStateChange = (event: Event) => {
      const customEvent = event as AltchaStateEvent;
      const state = customEvent.detail?.state;
      const payload = customEvent.detail?.payload || "";
      if (state === "verified" && payload) {
        onVerifyRef.current(payload);
      } else if (
        state === "unverified" ||
        state === "error" ||
        state === "expired"
      ) {
        onVerifyRef.current("");
      }
    };

    el.addEventListener("statechange", handleStateChange);
    return () => {
      el.removeEventListener("statechange", handleStateChange);
    };
  }, []);

  useEffect(() => {
    if (resetKey > 0) {
      widgetRef.current?.reset?.();
      onVerifyRef.current("");
    }
  }, [resetKey]);

  return (
    <div className="my-2">
      {React.createElement("altcha-widget", {
        ref: widgetRef,
        challenge: "/api/altcha/challenge",
        language: "pt-br",
        hidefooter: "true",
        style: {
          "--altcha-max-width": "100%",
          "--altcha-border-radius": "8px",
        } as React.CSSProperties,
      })}
    </div>
  );
}

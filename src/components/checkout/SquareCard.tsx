"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Square's card form (the Web Payments SDK). Square draws the card fields in
 * its own secure frame, so the card number never touches our page or server.
 * When the customer pays, tokenize() asks Square for a one-time code that
 * stands for the card, and the pay route sends that code to Square.
 *
 * Sandbox (test) or live is picked by NEXT_PUBLIC_SQUARE_ENVIRONMENT, the
 * same setting the server uses.
 */

interface SquareCardInstance {
  attach(target: HTMLElement): Promise<void>;
  tokenize(): Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy(): Promise<boolean>;
}

interface SquarePayments {
  card(options?: { style?: Record<string, Record<string, string>> }): Promise<SquareCardInstance>;
}

declare global {
  interface Window {
    Square?: { payments(applicationId: string, locationId: string): SquarePayments };
  }
}

export type TokenizeResult = { ok: true; token: string } | { ok: false; message: string };

export interface SquareCardHandle {
  tokenize(): Promise<TokenizeResult>;
}

const LIVE = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production";
const SCRIPT_SRC = LIVE
  ? "https://web.squarecdn.com/v1/square.js"
  : "https://sandbox.web.squarecdn.com/v1/square.js";
const APPLICATION_ID = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? "";
const LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";

// Colors from the site's dark theme (src/app/globals.css).
const CARD_STYLE = {
  ".input-container": { borderColor: "#5A4636", borderRadius: "6px" },
  ".input-container.is-focus": { borderColor: "#E8671C" },
  ".input-container.is-error": { borderColor: "#B91C1C" },
  input: { backgroundColor: "#242424", color: "#F5E6C8" },
  "input::placeholder": { color: "#8A8070" },
  ".message-text": { color: "#B8AD98" },
  ".message-icon": { color: "#B8AD98" },
  ".message-text.is-error": { color: "#F87171" },
  ".message-icon.is-error": { color: "#F87171" },
};

let scriptPromise: Promise<void> | null = null;

function loadSquareScript(): Promise<void> {
  if (window.Square) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Square's card form didn't load."));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function SquareCard({ ref }: { ref?: React.Ref<SquareCardHandle> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<SquareCardInstance | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let card: SquareCardInstance | null = null;

    (async () => {
      try {
        if (!APPLICATION_ID || !LOCATION_ID) throw new Error("Square isn't set up.");
        await loadSquareScript();
        if (cancelled || !window.Square || !containerRef.current) return;
        const payments = window.Square.payments(APPLICATION_ID, LOCATION_ID);
        card = await payments.card({ style: CARD_STYLE });
        if (cancelled) {
          await card.destroy();
          return;
        }
        await card.attach(containerRef.current);
        cardRef.current = card;
        setState("ready");
      } catch (error) {
        console.error(
          "Card form:",
          error instanceof Error ? error.message : "unknown error"
        );
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      cardRef.current = null;
      void card?.destroy();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    async tokenize(): Promise<TokenizeResult> {
      const card = cardRef.current;
      if (!card) return { ok: false, message: "The card form isn't ready yet. Please wait a moment." };
      try {
        const result = await card.tokenize();
        if (result.status === "OK" && result.token) return { ok: true, token: result.token };
        return {
          ok: false,
          message: result.errors?.[0]?.message ?? "Check your card details and try again.",
        };
      } catch {
        return { ok: false, message: "Check your card details and try again." };
      }
    },
  }));

  return (
    <div className="space-y-2">
      {!LIVE && (
        <p className="rounded-md border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-xs text-brand-cream">
          Test mode: no real money moves.
        </p>
      )}
      {state === "loading" && (
        <p className="flex items-center gap-2 text-sm text-brand-cream/60">
          <Loader2 size={16} className="animate-spin" /> Loading the card form...
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="text-sm text-brand-red">
          The card form didn&apos;t load. Refresh the page to try again.
        </p>
      )}
      <div ref={containerRef} />
    </div>
  );
}

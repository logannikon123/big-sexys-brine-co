import "server-only";

import { SquareClient, SquareEnvironment } from "square";

/**
 * Square settings and client for online ordering. Server code only: the
 * "server-only" import above makes the build fail if a browser component
 * imports this file, so the access token can never reach a visitor.
 *
 * NEXT_PUBLIC_SQUARE_ENVIRONMENT picks the Square account to talk to.
 * "production" means the live account; any other value, or none, means the
 * sandbox (Square's test account, where no real money moves).
 */
export function squareEnvironment(): "production" | "sandbox" {
  return process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}

/** The Square location (shop) that orders and payments belong to. */
export function squareLocationId(): string | undefined {
  return process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || undefined;
}

/**
 * Builds a Square client. Throws if SQUARE_ACCESS_TOKEN is not set, so a
 * missing setting fails loudly instead of sending requests Square will reject.
 */
export function getSquareClient(): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SQUARE_ACCESS_TOKEN is not set. Add it to .env.local, or to Vercel for a deployed site.",
    );
  }

  return new SquareClient({
    token,
    environment:
      squareEnvironment() === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  });
}

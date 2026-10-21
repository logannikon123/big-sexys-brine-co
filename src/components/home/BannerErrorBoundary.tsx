"use client";

import { Component, type ReactNode } from "react";

/**
 * If the banner breaks in the browser, hide it instead of breaking the whole
 * home page. React only catches errors this way with a class component.
 */
export class BannerErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("The home page banner failed to show:", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

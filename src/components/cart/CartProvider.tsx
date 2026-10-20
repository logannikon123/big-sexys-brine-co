"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import {
  addToCart,
  clearCart,
  getCartSnapshot,
  getServerCartSnapshot,
  removeFromCart,
  setCartQty,
  subscribeCart,
  type AddResult,
  type CartItem,
} from "@/lib/cart/store";

interface CartContextValue {
  items: readonly CartItem[];
  /** Total number of jars. */
  count: number;
  /** False on the server and during the first render, before the browser's cart is read. */
  ready: boolean;
  add: (productId: number, qty: number) => AddResult;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const noSubscribe = () => () => {};

export function CartProvider({ children }: { children: React.ReactNode }) {
  // The server snapshot is always empty, so the page the server sends and
  // the browser's first render match. The saved cart shows up right after.
  const items = useSyncExternalStore(
    subscribeCart,
    getCartSnapshot,
    getServerCartSnapshot
  );
  const ready = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.qty, 0),
      ready,
      add: addToCart,
      setQty: setCartQty,
      remove: removeFromCart,
      clear: clearCart,
    }),
    [items, ready]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}

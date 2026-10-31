"use client";

// The cart lives in the browser (localStorage), so visitors can shop before
// logging in. It only ever holds product ids and quantities: prices and
// stock always come from the server, and checkout re-checks everything.
import { useSyncExternalStore } from "react";
import { MAX_QUANTITY } from "@/lib/shop";

export type CartLine = { productId: number; quantity: number };

const STORAGE_KEY = "skye-crafts.cart.v1";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let snapshot: CartLine[] | null = null;

function read(): CartLine[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((line) =>
      Number.isInteger(line?.productId) && line.productId > 0 &&
      Number.isInteger(line?.quantity) && line.quantity > 0
        ? [{ productId: line.productId, quantity: Math.min(line.quantity, MAX_QUANTITY) }]
        : [],
    );
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  snapshot = lines;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private browsing or storage full: the cart still works for this page.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync: another tab changed the cart.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      snapshot = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  snapshot ??= read();
  return snapshot;
}

/** The current cart; re-renders when it changes (in any tab). */
export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export const cart = {
  /** Add one or more; never above `max` (stock) or 99. Returns the new quantity. */
  add(productId: number, quantity: number, max = MAX_QUANTITY) {
    const lines = getSnapshot();
    const current = lines.find((line) => line.productId === productId)?.quantity ?? 0;
    const next = Math.min(current + quantity, max, MAX_QUANTITY);
    cart.set(productId, next);
    return next;
  },
  set(productId: number, quantity: number) {
    const lines = getSnapshot().filter((line) => line.productId !== productId);
    if (quantity > 0) {
      const index = getSnapshot().findIndex((line) => line.productId === productId);
      const line = { productId, quantity: Math.min(quantity, MAX_QUANTITY) };
      if (index === -1) lines.push(line);
      else lines.splice(index, 0, line);
    }
    write(lines);
  },
  remove(productId: number) {
    cart.set(productId, 0);
  },
  clear() {
    write([]);
  },
  /** Replace the whole cart (after dropping items that are no longer sold). */
  replace(lines: CartLine[]) {
    write(lines);
  },
};

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

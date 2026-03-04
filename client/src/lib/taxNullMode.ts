import { useEffect, useState } from "react";

const TAX_NULL_MODE_KEY = "taxNullModeActive";
const TAX_NULL_MODE_EVENT = "tax-null-mode-changed";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readTaxNullMode(): boolean {
  if (!canUseStorage()) return false;
  return window.localStorage.getItem(TAX_NULL_MODE_KEY) === "1";
}

export function writeTaxNullMode(active: boolean) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TAX_NULL_MODE_KEY, active ? "1" : "0");
  window.dispatchEvent(new CustomEvent(TAX_NULL_MODE_EVENT, { detail: { active } }));
}

export function useTaxNullMode() {
  const [isActive, setIsActive] = useState<boolean>(() => readTaxNullMode());

  useEffect(() => {
    const syncFromStorage = () => setIsActive(readTaxNullMode());
    const onStorage = (event: StorageEvent) => {
      if (event.key === TAX_NULL_MODE_KEY) {
        syncFromStorage();
      }
    };
    const onCustomEvent = () => syncFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener(TAX_NULL_MODE_EVENT, onCustomEvent);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(TAX_NULL_MODE_EVENT, onCustomEvent);
    };
  }, []);

  return isActive;
}

// Arquivo: src/lib/featureFlags.ts

// FASE 2 / FRONT-END

// Feature flag local para liberar a tela nova sem remover as telas antigas no primeiro deploy.

import { useEffect, useState } from "react";

export const FEATURE_FLAGS = {

  unifiedPermissions: "gn:feature:unified_permissions",

} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function getFeatureFlag(flag: FeatureFlagKey, defaultValue = false): boolean {

  if (typeof window === "undefined") return defaultValue;

  const raw = window.localStorage.getItem(FEATURE_FLAGS[flag]);

  if (raw === null) return defaultValue;

  return raw === "true";

}

export function setFeatureFlag(flag: FeatureFlagKey, value: boolean): void {

  if (typeof window === "undefined") return;

  window.localStorage.setItem(FEATURE_FLAGS[flag], value ? "true" : "false");

  window.dispatchEvent(new CustomEvent("gn-feature-flag-change", {

    detail: { flag, value },

  }));

}

export function useFeatureFlag(flag: FeatureFlagKey, defaultValue = false): [boolean, (value: boolean) => void] {

  const [enabled, setEnabled] = useState<boolean>(() => getFeatureFlag(flag, defaultValue));

  useEffect(() => {

    const onChange = (event: Event) => {

      const customEvent = event as CustomEvent<{ flag: FeatureFlagKey; value: boolean }>;

      if (customEvent.detail?.flag === flag) {

        setEnabled(customEvent.detail.value);

      }

    };

    const onStorage = (event: StorageEvent) => {

      if (event.key === FEATURE_FLAGS[flag]) {

        setEnabled(event.newValue === "true");

      }

    };

    window.addEventListener("gn-feature-flag-change", onChange);

    window.addEventListener("storage", onStorage);

    return () => {

      window.removeEventListener("gn-feature-flag-change", onChange);

      window.removeEventListener("storage", onStorage);

    };

  }, [flag]);

  const update = (value: boolean) => {

    setFeatureFlag(flag, value);

    setEnabled(value);

  };

  return [enabled, update];

}


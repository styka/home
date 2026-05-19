"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "wom-category-icons";

export function useCategoryIcons() {
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setIcons(JSON.parse(stored));
    } catch {
      // ignore parse errors
    }
  }, []);

  const setIcon = useCallback((category: string, icon: string) => {
    setIcons((prev) => {
      const next = { ...prev, [category]: icon };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const resetIcon = useCallback((category: string) => {
    setIcons((prev) => {
      const next = { ...prev };
      delete next[category];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { icons, setIcon, resetIcon };
}

import { useState, useEffect, useCallback, useRef } from "react";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved";

export interface UseDirtyFormOptions<T> {
  storageKey: string;
  initialValues: T;
  onSave?: (values: T) => Promise<void> | void;
  autoSave?: boolean;
  autoSaveIntervalMs?: number;
  isEqual?: (a: T, b: T) => boolean;
  persist?: boolean;
  clearAfterSave?: boolean;
}

export interface UseDirtyFormReturn<T> {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  isDirty: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  save: () => Promise<void>;
  reset: () => void;
  clearDraft: () => void;
  confirmLeave: boolean;
  setConfirmLeave: React.Dispatch<React.SetStateAction<boolean>>;
}

function defaultIsEqual<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

export function useDirtyForm<T extends Record<string, unknown>>({
  storageKey,
  initialValues,
  onSave,
  autoSave = true,
  autoSaveIntervalMs = 3000,
  isEqual = defaultIsEqual,
  persist = true,
  clearAfterSave = false,
}: UseDirtyFormOptions<T>): UseDirtyFormReturn<T> {
  const [values, setValues] = useState<T>(() => {
    if (!persist) return initialValues;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...initialValues, ...JSON.parse(raw) };
    } catch {
      // ignore parse errors
    }
    return initialValues;
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => {
    if (!persist) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return new Date();
    } catch {
      // ignore
    }
    return null;
  });
  const [confirmLeave, setConfirmLeave] = useState(false);

  const initialRef = useRef(initialValues);
  const saveTimerRef = useRef<number | null>(null);

  const checkDirty = useCallback(
    (current: T) => {
      const dirty = !isEqual(current, initialRef.current);
      setIsDirty(dirty);
      return dirty;
    },
    [isEqual],
  );

  const setField = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        checkDirty(next);
        return next;
      });
    },
    [checkDirty],
  );

  const persistDraft = useCallback(
    (current: T) => {
      if (!persist) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(current));
      } catch {
        // storage full or unavailable
      }
    },
    [persist, storageKey],
  );

  const save = useCallback(async () => {
    setSaveStatus("saving");
    try {
      if (onSave) {
        await onSave(values);
      }
      const savedValues = clearAfterSave ? initialRef.current : values;
      persistDraft(savedValues);
      initialRef.current = savedValues;
      if (clearAfterSave) setValues(savedValues);
      setIsDirty(false);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      setConfirmLeave(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("dirty");
      throw new Error("Save failed");
    }
  }, [values, onSave, persistDraft, clearAfterSave]);

  const reset = useCallback(() => {
    setValues(initialRef.current);
    setIsDirty(false);
    setSaveStatus("idle");
    setConfirmLeave(false);
  }, []);

  const clearDraft = useCallback(() => {
    if (persist) localStorage.removeItem(storageKey);
    setValues(initialRef.current);
    setIsDirty(false);
    setSaveStatus("idle");
    setLastSavedAt(null);
    setConfirmLeave(false);
  }, [persist, storageKey]);

  useEffect(() => {
    if (persist) persistDraft(values);
  }, [values, persist, persistDraft]);

  useEffect(() => {
    if (isDirty) setSaveStatus("dirty");
  }, [isDirty]);

  useEffect(() => {
    if (!autoSave || !isDirty) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void save();
    }, autoSaveIntervalMs);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [autoSave, autoSaveIntervalMs, isDirty, save]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return {
    values,
    setValues,
    setField,
    isDirty,
    saveStatus,
    lastSavedAt,
    save,
    reset,
    clearDraft,
    confirmLeave,
    setConfirmLeave,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_THROTTLE_MS = 30_000;

export interface UseSessionOptions {
  sessionDurationMinutes: number;
  warningBeforeMinutes: number;
  onSessionExpiry?: () => void;
  onReauthSuccess?: () => void;
}

export const useSession = ({
  sessionDurationMinutes,
  warningBeforeMinutes,
  onSessionExpiry,
  onReauthSuccess,
}: UseSessionOptions) => {
  const durationMs = sessionDurationMinutes * 60 * 1000;
  const durationSeconds = sessionDurationMinutes * 60;
  const [showWarning, setShowWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  const expiryDeadlineRef = useRef(Date.now() + durationMs);
  const lastActivityResetRef = useRef<number | null>(null);
  const showWarningRef = useRef(showWarning);
  const isExpiredRef = useRef(isExpired);
  const isReauthenticatingRef = useRef(isReauthenticating);
  const durationMsRef = useRef(durationMs);
  const durationSecondsRef = useRef(durationSeconds);
  const warningBeforeMsRef = useRef(warningBeforeMinutes * 60 * 1000);
  const onSessionExpiryRef = useRef(onSessionExpiry);
  const onReauthSuccessRef = useRef(onReauthSuccess);

  showWarningRef.current = showWarning;
  isExpiredRef.current = isExpired;
  isReauthenticatingRef.current = isReauthenticating;
  durationMsRef.current = durationMs;
  durationSecondsRef.current = durationSeconds;
  warningBeforeMsRef.current = warningBeforeMinutes * 60 * 1000;
  onSessionExpiryRef.current = onSessionExpiry;
  onReauthSuccessRef.current = onReauthSuccess;

  const resetSession = useCallback(() => {
    expiryDeadlineRef.current = Date.now() + durationMsRef.current;
    isExpiredRef.current = false;
    showWarningRef.current = false;
    setIsExpired(false);
    setShowWarning(false);
    setTimeLeft(durationSecondsRef.current);
  }, []);

  const handleExtendSession = useCallback(() => {
    resetSession();
  }, [resetSession]);

  const handleReauthSuccess = useCallback(() => {
    isReauthenticatingRef.current = false;
    setIsReauthenticating(false);
    resetSession();
    onReauthSuccessRef.current?.();
  }, [resetSession]);

  const initiateReauth = useCallback(() => {
    isReauthenticatingRef.current = true;
    showWarningRef.current = false;
    setIsReauthenticating(true);
    setShowWarning(false);
  }, []);

  const handleUserActivity = useCallback(() => {
    if (
      isExpiredRef.current ||
      isReauthenticatingRef.current ||
      showWarningRef.current
    ) {
      return;
    }

    const now = Date.now();
    if (
      lastActivityResetRef.current !== null &&
      now - lastActivityResetRef.current < ACTIVITY_THROTTLE_MS
    ) {
      return;
    }

    lastActivityResetRef.current = now;
    resetSession();
  }, [resetSession]);

  useEffect(() => {
    expiryDeadlineRef.current = Date.now() + durationMs;
    setTimeLeft(durationSeconds);
    setShowWarning(false);
    setIsExpired(false);
    setIsReauthenticating(false);
    showWarningRef.current = false;
    isExpiredRef.current = false;
    isReauthenticatingRef.current = false;
  }, [durationMs, durationSeconds, warningBeforeMinutes]);

  useEffect(() => {
    const updateSession = () => {
      const remainingMs = Math.max(0, expiryDeadlineRef.current - Date.now());
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setTimeLeft((current) =>
        current === remainingSeconds ? current : remainingSeconds
      );

      if (isExpiredRef.current || isReauthenticatingRef.current) return;

      if (remainingMs === 0) {
        isExpiredRef.current = true;
        showWarningRef.current = false;
        setIsExpired(true);
        setShowWarning(false);
        onSessionExpiryRef.current?.();
        return;
      }

      const shouldShowWarning =
        remainingMs <= warningBeforeMsRef.current;
      if (showWarningRef.current !== shouldShowWarning) {
        showWarningRef.current = shouldShowWarning;
        setShowWarning(shouldShowWarning);
      }
    };

    const interval = window.setInterval(updateSession, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [handleUserActivity]);

  return {
    showWarning,
    isExpired,
    isReauthenticating,
    timeLeft,
    extendSession: handleExtendSession,
    initiateReauth,
    reauthSuccess: handleReauthSuccess,
    resetSession,
  };
};

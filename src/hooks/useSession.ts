
import { useState, useEffect, useCallback, useRef } from 'react';

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
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date>(
    new Date(Date.now() + sessionDurationMinutes * 60 * 1000)
  );
  const [showWarning, setShowWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(sessionDurationMinutes * 60);
  const timerRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const expiryTimerRef = useRef<number | null>(null);

  const resetSession = useCallback(() => {
    const newExpiry = new Date(Date.now() + sessionDurationMinutes * 60 * 1000);
    setSessionExpiresAt(newExpiry);
    setIsExpired(false);
    setShowWarning(false);
    setTimeLeft(sessionDurationMinutes * 60);
  }, [sessionDurationMinutes]);

  const startTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);

    const updateTimeLeft = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((sessionExpiresAt.getTime() - now) / 1000));
      setTimeLeft(remaining);
    };

    timerRef.current = setInterval(updateTimeLeft, 1000);

    const warningDelay = Math.max(0, (sessionDurationMinutes - warningBeforeMinutes) * 60 * 1000);
    warningTimerRef.current = setTimeout(() => {
      if (!isExpired && !isReauthenticating) {
        setShowWarning(true);
      }
    }, warningDelay);

    const expiryDelay = sessionDurationMinutes * 60 * 1000;
    expiryTimerRef.current = setTimeout(() => {
      setIsExpired(true);
      setShowWarning(false);
      onSessionExpiry?.();
    }, expiryDelay);

    updateTimeLeft();
  }, [sessionExpiresAt, sessionDurationMinutes, warningBeforeMinutes, isExpired, isReauthenticating, onSessionExpiry]);

  const handleUserActivity = useCallback(() => {
    if (!isExpired) {
      resetSession();
    }
  }, [isExpired, resetSession]);

  const handleExtendSession = useCallback(() => {
    resetSession();
  }, [resetSession]);

  const handleReauthSuccess = useCallback(() => {
    setIsReauthenticating(false);
    resetSession();
    onReauthSuccess?.();
  }, [resetSession, onReauthSuccess]);

  const initiateReauth = useCallback(() => {
    setIsReauthenticating(true);
    setShowWarning(false);
  }, []);

  useEffect(() => {
    startTimers();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [sessionExpiresAt, startTimers]);

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


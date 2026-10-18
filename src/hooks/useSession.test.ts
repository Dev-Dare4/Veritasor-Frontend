import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession, UseSessionOptions } from './useSession';

describe('useSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const defaultOptions: UseSessionOptions = {
    sessionDurationMinutes: 10,
    warningBeforeMinutes: 2,
  };

  it('initializes with correct state', () => {
    const { result } = renderHook(() => useSession(defaultOptions));
    
    expect(result.current.timeLeft).toBe(600); // 10 minutes
    expect(result.current.isExpired).toBe(false);
    expect(result.current.showWarning).toBe(false);
    expect(result.current.isReauthenticating).toBe(false);
  });

  it('shows warning at the correct time', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    act(() => {
      // Fast-forward to just before the warning
      vi.advanceTimersByTime((10 - 2) * 60 * 1000 - 1);
    });
    expect(result.current.showWarning).toBe(false);

    act(() => {
      // Advance to the warning time
      vi.advanceTimersByTime(1);
    });
    expect(result.current.showWarning).toBe(true);
    expect(result.current.isExpired).toBe(false);
  });

  it('expires session at the correct time and calls onSessionExpiry', () => {
    const onSessionExpiry = vi.fn();
    const { result } = renderHook(() => 
      useSession({ ...defaultOptions, onSessionExpiry })
    );

    act(() => {
      // Advance to just before expiration
      vi.advanceTimersByTime(10 * 60 * 1000 - 1);
    });
    expect(result.current.isExpired).toBe(false);
    expect(onSessionExpiry).not.toHaveBeenCalled();

    act(() => {
      // Advance to expiration
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isExpired).toBe(true);
    expect(result.current.showWarning).toBe(false);
    expect(onSessionExpiry).toHaveBeenCalledTimes(1);
  });

  it('resets session on user activity', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(result.current.timeLeft).toBeLessThan(600);

    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });

    expect(result.current.timeLeft).toBe(600);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.showWarning).toBe(false);
  });

  it('does not reset session on user activity if already expired', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(result.current.isExpired).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });

    expect(result.current.isExpired).toBe(true);
  });

  it('extendSession resets the session', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    act(() => {
      vi.advanceTimersByTime((10 - 2) * 60 * 1000);
    });
    expect(result.current.showWarning).toBe(true);

    act(() => {
      result.current.extendSession();
    });

    expect(result.current.timeLeft).toBe(600);
    expect(result.current.showWarning).toBe(false);
    expect(result.current.isExpired).toBe(false);
  });

  it('initiateReauth enters reauthenticating state and hides warning', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    act(() => {
      vi.advanceTimersByTime((10 - 2) * 60 * 1000);
    });
    expect(result.current.showWarning).toBe(true);

    act(() => {
      result.current.initiateReauth();
    });

    expect(result.current.isReauthenticating).toBe(true);
    expect(result.current.showWarning).toBe(false);
  });

  it('reauthSuccess resets session and calls onReauthSuccess', () => {
    const onReauthSuccess = vi.fn();
    const { result } = renderHook(() => 
      useSession({ ...defaultOptions, onReauthSuccess })
    );

    act(() => {
      result.current.initiateReauth();
    });

    act(() => {
      result.current.reauthSuccess();
    });

    expect(result.current.isReauthenticating).toBe(false);
    expect(result.current.timeLeft).toBe(600);
    expect(onReauthSuccess).toHaveBeenCalledTimes(1);
  });
});

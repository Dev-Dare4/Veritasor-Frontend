import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession, UseSessionOptions } from './useSession';

describe('useSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const defaultOptions: UseSessionOptions = {
    sessionDurationMinutes: 10,
    warningBeforeMinutes: 2,
  };

  it('initializes with the configured time and inactive warning state', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    expect(result.current.timeLeft).toBe(600);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.showWarning).toBe(false);
    expect(result.current.isReauthenticating).toBe(false);
  });

  it('shows warning at duration minus warningBefore and expires once', () => {
    const onSessionExpiry = vi.fn();
    const { result } = renderHook(() =>
      useSession({ ...defaultOptions, onSessionExpiry })
    );

    act(() => {
      vi.advanceTimersByTime(8 * 60 * 1000 - 1);
    });
    expect(result.current.showWarning).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.showWarning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(result.current.isExpired).toBe(true);
    expect(result.current.showWarning).toBe(false);
    expect(onSessionExpiry).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onSessionExpiry).toHaveBeenCalledTimes(1);
  });

  it('throttles 1,000 activity events to one reset and keeps one interval', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const { result } = renderHook(() => useSession(defaultOptions));
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      for (let i = 0; i < 1000; i += 1) {
        window.dispatchEvent(new Event('mousemove'));
        vi.advanceTimersByTime(20);
      }
    });

    expect(result.current.timeLeft).toBe(580);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 - 20_000);
    });
    expect(result.current.isExpired).toBe(true);
  });

  it('allows one activity reset after the 30-second throttle window', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(29_999);
      window.dispatchEvent(new Event('mousemove'));
    });
    expect(result.current.timeLeft).toBe(571);

    act(() => {
      vi.advanceTimersByTime(1);
      window.dispatchEvent(new Event('mousemove'));
    });
    expect(result.current.timeLeft).toBe(600);
  });

  it('does not count activity while the warning is open; extending resets it', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    act(() => {
      vi.advanceTimersByTime(8 * 60 * 1000);
    });
    expect(result.current.showWarning).toBe(true);
    expect(result.current.timeLeft).toBe(120);

    act(() => {
      vi.advanceTimersByTime(5000);
      window.dispatchEvent(new Event('mousemove'));
    });
    expect(result.current.timeLeft).toBe(115);

    act(() => {
      result.current.extendSession();
    });
    expect(result.current.timeLeft).toBe(600);
    expect(result.current.showWarning).toBe(false);
    expect(result.current.isExpired).toBe(false);

    act(() => {
      vi.advanceTimersByTime(8 * 60 * 1000);
    });
    expect(result.current.showWarning).toBe(true);
  });

  it('does not expire while re-authentication is active and resets on success', () => {
    const onSessionExpiry = vi.fn();
    const { result } = renderHook(() =>
      useSession({ ...defaultOptions, onSessionExpiry })
    );

    act(() => {
      vi.advanceTimersByTime(8 * 60 * 1000);
      result.current.initiateReauth();
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(result.current.isExpired).toBe(false);
    expect(result.current.showWarning).toBe(false);
    expect(onSessionExpiry).not.toHaveBeenCalled();

    act(() => {
      result.current.reauthSuccess();
    });
    expect(result.current.isReauthenticating).toBe(false);
    expect(result.current.timeLeft).toBe(600);
    expect(result.current.isExpired).toBe(false);
  });

  it('uses the latest expiry callback and does not expire twice', () => {
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    const { rerender } = renderHook(
      ({ onSessionExpiry }) =>
        useSession({ ...defaultOptions, onSessionExpiry }),
      { initialProps: { onSessionExpiry: firstCallback } }
    );

    rerender({ onSessionExpiry: latestCallback });
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledTimes(1);
  });

  it('does not reset an expired session on activity', () => {
    const { result } = renderHook(() => useSession(defaultOptions));

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(result.current.isExpired).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });
    expect(result.current.isExpired).toBe(true);
    expect(result.current.timeLeft).toBe(0);
  });

  it('cleans up its interval and supported activity listeners on unmount', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useSession(defaultOptions));
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    expect(vi.getTimerCount()).toBe(1);
    unmount();

    for (const event of activityEvents) {
      expect(addListener).toHaveBeenCalledWith(event, expect.any(Function));
      expect(removeListener).toHaveBeenCalledWith(event, expect.any(Function));
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resets its deadline when duration configuration changes', () => {
    const { result, rerender } = renderHook(
      ({ sessionDurationMinutes }) =>
        useSession({ ...defaultOptions, sessionDurationMinutes }),
      { initialProps: { sessionDurationMinutes: 10 } }
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    rerender({ sessionDurationMinutes: 5 });
    expect(result.current.timeLeft).toBe(300);
    expect(result.current.showWarning).toBe(false);
  });
});

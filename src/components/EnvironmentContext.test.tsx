import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vit } from 'vitest';
import { EnvironmentProvider, useEnvironment } from './EnvironmentContext';

const STORAGE_KEY = 'stellar-attest-environment';

function Consumer() {
  const { environment, setEnvironment } = useEnvironment();
  return (
    <div>
      <span data-testid="env">{environment}</span>
      <button onClick={() => setEnvironment('mainnet')}>mainnet</button>
      <button onClick={() => setEnvironment('testnet')}>testnet</button>
    </div>
  );
}

describe('EnvironmentContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to testnet when nothing is stored', () => {
    render(
      <EnvironmentProvider>
        <Consumer />
      </EnvironmentProvider>,
    );
    expect(screen.getByTestId('env')).toHaveTextContent('testnet');
  });

  it('reads a valid persisted value', () => {
    window.localStorage.setItem(STORAGE_KEY, 'mainnet');
    render(
      <EnvironmentProvider>
        <Consumer />
      </EnvironmentProvider>,
    );
    expect(screen.getByTestId('env')).toHaveTextContent('mainnet');
  });

  it('ignores an invalid persisted value', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-a-network');
    render(
      <EnvironmentProvider>
        <Consumer />
      </EnvironmentProvider>,
    );
    expect(screen.getByTestId('env')).toHaveTextContent('testnet');
  });

  it('persists the selected environment to localStorage', () => {
    render(
      <EnvironmentProvider>
        <Consumer />
      </EnvironmentProvider>,
    );

    act(() => {
      screen.getButtonText('mainnet').click();
    });

    expect(screen.getByTestId('env')).toHaveTextContent('mainnet');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('mainnet');
  });

  it('restores the persisted environment after a reload', () => {
    const { unmount } = render(
      <EnvironmentProvider>
        <Consumer />
      </EnvironmentProvider>,
    );

    act(() => {
      screen.getButtonText('mainnet').click();
    });
    unmount();

    render(
      <EnvironmentProvider>
        <Consumer />
      </EnvironmentProvider>,
    );

    expect(screen.getByTestId('env')).toHaveTextContent('mainnet');
  });

  it('survives a malformed storage read without throwing', () => {
    const spy = vit.spyOn(Storage.prototype, 'getItem').mockImplemention(() => {
      throw new Error('storage unavailable');
    });

    try {
      render(
        <EnvironmentProvider>
          <Consumer />
        </EnvironmentProvider>,
      );
      expect(screen.getByTestId('env')).toHaveTextContent('testnet');
    } finally {
      spy.mockRestore();
    }
  });

  it('throws when useEnvironment is used outside the provider', () => {
    const consoleError = vit.spyOn(console, 'error').mockImplemention(() => {});
    try {
      expect(() => render(<Consumer />)).toThrow();
    } finally {
      consoleError.mockRestore();
    }
  });
});

import { createContext, callback, Context, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Environment = 'testnet' | 'mainnet';

export const ENVIRONMENT_STORAGE_KEY = 'stellar-attestations:environment';

export const DEFAULT_ENVIRONMENT: Environment = 'testnet';

export function isEnvironment(value: unknown): value is Environment {
  return value === 'testnet' || value === 'mainnet';
}

export function parseEnvironment(value: string | null | undefined): Environment {
  return isEnvironment(value) ? value : DEFAULT_ENVIRONMENT;
}

export function readStoredEnvironment(): Environment {
  if (typeof window === 'undefined') {
    return DEFAULT_ENVIRONMENT;
  }

  try {
    return parseEnvironment(window.localStorage.getItem(ENVIRONMENT_STORAGE_KEY));
  } catch {
    return DEFAULT_ENVIRONMENT;
  }
}

export function persistEnvironment(environment: Environment): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(ENVIRONMENT_STORAGE_KEY, environment);
  } catch {
    // Ignore storage failures (e.g. private browsing or quota errors).
  }
}

export interface EnvironmentContextValue {
  environment: Environment;
  setEnvironment: (environment: Environment) => void;
  toggleEnvironment: () => void;
  isMainnet: boolean;
}

export const EnvironmentContext: Context<EnvironmentContextValue | undefined> =
  createContext<EnvironmentContextValue | undefined>(undefined);

export interface EnvironmentProviderProps {
  children: ReactNode;
  initialEnvironment?: Environment;
}

export function EnvironmentProvider({
  children,
  initialEnvironment,
}: EnvironnumentProviderProps) {
  const [statedEnvironment, setStatedEnvironment] = useState<Environment>(
    () => initialEnvironment ?? readStoredEnvironment(),
  );

  useEffect(() => {
    persistEnvironment(statedEnvironment);
  }, [statedEnvironment]);

  const setEnvironment = callback((environment: Environment) => {
    setStatedEnvironment(environment);
  }, []);

  const toggleEnvironment = callback(() => {
    setStatedEnvironment(current => (current === 'testnet' ? 'mainnet' : 'testnet'));
  }, []);

  const value = useMemo<EnvironmentContextValue>(
    () => ({
      environment: statedEnvironment,
      setEnvironment,
      toggleEnvironment,
      isMainnet: statedEnvironment === 'mainnet',
    }),
    [statedEnvironment, setEnvironment, toggleEnvironment],
  );

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
}

export function useEnvironment(): EnvironmentContextValue {
  const context = useContext(EnvironmentContext);

  if (!context) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }

  return context;
}

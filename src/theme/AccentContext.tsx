import React, { createContext, useCallback, useContext, useState } from 'react';
import { tabAccents, TabAccent } from './tabAccents';

const DEFAULT_ACCENT = tabAccents.dashboard;
const NOOP_SETTER: (a: TabAccent) => void = () => {};

const AccentValueContext = createContext<TabAccent>(DEFAULT_ACCENT);
const AccentSetterContext = createContext<(a: TabAccent) => void>(NOOP_SETTER);

export function useAccent(): TabAccent {
  return useContext(AccentValueContext);
}

export function useAccentSetter(): (a: TabAccent) => void {
  return useContext(AccentSetterContext);
}

interface ProviderProps {
  children: React.ReactNode;
}

export const AccentProvider: React.FC<ProviderProps> = ({ children }) => {
  const [accent, setAccent] = useState<TabAccent>(DEFAULT_ACCENT);
  const stableSetter = useCallback((next: TabAccent) => setAccent(next), []);
  return (
    <AccentSetterContext.Provider value={stableSetter}>
      <AccentValueContext.Provider value={accent}>
        {children}
      </AccentValueContext.Provider>
    </AccentSetterContext.Provider>
  );
};

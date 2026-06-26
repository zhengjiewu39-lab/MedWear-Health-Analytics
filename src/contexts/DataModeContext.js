import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'medwear_mode';
const DataModeContext = createContext(null);

export function DataModeProvider({ children }) {
  const [mode, setModeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'demo');
  const [version, setVersion] = useState(0);

  const setMode = useCallback((next) => {
    const m = next === 'real' ? 'real' : 'demo';
    localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
    setVersion(v => v + 1);
    window.dispatchEvent(new CustomEvent('medwear-mode-change', { detail: m }));
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'demo' ? 'real' : 'demo');
  }, [mode, setMode]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  return (
    <DataModeContext.Provider value={{
      mode,
      isDemo: mode === 'demo',
      isReal: mode === 'real',
      setMode,
      toggleMode,
      version,
    }}>
      {children}
    </DataModeContext.Provider>
  );
}

export function useDataMode() {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error('useDataMode must be used within DataModeProvider');
  return ctx;
}

export default DataModeContext;

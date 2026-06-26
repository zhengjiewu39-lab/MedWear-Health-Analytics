import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dataApi } from '../services/api';
import { useDataMode } from './DataModeContext';

const HealthDataContext = createContext(null);

export function HealthDataProvider({ children }) {
  const [status, setStatus] = useState({ hasData: false, meta: null, primarySource: null });
  const [loading, setLoading] = useState(true);
  const { isReal } = useDataMode();

  const refresh = useCallback(async () => {
    if (!isReal) {
      setStatus({ hasData: false, meta: null, primarySource: null });
      setLoading(false);
      return;
    }
    try {
      const res = await dataApi.getStatus();
      setStatus(res.data);
    } catch {
      setStatus({ hasData: false, meta: null, primarySource: null });
    } finally {
      setLoading(false);
    }
  }, [isReal]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('medwear-mode-change', handler);
    return () => window.removeEventListener('medwear-mode-change', handler);
  }, [refresh]);

  return (
    <HealthDataContext.Provider value={{ ...status, loading, refresh }}>
      {children}
    </HealthDataContext.Provider>
  );
}

export function useHealthData() {
  const ctx = useContext(HealthDataContext);
  if (!ctx) throw new Error('useHealthData must be used within HealthDataProvider');
  return ctx;
}

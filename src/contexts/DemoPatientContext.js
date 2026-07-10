import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { demoApi } from '../services/api';
import { useDataMode } from './DataModeContext';

const STORAGE_KEY = 'medwear_demo_patient';
const DEFAULT_ID = 'IV-0001';

const LEGACY_ID_MAP = {
  'demo-001': 'IV-0008',
  'demo-002': 'IV-0033',
  'demo-003': 'IV-0018',
  'demo-004': 'IV-0204',
  'demo-005': 'IV-0019',
  'demo-006': 'IV-0027',
  'demo-007': 'IV-0005',
  'demo-008': 'IV-0007',
};

function normalizePatientId(id) {
  if (!id) return DEFAULT_ID;
  return LEGACY_ID_MAP[id] || id;
}

const DemoPatientContext = createContext(null);

export function DemoPatientProvider({ children }) {
  const { isDemo } = useDataMode();
  const [patientId, setPatientIdState] = useState(() => normalizePatientId(localStorage.getItem(STORAGE_KEY)));
  const [current, setCurrent] = useState(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  const setPatientId = useCallback((id) => {
    const next = normalizePatientId(id);
    localStorage.setItem(STORAGE_KEY, next);
    setPatientIdState(next);
    setVersion((v) => v + 1);
    window.dispatchEvent(new CustomEvent('medwear-demo-patient-change', { detail: next }));
  }, []);

  const refreshCurrent = useCallback(async () => {
    if (!isDemo) {
      setCurrent(null);
      setLoading(false);
      return;
    }
    const pid = normalizePatientId(patientId);
    setLoading(true);
    try {
      const res = await demoApi.getPatient(pid);
      setCurrent(res.data?.patient || null);
      if (res.data?.activeId && res.data.activeId !== pid) {
        setPatientIdState(normalizePatientId(res.data.activeId));
      }
    } catch {
      const list = await demoApi.listPatients({ q: pid, limit: 1 }).catch(() => null);
      setCurrent(list?.data?.patients?.[0] || null);
    } finally {
      setLoading(false);
    }
  }, [isDemo, patientId]);

  useEffect(() => { refreshCurrent(); }, [refreshCurrent, version]);

  return (
    <DemoPatientContext.Provider value={{
      patientId: normalizePatientId(patientId),
      setPatientId,
      current,
      version,
      loading,
      refreshCurrent,
      isDemo,
      cohortSize: 5000,
    }}>
      {children}
    </DemoPatientContext.Provider>
  );
}

export function useDemoPatient() {
  const ctx = useContext(DemoPatientContext);
  if (!ctx) throw new Error('useDemoPatient must be used within DemoPatientProvider');
  return ctx;
}

export default DemoPatientContext;

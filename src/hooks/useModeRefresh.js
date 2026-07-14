import { useEffect } from 'react';
import { useDataMode } from '../contexts/DataModeContext';
import { useDemoPatient } from '../contexts/DemoPatientContext';

/**
 * Re-run `callback` when demo/real data mode or demo patient changes.
 * @param {() => void} callback
 * @param {unknown[]} [deps]
 */
export function useModeRefresh(callback, deps = []) {
  const { version } = useDataMode();
  const { version: patientVersion } = useDemoPatient();

  useEffect(() => {
    callback();
    const onImport = () => callback();
    window.addEventListener('medwear-health-import', onImport);
    return () => window.removeEventListener('medwear-health-import', onImport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, patientVersion, ...deps]);
}

export default useModeRefresh;

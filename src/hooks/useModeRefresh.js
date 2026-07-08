import { useEffect } from 'react';
import { useDataMode } from '../contexts/DataModeContext';

/**
 * Re-run `callback` when demo/real data mode changes (via `version` bump in DataModeContext).
 * @param {() => void} callback
 * @param {unknown[]} [deps]
 */
export function useModeRefresh(callback, deps = []) {
  const { version } = useDataMode();

  useEffect(() => {
    callback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);
}

export default useModeRefresh;

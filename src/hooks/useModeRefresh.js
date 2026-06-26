import { useEffect } from 'react';
import { useDataMode } from '../contexts/DataModeContext';

/** 模式切换时自动重新加载数据 */
export function useModeRefresh(callback, deps = []) {
  const { version } = useDataMode();

  useEffect(() => {
    callback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  useEffect(() => {
    const handler = () => callback();
    window.addEventListener('medwear-mode-change', handler);
    return () => window.removeEventListener('medwear-mode-change', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback]);
}

export default useModeRefresh;

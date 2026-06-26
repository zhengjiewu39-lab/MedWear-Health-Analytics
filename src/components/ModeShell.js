import React from 'react';
import { Alert, LinearProgress } from '@mui/material';
import { useDataMode } from '../contexts/DataModeContext';
import { useHealthData } from '../contexts/HealthDataContext';
import { RequireHealthData, RealDataChip } from './RealDataGuard';

/** 演示/真实模式隔离：演示显示模拟数据提示；真实无数据时引导导入 */
export function ModeShell({ children, title, requireData = true }) {
  const { isDemo, isReal } = useDataMode();
  const { hasData, loading, primarySource, meta } = useHealthData();

  if (isDemo) {
    return (
      <>
        <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
          演示模式 · 以下为临床标准<strong>模拟数据</strong>，与真实模式完全隔离
        </Alert>
        {children}
      </>
    );
  }

  if (requireData) {
    if (loading) return <LinearProgress sx={{ mb: 2 }} />;
    if (!hasData) return <RequireHealthData title={title} />;
  }

  const day = meta?.dateRange?.end;
  return (
    <>
      {hasData && <RealDataChip source={primarySource || 'Apple Health'} day={day} />}
      {children}
    </>
  );
}

export default ModeShell;

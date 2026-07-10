import React from 'react';
import { Alert, LinearProgress } from '@mui/material';
import { useDataMode } from '../contexts/DataModeContext';
import { useDemoPatient } from '../contexts/DemoPatientContext';
import { useHealthData } from '../contexts/HealthDataContext';
import { RequireHealthData, RealDataChip } from './RealDataGuard';
import AiExemptBanner from './AiExemptBanner';

/**
 * 演示/真实模式隔离：
 * - 演示模式：模拟数据提示
 * - 真实模式 + requireData：须先导入数据
 * - 真实模式 + aiExempt：部分 AI 功能不受数据限制（不含 AI 干预）
 */
export function ModeShell({ children, title, requireData = true, aiExempt = false }) {
  const { isDemo } = useDataMode();
  const { current: demoPatient } = useDemoPatient();
  const { hasData, loading, primarySource, meta } = useHealthData();

  if (isDemo) {
    return (
      <>
        <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
          演示模式 · 当前患者：<strong>{demoPatient?.name || '—'}</strong>
          {demoPatient?.id ? `（${demoPatient.id}）` : ''}
          {demoPatient?.scenario ? ` · ${demoPatient.scenario}` : ''}
          · 共 5000 名演示者可选，生理指标与 AI 分析随切换而变化
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
      {!hasData && aiExempt && <AiExemptBanner />}
      {children}
    </>
  );
}

export default ModeShell;

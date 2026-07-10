import React from 'react';
import { Alert } from '@mui/material';
import { Psychology } from '@mui/icons-material';
import { useLang } from '../contexts/LanguageContext';

/** Shown on AI pages in real mode when personal health data is not yet imported. */
export function AiExemptBanner() {
  const { t } = useLang();
  return (
    <Alert
      severity="info"
      icon={<Psychology />}
      sx={{ mb: 2 }}
      variant="outlined"
    >
      <strong>{t('AI 功能已启用', 'AI features enabled')}</strong>
      {' — '}
      {t(
        '真实模式下 AI 分析（异常研判、预测解读、临床助手）可在未导入个人数据时使用；AI 干预及临床路径步骤（筛查、报告、预约等）需先导入 Apple Health。',
        'In real mode, AI analysis (anomaly review, predictions, clinical assistant) works without personal data upload; AI interventions and clinical pathway steps (screening, reports, appointments) require Apple Health import first.',
      )}
    </Alert>
  );
}

export default AiExemptBanner;

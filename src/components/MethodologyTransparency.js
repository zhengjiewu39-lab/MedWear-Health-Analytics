import React from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, Chip, Alert,
} from '@mui/material';
import { Science } from '@mui/icons-material';
import { useLang } from '../contexts/LanguageContext';

function ListBlock({ title, items, isEn }) {
  if (!items?.length) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>{title}</Typography>
      <Typography component="ul" variant="body2" sx={{ pl: 2, m: 0 }}>
        {items.map((x) => (
          <li key={x}>{isEn ? x : x}</li>
        ))}
      </Typography>
    </Box>
  );
}

export default function MethodologyTransparency({ data, scenarios }) {
  const { t, isEn } = useLang();
  if (!data) return null;

  const hs = data.healthScore;
  const an = data.anomalyDetection;
  const re = data.ruleEngine;
  const co = data.cohortSimulation;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Science color="primary" />
        <Typography variant="h6" fontWeight={700}>
          {t('方法论透明度（诚实披露）', 'Methodology transparency (honest disclosure)')}
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t(hs?.label_zh, hs?.label_en)}
        {' · '}
        {t('非疾病风险评分', 'Not a disease-risk score')}
      </Alert>

      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        1. {t('行为健康指数 BHI', 'Behavioral Health Index (BHI)')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
        {hs?.weights && Object.entries(hs.weights).map(([k, v]) => (
          <Chip key={k} size="small" label={`${k} ${(v * 100).toFixed(0)}%`} />
        ))}
      </Box>
      <ListBlock title={t('改进', 'Improvements')} items={hs?.features} isEn={isEn} />
      <ListBlock title={t('局限', 'Limitations')} items={hs?.limitations_en} isEn={isEn} />

      <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
        2. {t('异常检测', 'Anomaly detection')}
      </Typography>
      <Typography variant="body2" paragraph>
        {t(an?.label_zh, an?.label_en)}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        HR: {an?.hrRule} · SpO₂: {an?.spo2Rule}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {t('敏感性预设', 'Sensitivity presets')}: {(an?.sensitivityPresets || []).join(' · ')}
      </Typography>

      <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
        3. {t('规则引擎（非 ML 集成）', 'Rule engine (not ML ensemble)')}
      </Typography>
      <Typography variant="body2" paragraph>{t(re?.label_zh, re?.label_en)}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {t('已移除', 'Removed')}: {(re?.removedClaims || []).join('; ')}
      </Typography>
      <Table size="small" sx={{ mb: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>{t('领域', 'Domain')}</TableCell>
            <TableCell>{t('权重', 'Weight')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(re?.domainWeights || []).map((d) => (
            <TableRow key={d.domain}>
              <TableCell>{d.domain}</TableCell>
              <TableCell>{(d.weight * 100).toFixed(0)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
        4. {t('合成队列情景模拟', 'Synthetic cohort scenario simulation')}
      </Typography>
      <Alert severity="warning" sx={{ mb: 1 }}>
        {t(co?.label_zh, co?.label_en)} — {t('无 p 值', 'No p-values')}
      </Alert>
      {scenarios?.scenarios && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('情景', 'Scenario')}</TableCell>
              <TableCell>{t('早诊 Δ', 'Early dx Δ')}</TableCell>
              <TableCell>{t('治疗率 Δ', 'Treatment Δ')}</TableCell>
              <TableCell>{t('5y存活 Δ', '5y survival Δ')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scenarios.scenarios.map((s) => (
              <TableRow key={s.scenario}>
                <TableCell>{s.scenario}</TableCell>
                <TableCell>{s.headline?.earlyDiagnosisRate?.absoluteDelta ?? '—'}</TableCell>
                <TableCell>{s.headline?.treatmentRate?.absoluteDelta ?? '—'}</TableCell>
                <TableCell>{s.headline?.survival5y?.absoluteDelta ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

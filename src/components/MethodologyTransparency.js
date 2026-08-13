import React from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, Chip, Alert,
} from '@mui/material';
import { Science } from '@mui/icons-material';
import { useLang } from '../contexts/LanguageContext';

function ListBlock({ title, items }) {
  if (!items?.length) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>{title}</Typography>
      <Typography component="ul" variant="body2" sx={{ pl: 2, m: 0 }}>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </Typography>
    </Box>
  );
}

export default function MethodologyTransparency({ data, scenarios }) {
  const { t, isEn } = useLang();
  if (!data) return null;

  const hs = data.healthScore;
  const al = data.alerts;
  const an = data.anomalyDetection;
  const re = data.ruleEngine;
  const onnx = data.optionalOnnxBackend;
  const co = data.cohortSimulation;
  const presetNames = an?.sensitivityPresets ? Object.keys(an.sensitivityPresets) : [];

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Science color="primary" />
        <Typography variant="h6" fontWeight={700}>
          {t('方法论透明度（诚实披露）', 'Methodology transparency (honest disclosure)')}
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t(hs?.disclaimer_zh, hs?.disclaimer_en)}
      </Alert>

      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        1. {t('行为健康指数 BHI', 'Behavioral Health Index (BHI)')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
        {hs?.weights && Object.entries(hs.weights).map(([k, v]) => (
          <Chip key={k} size="small" label={`${k} ${(v * 100).toFixed(0)}%`} />
        ))}
      </Box>
      <ListBlock
        title={t('公式', 'Formulas')}
        items={isEn ? hs?.formulas_en : hs?.formulas_zh}
      />
      <ListBlock
        title={t('局限', 'Limitations')}
        items={isEn ? hs?.limitations_en : hs?.limitations_zh}
      />

      <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
        2. {t('阈值告警', 'Threshold alerts')}
      </Typography>
      <Typography variant="body2" paragraph>
        {t(al?.label_zh, al?.label_en)}
      </Typography>
      <ListBlock
        title={t('规则', 'Rules')}
        items={isEn ? al?.rules_en : al?.rules_zh}
      />

      <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
        3. {t('异常检测（稳健 MAD）', 'Anomaly detection (robust MAD)')}
      </Typography>
      <Alert severity="warning" sx={{ mb: 1 }}>
        {t(an?.disclaimer_zh, an?.disclaimer_en)}
      </Alert>
      <Typography variant="body2" paragraph>
        {t(an?.label_zh, an?.label_en)}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        HR: {t(an?.hrRule_zh, an?.hrRule_en)}
        {' · '}
        SpO₂: {t(an?.spo2Rule_zh, an?.spo2Rule_en)}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {t('敏感性预设', 'Sensitivity presets')}: {presetNames.join(' · ') || '—'}
      </Typography>
      <ListBlock
        title={t('局限', 'Limitations')}
        items={isEn ? an?.limitations_en : an?.limitations_zh}
      />

      <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
        4. {t('规则引擎（非 ML 集成）', 'Rule engine (not ML ensemble)')}
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
      <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mt: 1 }}>
        {t('诚实 API 字段', 'Honest API fields')}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        {['overallBhiTier', 'attentionScore', 'evidenceAdjustedAttentionScore', 'signalLevel', 'heuristicSupport'].map((f) => (
          <Chip key={f} size="small" variant="outlined" label={f} />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {t('已弃用别名', 'Deprecated')}: {(re?.apiFields?.deprecatedAliases || []).join(', ')}
      </Typography>
      {re?.fusionWeights && (
        <Alert severity="info" sx={{ mb: 1 }}>
          {t('融合展示权重', 'Fusion presentation weights')}: wearable {re.fusionWeights.wearable} · clinical {re.fusionWeights.clinical} · behavioral {re.fusionWeights.behavioral}
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            {t(re?.fusionWeightsDisclaimer_zh, re?.fusionWeightsDisclaimer_en)}
          </Typography>
        </Alert>
      )}

      {onnx && (
        <>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
            4b. {t('可选 ONNX 后端（默认关闭）', 'Optional ONNX backend (default off)')}
          </Typography>
          <Alert severity="warning" sx={{ mb: 1 }}>
            {t(onnx.defaultCore_zh, onnx.defaultCore_en)}
          </Alert>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {onnx.enableFlag}
          </Typography>
        </>
      )}

      <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
        5. {t('探索性情景模拟', 'Exploratory scenario simulation')}
      </Typography>
      <Alert severity="warning" sx={{ mb: 1 }}>
        {t(co?.label_zh, co?.label_en)} — {t('无 p 值', 'No p-values')}
      </Alert>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t(co?.disclaimer_zh, co?.disclaimer_en)}
      </Typography>
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

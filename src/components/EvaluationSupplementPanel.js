import React from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, Alert, Chip,
} from '@mui/material';
import { Science, Warning } from '@mui/icons-material';
import { useLang } from '../contexts/LanguageContext';

export default function EvaluationSupplementPanel({ data }) {
  const { t, isEn } = useLang();
  if (!data) return null;

  const sc = data.scenarios;
  const fp = data.fpBurden;
  const ml = data.mlComparison;
  const ext = data.externalDescriptive;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Science color="secondary" />
        <Typography variant="h6" fontWeight={700}>
          {t('评测补充（固化结果）', 'Evaluation supplement (frozen results)')}
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t(
          '情景模拟、假阳性负担、ML 对比与外部代理基线 — 由 npm run evaluate:supplement 生成',
          'Scenario sensitivity, FP burden, ML comparison & external proxy baselines — from npm run evaluate:supplement',
        )}
      </Alert>

      {sc?.scenarios?.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            {t('情景敏感性（无 p 值）', 'Scenario sensitivity (no p-values)')}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('情景', 'Scenario')}</TableCell>
                <TableCell>{t('早诊 Δ', 'Early dx Δ')}</TableCell>
                <TableCell>{t('治疗率 Δ', 'Treatment Δ')}</TableCell>
                <TableCell>{t('5y 存活 Δ', '5y survival Δ')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sc.scenarios.map((row) => (
                <TableRow key={row.scenario}>
                  <TableCell><Chip size="small" label={row.scenario} /></TableCell>
                  <TableCell>{row.headline?.earlyDiagnosisRate?.absoluteDelta ?? '—'}</TableCell>
                  <TableCell>{row.headline?.treatmentRate?.absoluteDelta ?? '—'}</TableCell>
                  <TableCell>{row.headline?.survival5y?.absoluteDelta ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {fp?.per1000 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            {t('假阳性下游负担（/1000 人）', 'FP downstream burden (per 1000)')}
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow><TableCell>{t('误报告警', 'FP alerts')}</TableCell><TableCell>{fp.per1000.falsePositiveAlerts}</TableCell></TableRow>
              <TableRow><TableCell>{t('估计额外随访', 'Est. follow-ups')}</TableCell><TableCell>{fp.per1000.estimatedFollowUpWorkups}</TableCell></TableRow>
              <TableRow><TableCell>{t('估计额外门诊', 'Est. outpatient visits')}</TableCell><TableCell>{fp.per1000.estimatedExtraOutpatientVisits}</TableCell></TableRow>
              <TableRow><TableCell>{t('告警精确率', 'Alert precision')}</TableCell><TableCell>{fp.alertMetrics?.precision ?? '—'}</TableCell></TableRow>
            </TableBody>
          </Table>
        </Box>
      )}

      {ml?.ruleEngine && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            {t('规则引擎 vs 基线', 'Rule engine vs baselines')}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('模型', 'Model')}</TableCell>
                <TableCell>{t('指标', 'Metric')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>MedWear-RuleEngine-v1</TableCell>
                <TableCell>risk {ml.ruleEngine.riskAccuracy} · F1 {ml.ruleEngine.alertF1}</TableCell>
              </TableRow>
              {(ml.nodeBaselines || []).map((b) => (
                <TableRow key={b.name}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>acc {b.accuracy} · F1 {b.macroF1}</TableCell>
                </TableRow>
              ))}
              {(ml.mlModels || []).map((b) => (
                <TableRow key={b.name}>
                  <TableCell>{b.name} (sklearn)</TableCell>
                  <TableCell>acc {b.accuracy} · F1 {b.macroF1}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {ml.pythonRequired && ml.mlModels?.length === 0 && (
            <Alert severity="warning" icon={<Warning />} sx={{ mt: 1 }}>
              {t('安装 Python 依赖以运行 sklearn 对比：', 'Install Python deps for sklearn comparison:')}
              {' '}pip install -r experiments/medwear/requirements-min.txt
            </Alert>
          )}
          {ml.featureLeakageWarning && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {isEn ? ml.featureLeakageWarning : '导出特征含引擎衍生的 BHI/异常标记 — sklearn 在同导出上可能虚高，不代表独立验证。'}
            </Alert>
          )}
        </Box>
      )}

      {ext && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            {t('外部/可移植特征基线', 'External / portable feature baseline')}
          </Typography>
          {ext.wesadStressProxy && (
            <Typography variant="body2" color="text.secondary">
              WESAD proxy: n={ext.wesadStressProxy.n} · BHI-tier {ext.wesadStressProxy.heuristicBhiTierAccuracy}
            </Typography>
          )}
          {ext.internalExport && (
            <Typography variant="body2" color="text.secondary">
              {t('内部导出', 'Internal export')}: n={ext.internalExport.n} · BHI-tier {ext.internalExport.heuristicBhiTierAccuracy}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}

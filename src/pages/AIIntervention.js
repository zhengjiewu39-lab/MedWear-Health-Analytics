import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Button, LinearProgress,
  Alert, Tabs, Tab, Stack, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Divider,
} from '@mui/material';
import {
  Psychology, Refresh, CheckCircle, Cancel, Gavel, AutoAwesome,
  LocalHospital, Assignment, Science, Groups,
} from '@mui/icons-material';
import InterventionPathway from '../components/InterventionPathway';
import AiGovernanceBanner from '../components/AiGovernanceBanner';
import { interventionApi } from '../services/api';
import { useLang } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import useModeRefresh from '../hooks/useModeRefresh';

const PRIORITY_COLOR = { high: 'error', medium: 'warning', low: 'success' };
const STATUS_COLOR = { pending: 'warning', approved: 'success', rejected: 'default' };
const SOURCE_ICON = {
  screening: <Science fontSize="small" />,
  anomaly: <Psychology fontSize="small" />,
  prediction: <AutoAwesome fontSize="small" />,
  profile: <Groups fontSize="small" />,
  cohort: <Groups fontSize="small" />,
};

function AIIntervention() {
  const { t, isEn } = useLang();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, list] = await Promise.all([
        interventionApi.getSummary(),
        interventionApi.getAll({ status: tab === 'all' ? undefined : tab }),
      ]);
      setSummary(s.data);
      setItems(list.data?.interventions || list.data || []);
    } catch {
      setSummary(null);
      setItems([]);
      setError(t(
        '无法连接 AI 干预 API（404）。请重启后端：在项目目录运行 npm run dev',
        'Cannot reach AI intervention API (404). Restart the backend with npm run dev',
      ));
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  useModeRefresh(load);

  const handleGenerate = async () => {
    setActing(true);
    setError('');
    try {
      await interventionApi.generate();
      await load();
    } catch {
      setError(t('生成干预建议失败，请确认后端已重启', 'Failed to generate interventions — ensure the backend is running'));
    } finally {
      setActing(false);
    }
  };

  const submitReview = async (approve) => {
    if (!reviewTarget) return;
    setActing(true);
    setError('');
    try {
      const payload = { note: note || undefined, user: user?.username, role: user?.role };
      if (approve) await interventionApi.approve(reviewTarget.id, payload);
      else await interventionApi.reject(reviewTarget.id, payload);
      setReviewTarget(null);
      setNote('');
      await load();
    } catch {
      setError(t('审批操作失败，请重试', 'Review action failed — please try again'));
    } finally {
      setActing(false);
    }
  };

  const pick = (item, field) => (isEn && item[`${field}_en`]) || item[field];

  if (loading && !summary) return <LinearProgress />;

  const canReview = isAdmin;

  return (
    <Box>
      <InterventionPathway />
      <AiGovernanceBanner />
      {summary?.patient?.name && (
        <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
          {t(
            `当前演示者：${summary.patient.name}（${summary.patient.id}）· ${summary.patient.scenario || ''} · 以下干预建议均基于该患者筛查/异常/预测信号生成`,
            `Active participant: ${summary.patient.name} (${summary.patient.id}) · ${summary.patient.scenario_en || summary.patient.scenario || ''} · interventions are generated from this patient’s signals only`,
          )}
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            <Psychology sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('AI 干预中心', 'AI Intervention Hub')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('融合筛查·异常·预测信号，AI 自动生成干预建议；医师/管理者审批后进入临床执行',
              'Fuses screening, anomaly and prediction signals; AI auto-generates interventions — clinicians/admins approve before clinical execution')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<Refresh />} onClick={load}>{t('刷新', 'Refresh')}</Button>
          <Button variant="contained" startIcon={<AutoAwesome />} onClick={handleGenerate} disabled={acting}>
            {t('重新生成 AI 建议', 'Regenerate AI suggestions')}
          </Button>
        </Stack>
      </Box>

      {summary && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            { label: t('待审批', 'Pending'), value: summary.pending, color: 'warning.main' },
            { label: t('已批准', 'Approved'), value: summary.approved, color: 'success.main' },
            { label: t('已驳回', 'Rejected'), value: summary.rejected, color: 'text.secondary' },
            { label: t('高优先级待审', 'High-priority pending'), value: summary.highPriorityPending, color: 'error.main' },
          ].map((s) => (
            <Grid item xs={6} md={3} key={s.label}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab value="pending" label={t('待审批', 'Pending')} />
          <Tab value="approved" label={t('已批准', 'Approved')} />
          <Tab value="rejected" label={t('已驳回', 'Rejected')} />
          <Tab value="all" label={t('全部', 'All')} />
        </Tabs>
      </Paper>

      {items.length === 0 ? (
        <Alert severity="info" action={<Button onClick={handleGenerate}>{t('生成', 'Generate')}</Button>}>
          {t('暂无干预建议，点击重新生成', 'No interventions yet — click regenerate')}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {items.map((item) => (
            <Grid item xs={12} md={6} key={item.id}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderLeft: 4,
                  borderColor: `${PRIORITY_COLOR[item.priority]}.main`,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {SOURCE_ICON[item.source]}
                      <Typography variant="subtitle2" fontWeight={700}>{pick(item, 'title')}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="small" label={item.status} color={STATUS_COLOR[item.status]} />
                      <Chip size="small" label={item.priority} color={PRIORITY_COLOR[item.priority]} variant="outlined" />
                    </Stack>
                  </Box>

                  <Chip size="small" label={isEn ? item.typeLabel_en : item.typeLabel} sx={{ mb: 1 }} />
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    {t('建议行动', 'Suggested action')}: {pick(item, 'action')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    {t('AI 依据', 'AI rationale')}: {pick(item, 'rationale')}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1.5 }}>
                    <Chip size="small" icon={<Psychology />} label={item.aiModel} variant="outlined" />
                    <Chip size="small" label={`${t('置信度', 'Confidence')} ${item.confidence}%`} />
                    {item.horizon && <Chip size="small" label={item.horizon} variant="outlined" />}
                    {item.patientId && <Chip size="small" label={item.patientId} variant="outlined" />}
                  </Stack>

                  {item.status === 'pending' && canReview && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                        onClick={() => { setReviewTarget(item); setNote(''); }}
                      >
                        {t('批准', 'Approve')}
                      </Button>
                      <Button
                        size="small" variant="outlined" color="error" startIcon={<Cancel />}
                        onClick={() => { setReviewTarget({ ...item, _reject: true }); setNote(''); }}
                      >
                        {t('驳回', 'Reject')}
                      </Button>
                    </Stack>
                  )}

                  {item.status !== 'pending' && (
                    <Alert severity={item.status === 'approved' ? 'success' : 'info'} sx={{ py: 0.5 }}>
                      <Typography variant="caption">
                        {item.reviewedBy} · {item.reviewedAt?.slice(0, 10)}
                        {item.clinicianNote ? ` — ${item.clinicianNote}` : ''}
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {summary?.approved > 0 && (
        <Paper sx={{ p: 2, mt: 3, bgcolor: 'success.50' }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            <Gavel sx={{ mr: 0.5, verticalAlign: 'middle', fontSize: 18 }} />
            {t('已批准干预 → 进入临床执行', 'Approved interventions → clinical execution')}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="contained" startIcon={<Assignment />} onClick={() => navigate('/doctor-report')}>
              {t('查看医生报告', 'View doctor report')}
            </Button>
            <Button variant="outlined" startIcon={<LocalHospital />} onClick={() => navigate('/appointments')}>
              {t('预约体检', 'Book exam')}
            </Button>
          </Stack>
        </Paper>
      )}

      <Dialog open={Boolean(reviewTarget)} onClose={() => setReviewTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewTarget?._reject ? t('驳回 AI 干预建议', 'Reject AI intervention') : t('批准 AI 干预建议', 'Approve AI intervention')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>{reviewTarget?.title}</Typography>
          <TextField
            fullWidth multiline rows={2} sx={{ mt: 1 }}
            label={t('医师/管理者备注（可选）', 'Clinician/admin note (optional)')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('例：同意加查动态血压；或：暂观察两周', 'e.g. Agree to ambulatory BP monitoring; or observe 2 weeks')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewTarget(null)}>{t('取消', 'Cancel')}</Button>
          <Button
            variant="contained"
            color={reviewTarget?._reject ? 'error' : 'success'}
            onClick={() => submitReview(!reviewTarget?._reject)}
            disabled={acting}
          >
            {reviewTarget?._reject ? t('确认驳回', 'Confirm reject') : t('确认批准', 'Confirm approve')}
          </Button>
        </DialogActions>
      </Dialog>

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.secondary">
        {t('AI 模型', 'AI models')}: {(summary?.models || []).join(' · ')}
      </Typography>
    </Box>
  );
}

export default AIIntervention;

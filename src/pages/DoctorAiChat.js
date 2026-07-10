import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, IconButton, Chip, Alert, LinearProgress,
  Stack, Divider, List, ListItem, ListItemText, Button,
} from '@mui/material';
import {
  Send, SmartToy, Person, Refresh, Settings, DeleteOutline,
  MonitorHeart, BugReport, Psychology, Science,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import AiGovernanceBanner from '../components/AiGovernanceBanner';
import { chatApi } from '../services/api';
import { useLang } from '../contexts/LanguageContext';
import useModeRefresh from '../hooks/useModeRefresh';

const SUGGESTIONS_ZH = [
  '当前患者有哪些需要优先关注的筛查风险？',
  '异常信号是否提示需要加查或转诊？',
  '如何解读干预队列中的待审建议？',
  '筛查组与对照组的早诊率差异说明什么？',
];
const SUGGESTIONS_EN = [
  'Which screening risks need priority attention?',
  'Do anomaly signals warrant additional workup or referral?',
  'How should I interpret pending AI intervention suggestions?',
  'What does the early-diagnosis delta between arms imply?',
];

function MessageBubble({ msg, isEn }) {
  const isUser = msg.role === 'user';
  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 1.5 }}>
      <Paper
        elevation={0}
        sx={{
          maxWidth: '82%',
          px: 2, py: 1.5,
          bgcolor: isUser ? 'primary.main' : 'grey.50',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          border: isUser ? 'none' : '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5, opacity: 0.85 }}>
          {isUser ? <Person sx={{ fontSize: 16 }} /> : <SmartToy sx={{ fontSize: 16 }} />}
          <Typography variant="caption" fontWeight={700}>
            {isUser ? (isEn ? 'You' : '医师') : (isEn ? 'MedWear AI' : 'MedWear AI')}
          </Typography>
          {msg.model && !isUser && (
            <Chip label={msg.model} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
          )}
        </Stack>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
          {msg.content}
        </Typography>
      </Paper>
    </Box>
  );
}

function DoctorAiChat() {
  const { t, isEn } = useLang();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const bottomRef = useRef(null);

  const loadMeta = useCallback(async () => {
    setBooting(true);
    try {
      const [s, c] = await Promise.all([chatApi.getStatus(), chatApi.getContext()]);
      setStatus(s.data);
      setContext(c.data);
    } finally {
      setBooting(false);
    }
  }, []);

  useModeRefresh(loadMeta);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await chatApi.send({ message: msg, history: history.slice(0, -1) });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        model: res.data.model,
      }]);
    } catch (err) {
      const data = err.response?.data;
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data?.message || data?.reply || t(
          'AI 调用失败。请确认已在系统设置中配置 API Key。',
          'AI request failed. Please configure API key in Settings.',
        ),
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  if (booting) return <LinearProgress />;

  const suggestions = isEn ? SUGGESTIONS_EN : SUGGESTIONS_ZH;

  return (
    <Box>
      <PageHeader
        title={t('AI 临床助手', 'Clinical AI Assistant')}
        subtitle={t(
          '真实 LLM 接入 · 融合筛查/异常/预测/干预上下文 · 医师随时提问',
          'Live LLM · screening/anomaly/prediction/intervention context · ask anytime',
        )}
        badge={
          <Chip
            size="small"
            color={status?.configured ? 'success' : 'warning'}
            icon={<SmartToy />}
            label={status?.configured ? `${status.providerLabel} / ${status.model}` : t('未配置', 'Not configured')}
          />
        }
        actions={
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<Refresh />} onClick={loadMeta}>{t('刷新上下文', 'Refresh context')}</Button>
            <Button size="small" startIcon={<Settings />} onClick={() => navigate('/settings')}>{t('AI 设置', 'AI settings')}</Button>
          </Stack>
        }
      />

      <AiGovernanceBanner compact />

      {!status?.configured && (
        <Alert severity="warning" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => navigate('/settings')}>{t('去配置', 'Configure')}</Button>
        }>
          {t('系统仅使用真实大模型，不提供模拟回复。请先在设置中选择 OpenAI / DeepSeek / Gemini / Grok / Claude 并填写 API Key。',
            'This system uses live LLMs only — no simulated replies. Configure a provider and API key in Settings first.')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' }, minHeight: 520 }}>
        <Paper sx={{ width: { md: 280 }, flexShrink: 0, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            {t('临床上下文', 'Clinical context')}
          </Typography>
          {context && (
            <List dense disablePadding>
              <ListItem disableGutters>
                <MonitorHeart fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <ListItemText
                  primary={t('数据模式', 'Mode')}
                  secondary={context.mode === 'real' ? t('真实', 'Real') : t('演示', 'Demo')}
                />
              </ListItem>
              <ListItem disableGutters>
                <Science fontSize="small" sx={{ mr: 1, color: 'warning.main' }} />
                <ListItemText
                  primary={t('筛查风险', 'Screening')}
                  secondary={context.screening ? `${context.screening.overallScore}/100` : '—'}
                />
              </ListItem>
              <ListItem disableGutters>
                <BugReport fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
                <ListItemText primary={t('异常信号', 'Anomalies')} secondary={context.anomalies?.length || 0} />
              </ListItem>
              <ListItem disableGutters>
                <Psychology fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} />
                <ListItemText
                  primary={t('待审干预', 'Pending IV')}
                  secondary={context.interventions?.pending ?? 0}
                />
              </ListItem>
            </List>
          )}
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {t('快捷提问', 'Quick prompts')}
          </Typography>
          <Stack spacing={0.75}>
            {suggestions.map((s) => (
              <Chip
                key={s}
                label={s}
                size="small"
                variant="outlined"
                onClick={() => send(s)}
                sx={{ height: 'auto', py: 0.75, '& .MuiChip-label': { whiteSpace: 'normal', textAlign: 'left' } }}
              />
            ))}
          </Stack>
        </Paper>

        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.default' }}>
            {messages.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <SmartToy sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
                <Typography variant="body2">
                  {t('向 AI 提问临床解读、干预决策或研究指标…', 'Ask about clinical interpretation, interventions, or research metrics…')}
                </Typography>
              </Box>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={`${m.role}-${i}`} msg={m} isEn={isEn} />
            ))}
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                <LinearProgress sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">{t('思考中…', 'Thinking…')}</Typography>
              </Box>
            )}
            <div ref={bottomRef} />
          </Box>

          <Divider />
          <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              size="small"
              placeholder={t('输入临床问题…', 'Enter a clinical question…')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={loading}
            />
            <IconButton color="primary" onClick={() => send()} disabled={loading || !input.trim()}>
              <Send />
            </IconButton>
            <IconButton onClick={clearChat} title={t('清空对话', 'Clear chat')}>
              <DeleteOutline />
            </IconButton>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default DoctorAiChat;

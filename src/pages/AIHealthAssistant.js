import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, IconButton, Avatar, Chip, Grid,
  List, ListItemButton, ListItemText, Divider, Alert,
} from '@mui/material';
import { Send, SmartToy, Person, Psychology } from '@mui/icons-material';
import { aiApi } from '../services/api';
import { useDataMode } from '../contexts/DataModeContext';
import { useHealthData } from '../contexts/HealthDataContext';
import useModeRefresh from '../hooks/useModeRefresh';

const quickQuestions = [
  '分析肿瘤和慢病的筛查研究依据',
  '高血压的风险评估和文献支持',
  '评估昨晚的睡眠质量',
  '心血管指标综合分析',
  '解释最近的异常检测结果',
];

function AIHealthAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '您好！我是 MedWear AI v3 健康助手。我融合 CardioNet、OncoScreen、GlucoPredict 等 5 个专业模型，每项分析均引用 WHO/AHA/NCCN 等真实研究指南。请问需要什么帮助？', confidence: 1 },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const { isReal } = useDataMode();
  const { hasData } = useHealthData();

  const resetWelcome = () => {
    setMessages([{
      role: 'assistant',
      content: isReal
        ? '您好！真实模式已启用。我将基于您的 Apple Health 真实数据（需先导入）通过大语言模型提供个性化建议。请在设置中配置 OpenAI API Key。'
        : '您好！演示模式：使用临床标准模拟数据。切换至「真实模式」可接入 Apple Health 与真实 AI。',
      confidence: 1,
    }]);
  };

  useModeRefresh(resetWelcome);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim()) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await aiApi.chat({ message: msg });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        confidence: res.data.confidence,
        sources: res.data.sources,
        model: res.data.model,
        citations: res.data.citations,
        notice: res.data.notice,
        isSimulated: res.data.isSimulated,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，AI 分析服务暂时不可用，请稍后重试。' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>AI 健康助手</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        MedWear-AI v3 多模型融合 · 证据驱动 · 每项结论附研究参考
      </Typography>

      <Grid container spacing={3}>
        {isReal && !hasData && (
          <Grid item xs={12}>
            <Alert severity="warning">
              真实模式：请先导入 Apple Health 数据。AI 将基于您的真实记录作答，不会使用演示规则引擎。
            </Alert>
          </Grid>
        )}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">快捷提问</Typography>
            <List dense>
              {quickQuestions.map(q => (
                <ListItemButton key={q} onClick={() => sendMessage(q)} sx={{ borderRadius: 2, mb: 0.5 }}>
                  <ListItemText primary={q} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom color="text.secondary">AI 模型</Typography>
            <Chip icon={<Psychology />} label={isReal ? '真实 AI' : '演示 AI'} size="small" color={isReal ? 'success' : 'primary'} sx={{ mb: 1 }} />
            <Typography variant="caption" display="block" color="text.secondary">
              融合 CardioNet · VitalGuard · SleepAI 等专业模型
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={9}>
          <Paper sx={{ height: 520, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
              {messages.map((msg, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  <Avatar sx={{ bgcolor: msg.role === 'user' ? 'primary.main' : 'secondary.main', width: 36, height: 36 }}>
                    {msg.role === 'user' ? <Person /> : <SmartToy />}
                  </Avatar>
                  <Box sx={{ maxWidth: '75%' }}>
                    <Paper sx={{
                      p: 2,
                      bgcolor: msg.role === 'user' ? 'primary.main' : 'grey.50',
                      color: msg.role === 'user' ? '#fff' : 'text.primary',
                    }}>
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Typography>
                    </Paper>
                    {msg.confidence && msg.role === 'assistant' && (
                      <Box sx={{ mt: 0.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label={`置信度 ${(msg.confidence * 100).toFixed(1)}%`} size="small" variant="outlined" />
                        {msg.model && <Chip label={msg.model} size="small" color="primary" variant="outlined" />}
                        {msg.sources?.map(s => <Chip key={s} label={s} size="small" variant="outlined" color="info" />)}
                      </Box>
                    )}
                    {msg.citations?.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        📚 {msg.citations[0]?.citation || msg.citations[0]?.title}
                      </Typography>
                    )}
                    {msg.notice && (
                      <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                        ⚠ {msg.notice}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
              {loading && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}><SmartToy /></Avatar>
                  <Typography variant="body2" color="text.secondary">AI 正在分析健康数据...</Typography>
                </Box>
              )}
              <div ref={chatEndRef} />
            </Box>
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
              <TextField fullWidth placeholder="输入健康问题或数据分析请求..." size="small"
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                disabled={loading || (isReal && !hasData)} />
              <IconButton color="primary" onClick={() => sendMessage()}
                disabled={loading || !input.trim() || (isReal && !hasData)}>
                <Send />
              </IconButton>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default AIHealthAssistant;

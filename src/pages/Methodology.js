import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, Alert, LinearProgress, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Button,
} from '@mui/material';
import { MenuBook, Refresh } from '@mui/icons-material';
import { methodologyApi } from '../services/api';
import { useLang } from '../contexts/LanguageContext';

/** Split a line into React nodes, handling `code` and **bold**. */
function renderInline(text) {
  const nodes = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      nodes.push(
        <Box key={i} component="code" sx={{ bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5, fontFamily: 'monospace', fontSize: '0.85em' }}>
          {tok.slice(1, -1)}
        </Box>,
      );
    } else {
      nodes.push(<strong key={i}>{tok.slice(2, -2)}</strong>);
    }
    last = regex.lastIndex;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Parse a subset of Markdown into structured blocks. */
function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push({ type: 'code', code: code.join('\n') });
      continue;
    }

    // Table (line with pipes followed by a separator row)
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const toCells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const headers = toCells(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(toCells(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2] });
      i += 1;
      continue;
    }

    // Blockquote (consecutive)
    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quote.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Unordered list (consecutive)
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Paragraph (consecutive non-empty, non-special lines)
    const para = [];
    while (
      i < lines.length
      && lines[i].trim() !== ''
      && !lines[i].trim().startsWith('```')
      && !/^(#{1,6})\s+/.test(lines[i])
      && !/^\s*[-*]\s+/.test(lines[i])
      && !lines[i].startsWith('>')
      && !/^\s*\|.*\|\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

const HEADING_VARIANT = { 1: 'h5', 2: 'h6', 3: 'subtitle1', 4: 'subtitle2', 5: 'subtitle2', 6: 'subtitle2' };

function MarkdownBlock({ block }) {
  switch (block.type) {
    case 'heading':
      return (
        <Typography
          variant={HEADING_VARIANT[block.level]}
          fontWeight={700}
          sx={{ mt: block.level <= 2 ? 3 : 2, mb: 1, color: block.level <= 2 ? 'primary.main' : 'text.primary' }}
        >
          {renderInline(block.text)}
        </Typography>
      );
    case 'p':
      return <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.7 }}>{renderInline(block.text)}</Typography>;
    case 'ul':
      return (
        <Box component="ul" sx={{ pl: 3, mb: 1.5 }}>
          {block.items.map((it, k) => (
            <li key={k}><Typography variant="body2" sx={{ lineHeight: 1.7 }}>{renderInline(it)}</Typography></li>
          ))}
        </Box>
      );
    case 'quote':
      return (
        <Box sx={{ borderLeft: 3, borderColor: 'primary.main', pl: 2, py: 0.5, my: 2, bgcolor: 'primary.50' }}>
          {block.text.split('\n').map((l, k) => (
            <Typography key={k} variant="body2" sx={{ fontStyle: 'italic' }}>{renderInline(l)}</Typography>
          ))}
        </Box>
      );
    case 'code':
      return (
        <Box component="pre" sx={{ bgcolor: 'grey.900', color: 'grey.100', p: 2, borderRadius: 1, overflow: 'auto', fontSize: '0.8rem', mb: 2 }}>
          <code>{block.code}</code>
        </Box>
      );
    case 'table':
      return (
        <Table size="small" sx={{ mb: 2, border: 1, borderColor: 'divider' }}>
          <TableHead>
            <TableRow>
              {block.headers.map((hcell, k) => (
                <TableCell key={k} sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>{renderInline(hcell)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {block.rows.map((row, r) => (
              <TableRow key={r}>
                {row.map((cell, c) => <TableCell key={c}>{renderInline(cell)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    case 'hr':
      return <Divider sx={{ my: 2 }} />;
    default:
      return null;
  }
}

function Methodology() {
  const { t } = useLang();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    methodologyApi.get()
      .then((res) => setDoc(res.data))
      .catch((e) => setError(e.response?.data?.message || t('方法学文档加载失败，请确认后端 API 已启动', 'Failed to load methodology doc — please ensure the backend API is running')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const blocks = doc?.markdown ? parseMarkdown(doc.markdown) : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            <MenuBook sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('方法学文档', 'Methodology')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {doc?.filename || 'docs/METHODS.md'} · {t('引擎', 'Engine')} {doc?.engine || '—'}
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={load}>{t('刷新', 'Refresh')}</Button>
      </Box>

      {doc?.framework && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
          <Chip size="small" color="primary" label={`${t('开放基准', 'Open benchmark')} ${doc.framework.benchmark_license}`} />
          <Chip size="small" variant="outlined" label={`${t('评估方式', 'Evaluation')}: ${doc.framework.evaluation_type}`} />
          {(doc.framework.layers || []).map((l) => (
            <Chip key={l.id} size="small" variant="outlined" label={`${l.id} ${l.title}`} />
          ))}
        </Box>
      )}

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={load}>重试</Button>}>{error}</Alert>
      )}

      {doc && !loading && (
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          {blocks.map((block, idx) => <MarkdownBlock key={idx} block={block} />)}
        </Paper>
      )}
    </Box>
  );
}

export default Methodology;

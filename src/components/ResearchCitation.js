import React from 'react';
import {
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, Box, Link, Divider,
} from '@mui/material';
import { MenuBook, OpenInNew } from '@mui/icons-material';

const typeLabel = {
  guideline: '临床指南', rct: 'RCT', 'meta-analysis': 'Meta分析',
  'systematic-review': '系统综述', cohort: '队列研究', validation: '验证研究',
};

export function EvidenceBadge({ level, label }) {
  const color = { A: 'success', B: 'info', C: 'warning' }[level] || 'default';
  return <Chip label={label || `${level}级证据`} size="small" color={color} icon={<MenuBook />} />;
}

export function ReferenceList({ references, compact }) {
  if (!references?.length) return null;
  if (compact) {
    return (
      <Typography variant="caption" color="text.secondary">
        参考文献 {references.length} 篇
      </Typography>
    );
  }
  return (
    <Box>
      {references.map((ref, i) => (
        <Box key={i} sx={{ mb: 1.5 }}>
          <Typography variant="body2" fontWeight={600}>
            [{ref.org}, {ref.year}] {ref.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Chip label={typeLabel[ref.type] || ref.type} size="small" variant="outlined" />
            {ref.doi && <Typography variant="caption" color="text.secondary">DOI: {ref.doi}</Typography>}
            {ref.url && (
              <Link href={ref.url} target="_blank" rel="noopener" variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                原文 <OpenInNew sx={{ fontSize: 12 }} />
              </Link>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function ReferenceDialog({ item, open, onClose }) {
  if (!item) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {item.name} — 研究依据
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {item.evidenceLevel && <EvidenceBadge level={item.evidenceLevel} label={item.evidenceLabel} />}
          {item.aiModel && <Chip label={`模型 ${item.aiModel}`} size="small" color="primary" variant="outlined" />}
          {item.confidence && <Chip label={`置信度 ${(item.confidence * 100).toFixed(1)}%`} size="small" />}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {item.measuredMetrics && (
          <>
            <Typography variant="subtitle2" gutterBottom>测量指标</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {item.measuredMetrics.map(m => <Chip key={m} label={m} size="small" />)}
            </Box>
          </>
        )}
        {item.clinicalThresholds && (
          <>
            <Typography variant="subtitle2" gutterBottom>临床阈值</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {JSON.stringify(item.clinicalThresholds, null, 0).replace(/[{}"]/g, '').replace(/,/g, ' · ')}
            </Typography>
          </>
        )}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>参考文献与指南</Typography>
        <ReferenceList references={item.references} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReferenceList;

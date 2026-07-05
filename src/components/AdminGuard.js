import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { AdminPanelSettings } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AdminGuard({ children }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <AdminPanelSettings sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" gutterBottom>需要管理员权限</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          请使用 admin 账号登录以访问此功能
        </Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>返回健康总览</Button>
      </Box>
    );
  }

  return children;
}

export default AdminGuard;

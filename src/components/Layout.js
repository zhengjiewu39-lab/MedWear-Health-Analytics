import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItemIcon,
  ListItemText, Toolbar, Typography, Avatar, Menu, MenuItem, Divider,
  Collapse, ListItemButton, Chip,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard, MonitorHeart, Psychology, BugReport,
  TrendingUp, Bedtime, PersonPin, MergeType, Assessment,
  Logout, KeyboardArrowDown, KeyboardArrowUp, SmartToy, MonitorHeartOutlined,
  NotificationsActive, EmojiEvents, SelfImprovement, AutoAwesome, Settings,
  Biotech, LocalHospital, Assignment, Hub, Science,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useDataMode } from '../contexts/DataModeContext';
import { useHealthData } from '../contexts/HealthDataContext';
import { CloudUpload } from '@mui/icons-material';

const drawerWidth = 260;

const menuItems = [
  { text: '健康总览', icon: <Dashboard />, path: '/dashboard' },
  { text: '实时监测', icon: <MonitorHeart />, path: '/monitoring' },
  { text: 'ECG 心电', icon: <MonitorHeartOutlined />, path: '/ecg' },
  { text: '预警中心', icon: <NotificationsActive />, path: '/alerts' },
  {
    text: '临床筛查',
    icon: <Biotech />,
    badge: 'NEW',
    children: [
      { text: '临床筛查中心', path: '/screening', icon: <Biotech /> },
      { text: '预约体检', path: '/appointments', icon: <LocalHospital /> },
      { text: '医生接诊报告', path: '/doctor-report', icon: <Assignment /> },
    ],
  },
  { text: '分析评价中心', icon: <Science />, path: '/research' },
  { text: '互联平台', icon: <Hub />, path: '/platform' },
  {
    text: 'AI 智能分析',
    icon: <Psychology />,
    badge: 'AI',
    children: [
      { text: 'AI 健康助手', path: '/ai/assistant', icon: <SmartToy /> },
      { text: 'AI 健康报告', path: '/ai/report', icon: <AutoAwesome /> },
      { text: '异常检测', path: '/ai/anomaly', icon: <BugReport /> },
      { text: '预测分析', path: '/ai/predictive', icon: <TrendingUp /> },
      { text: '睡眠分析', path: '/ai/sleep', icon: <Bedtime /> },
      { text: '恢复与压力', path: '/ai/recovery', icon: <SelfImprovement /> },
      { text: '数字孪生', path: '/ai/digital-twin', icon: <PersonPin /> },
      { text: '数据融合', path: '/ai/fusion', icon: <MergeType /> },
      { text: '健康目标', path: '/ai/goals', icon: <EmojiEvents /> },
    ],
  },
  { text: '我的设备', icon: <Assessment />, path: '/devices' },
  { text: '设置', icon: <Settings />, path: '/settings' },
];

const allLabels = [
  { path: '/import', text: '数据导入' },
  ...menuItems.flatMap(i => i.children ? i.children.map(c => ({ path: c.path, text: c.text })) : [{ path: i.path, text: i.text }]),
];

export function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openSubMenus, setOpenSubMenus] = useState({ '临床筛查': true, 'AI 智能分析': true });
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { toggleMode, isDemo, isReal } = useDataMode();
  const { hasData } = useHealthData();

  const isActive = (path) => location.pathname === path;
  const getTitle = () => allLabels.find(m => m.path === location.pathname)?.text || 'MedWear AI';

  const drawer = (
    <div>
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>MedWear AI</Typography>
        <Typography variant="caption" color="text.secondary">智能健康分析平台</Typography>
        <Chip label="演示模式" size="small" color="secondary" sx={{ mt: 0.5, height: 20, fontSize: '0.65rem', display: isDemo ? 'inline-flex' : 'none' }} />
        <Chip label="真实模式" size="small" color="success" sx={{ mt: 0.5, height: 20, fontSize: '0.65rem', display: isReal ? 'inline-flex' : 'none' }} />
      </Toolbar>
      <Divider />
      {isReal && (
        <>
          <List sx={{ px: 1, pt: 1 }}>
            <ListItemButton
              selected={isActive('/import')}
              onClick={() => navigate('/import')}
              sx={{
                borderRadius: 2, mx: 0.5, mb: 0.5,
                bgcolor: hasData ? 'success.50' : 'warning.50',
                border: '1px solid',
                borderColor: hasData ? 'success.light' : 'warning.light',
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: hasData ? 'success.main' : 'warning.main' }}>
                <CloudUpload />
              </ListItemIcon>
              <ListItemText
                primary="数据导入"
                secondary={hasData ? 'Apple Health 已导入' : '导入 Apple Health →'}
                primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem' }}
                secondaryTypographyProps={{ fontSize: '0.7rem' }}
              />
            </ListItemButton>
          </List>
          <Divider sx={{ mb: 1 }} />
        </>
      )}
      <List sx={{ px: 1 }}>
        {menuItems.map(item => {
          if (item.children) {
            return (
              <React.Fragment key={item.text}>
                <ListItemButton onClick={() => setOpenSubMenus(p => ({ ...p, [item.text]: !p[item.text] }))}>
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                  <Chip label={item.badge} size="small" color="primary" sx={{ mr: 1, height: 18, fontSize: '0.6rem' }} />
                  {openSubMenus[item.text] ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                </ListItemButton>
                <Collapse in={openSubMenus[item.text]} unmountOnExit>
                  <List disablePadding>
                    {item.children.map(c => (
                      <ListItemButton key={c.path} selected={isActive(c.path)} onClick={() => navigate(c.path)} sx={{ pl: 4, borderRadius: 2, mx: 0.5, mb: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>{c.icon}</ListItemIcon>
                        <ListItemText primary={c.text} primaryTypographyProps={{ fontSize: '0.875rem' }} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          }
          if (item.realOnly && !isReal) return null;
          if (item.demoOnly && !isDemo) return null;
          return (
            <ListItemButton key={item.text} selected={isActive(item.path)} onClick={() => navigate(item.path)} sx={{ borderRadius: 2, mx: 0.5, mb: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          );
        })}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>{getTitle()}</Typography>
          <Chip
            label={isDemo ? '演示模式' : '真实模式'}
            size="small"
            color={isDemo ? 'secondary' : 'success'}
            onClick={toggleMode}
            sx={{ mr: 2, cursor: 'pointer', fontWeight: 600 }}
            title="点击切换演示/真实模式"
          />
          <Chip label={isReal ? '真实 AI' : '模拟 AI'} size="small" sx={{ mr: 2, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} className="live-indicator" />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main' }}>{user?.name?.[0] || 'U'}</Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled><Typography variant="body2">{user?.name || '演示用户'}</Typography></MenuItem>
            <Divider />
            <MenuItem onClick={() => { logout(); navigate('/login'); }}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon><ListItemText>退出</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}>{drawer}</Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth } }} open>{drawer}</Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: '64px' }}>{children}</Box>
    </Box>
  );
}

export default Layout;

import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItemIcon,
  ListItemText, Toolbar, Typography, Avatar, Menu, MenuItem, Divider,
  Collapse, ListItemButton, Chip, Badge, Tooltip, alpha,
} from '@mui/material';
import {
  Menu as MenuIcon, Logout, KeyboardArrowDown, KeyboardArrowUp,
  CloudUpload, AdminPanelSettings, Dashboard, People, MonitorHeart,
  MonitorHeartOutlined, NotificationsActive, Biotech, LocalHospital,
  Assignment, Business, Gavel, Assessment, Hub, Science, Settings,
  Psychology, SmartToy, AutoAwesome, BugReport, TrendingUp, Bedtime,
  SelfImprovement, PersonPin, MergeType, EmojiEvents, Devices, Coronavirus,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useDataMode } from '../contexts/DataModeContext';
import { useHealthData } from '../contexts/HealthDataContext';
import { NAV_SECTIONS, getPageTitle } from '../config/navigation';

const drawerWidth = 272;

const ICONS = {
  '管理控制台': AdminPanelSettings,
  '健康总览': Dashboard,
  '患者管理': People,
  '实时监测': MonitorHeart,
  'ECG 心电': MonitorHeartOutlined,
  '预警中心': NotificationsActive,
  '临床筛查': Biotech,
  '预约体检': LocalHospital,
  '医生报告': Assignment,
  '组织架构': Business,
  '合规管理': Gavel,
  '报告中心': Assessment,
  '互联平台': Hub,
  '分析评价': Science,
  '系统设置': Settings,
  'AI 健康助手': SmartToy,
  'AI 健康报告': AutoAwesome,
  '异常检测': BugReport,
  '预测分析': TrendingUp,
  '睡眠分析': Bedtime,
  '恢复与压力': SelfImprovement,
  '数字孪生': PersonPin,
  '数据融合': MergeType,
  '健康目标': EmojiEvents,
  '我的设备': Devices,
  '监测仪表盘': Coronavirus,
  '公共卫生监测': Coronavirus,
};

function NavIcon({ name }) {
  const Icon = ICONS[name] || Dashboard;
  return <Icon fontSize="small" />;
}

export function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(
      NAV_SECTIONS.filter((s) => s.collapsible).map((s) => [s.id, s.defaultOpen ?? false])
    )
  );
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { toggleMode, isDemo, isReal } = useDataMode();
  const { hasData } = useHealthData();

  const sections = useMemo(
    () => NAV_SECTIONS.filter((section) => !section.adminOnly || isAdmin),
    [isAdmin]
  );

  const isActive = (path) => location.pathname === path;
  const title = getPageTitle(location.pathname, isAdmin);

  const renderNavItem = (item) => {
    if (item.adminOnly && !isAdmin) return null;
    return (
      <ListItemButton
        key={item.path}
        selected={isActive(item.path)}
        onClick={() => { navigate(item.path); setMobileOpen(false); }}
        sx={{
          py: 1,
          px: 1.5,
          color: '#cbd5e1',
          '&.Mui-selected': {
            bgcolor: alpha('#818cf8', 0.2),
            color: '#fff',
            '& .MuiListItemIcon-root': { color: '#a5b4fc' },
            '&:hover': { bgcolor: alpha('#818cf8', 0.28) },
          },
          '&:hover': { bgcolor: alpha('#fff', 0.06) },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: isActive(item.path) ? '#a5b4fc' : '#64748b' }}>
          <NavIcon name={item.text} />
        </ListItemIcon>
        <ListItemText
          primary={item.text}
          primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isActive(item.path) ? 700 : 500 }}
        />
      </ListItemButton>
    );
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f172a', color: '#e2e8f0' }}>
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
          MedWear
        </Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          医用可穿戴数据分析
        </Typography>
        <Box sx={{ mt: 1.25, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            label={isDemo ? '演示' : '真实'}
            size="small"
            sx={{ height: 22, fontSize: '0.65rem', bgcolor: alpha('#fff', 0.08), color: '#e2e8f0' }}
          />
          {isAdmin && (
            <Chip label="管理员" size="small" color="secondary" sx={{ height: 22, fontSize: '0.65rem' }} />
          )}
        </Box>
      </Box>

      <Divider sx={{ borderColor: alpha('#fff', 0.08) }} />

      {isReal && (
        <Box sx={{ px: 1.5, pt: 1.5 }}>
          <ListItemButton
            selected={isActive('/import')}
            onClick={() => navigate('/import')}
            sx={{
              borderRadius: 2,
              bgcolor: hasData ? alpha('#059669', 0.15) : alpha('#d97706', 0.15),
              '&:hover': { bgcolor: hasData ? alpha('#059669', 0.22) : alpha('#d97706', 0.22) },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: hasData ? '#34d399' : '#fbbf24' }}>
              <CloudUpload fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="数据导入"
              secondary={hasData ? '已导入' : '导入 Apple Health'}
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700, color: '#f8fafc' }}
              secondaryTypographyProps={{ fontSize: '0.7rem', color: '#94a3b8' }}
            />
          </ListItemButton>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
        {sections.map((section) => {
          const visibleItems = section.items.filter((item) => !item.adminOnly || isAdmin);
          if (!visibleItems.length) return null;

          if (section.collapsible) {
            const open = openSections[section.id];
            return (
              <Box key={section.id} sx={{ mb: 1 }}>
                <ListItemButton
                  onClick={() => setOpenSections((p) => ({ ...p, [section.id]: !p[section.id] }))}
                  sx={{ py: 0.75, px: 1, borderRadius: 2 }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: '#64748b' }}>
                    <Psychology fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={section.label}
                    primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  />
                  {open ? <KeyboardArrowUp sx={{ color: '#64748b', fontSize: 18 }} /> : <KeyboardArrowDown sx={{ color: '#64748b', fontSize: 18 }} />}
                </ListItemButton>
                <Collapse in={open} unmountOnExit>
                  <List disablePadding sx={{ pl: 0.5 }}>
                    {visibleItems.map(renderNavItem)}
                  </List>
                </Collapse>
              </Box>
            );
          }

          return (
            <Box key={section.id} sx={{ mb: 1.5 }}>
              <Typography
                variant="caption"
                sx={{
                  px: 1.5, py: 0.75, display: 'block',
                  fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}
              >
                {section.label}
              </Typography>
              <List disablePadding>
                {visibleItems.map(renderNavItem)}
              </List>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ p: 2, borderTop: `1px solid ${alpha('#fff', 0.08)}` }}>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          {user?.name || '用户'} · {user?.role === 'admin' ? '系统管理员' : '普通用户'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 1, display: { sm: 'none' }, color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, fontSize: '1.05rem' }}>
            {title}
          </Typography>

          <Tooltip title="切换演示 / 真实数据模式">
            <Chip
              label={isDemo ? '演示模式' : '真实模式'}
              size="small"
              variant="outlined"
              onClick={toggleMode}
              sx={{ cursor: 'pointer', fontWeight: 600 }}
              color={isDemo ? 'default' : 'success'}
            />
          </Tooltip>

          {isAdmin && (
            <Tooltip title="管理控制台">
              <IconButton onClick={() => navigate('/admin')} sx={{ color: 'primary.main' }}>
                <AdminPanelSettings />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="预警中心">
            <IconButton onClick={() => navigate('/alerts')} sx={{ color: 'text.secondary' }}>
              <Badge badgeContent={isAdmin ? 3 : 0} color="error">
                <NotificationsActive />
              </Badge>
            </IconButton>
          </Tooltip>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: isAdmin ? 'primary.main' : 'secondary.main', fontSize: 14 }}>
              {user?.name?.[0] || 'U'}
            </Avatar>
          </IconButton>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { minWidth: 220, mt: 1 } }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.role === 'admin' ? '系统管理员' : '演示用户'}
              </Typography>
            </Box>
            <Divider />
            {isAdmin && (
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/admin'); }}>
                <ListItemIcon><AdminPanelSettings fontSize="small" /></ListItemIcon>
                <ListItemText>管理控制台</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings'); }}>
              <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
              <ListItemText>系统设置</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { logout(); navigate('/login'); }}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              <ListItemText>退出登录</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth, border: 'none', boxSizing: 'border-box' },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default Layout;

import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItemIcon,
  ListItemText, Toolbar, Typography, Avatar, Menu, MenuItem, Divider,
  Collapse, ListItemButton, Chip, Tooltip, alpha,
} from '@mui/material';
import {
  Menu as MenuIcon, Logout, KeyboardArrowDown, KeyboardArrowUp,
  CloudUpload, CompareArrows, Biotech, LocalHospital,
  Assignment, Science, Settings,
  BugReport, TrendingUp, Groups, MenuBook, Translate, Psychology, SmartToy,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { enLabel } from '../i18n/labels';
import { useDataMode } from '../contexts/DataModeContext';
import { useDemoPatient } from '../contexts/DemoPatientContext';
import { useHealthData } from '../contexts/HealthDataContext';
import { NAV_SECTIONS, getPageTitle } from '../config/navigation';
import DemoPatientSelector from './DemoPatientSelector';
import ContentContainer from './ContentContainer';

const drawerWidth = 272;

const ICONS = {
  '临床筛查': Biotech,
  '异常检测': BugReport,
  'AI 干预': Psychology,
  'AI 临床助手': SmartToy,
  '预测分析': TrendingUp,
  '医生报告': Assignment,
  '预约体检': LocalHospital,
  '研究评价': Science,
  '研究评价中心': Science,
  '结局对比': CompareArrows,
  '方法学文档': MenuBook,
  '患者队列': Groups,
  '患者管理': Groups,
  '系统设置': Settings,
  '数据导入': CloudUpload,
};

function NavIcon({ name }) {
  const Icon = ICONS[name] || Biotech;
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
  const { current: demoPatient } = useDemoPatient();
  const { hasData } = useHealthData();
  const { t, lang, toggle: toggleLang } = useLang();

  const tl = (zh) => t(zh, enLabel(zh));

  const sections = useMemo(() => {
    return NAV_SECTIONS.filter((section) => !section.adminOnly || isAdmin);
  }, [isAdmin]);

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
          primary={tl(item.text)}
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
          {t('早筛与干预 · 可穿戴数据分析', 'Early Screening · Wearable Analytics')}
        </Typography>
        <Box sx={{ mt: 1.25, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            label={isDemo ? t('演示', 'Demo') : t('真实', 'Real')}
            size="small"
            sx={{ height: 22, fontSize: '0.65rem', bgcolor: alpha('#fff', 0.08), color: '#e2e8f0' }}
          />
          {isAdmin && (
            <Chip label={t('管理员', 'Admin')} size="small" color="secondary" sx={{ height: 22, fontSize: '0.65rem' }} />
          )}
          {isDemo && demoPatient && (
            <Chip
              label={`${t('演示者', 'Demo')}: ${demoPatient.name} (${demoPatient.id})`}
              size="small"
              sx={{ height: 22, fontSize: '0.65rem', bgcolor: alpha('#fff', 0.08), color: '#e2e8f0' }}
            />
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
              primary={t('数据导入', 'Data Import')}
              secondary={hasData ? t('已导入', 'Imported') : t('导入 Apple Health', 'Import Apple Health')}
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
                    primary={tl(section.label)}
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
                {tl(section.label)}
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
          {user?.name || t('用户', 'User')} · {user?.role === 'admin' ? t('系统管理员', 'Administrator') : t('普通用户', 'User')}
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
            {tl(title)}
          </Typography>

          <Tooltip title={t('切换语言 / Switch language', 'Switch language / 切换语言')}>
            <Chip
              label={lang === 'en' ? 'EN' : '中'}
              size="small"
              onClick={toggleLang}
              icon={<Translate sx={{ fontSize: 16 }} />}
              sx={{ cursor: 'pointer', fontWeight: 700, mr: 0.5 }}
              color="primary"
              variant="outlined"
            />
          </Tooltip>

          {isDemo && <DemoPatientSelector />}

          <Tooltip title={isDemo ? t('演示模式', 'Demo mode') : t('真实模式', 'Real mode')}>
            <Chip
              label={isDemo ? t('演示模式', 'Demo mode') : t('真实模式', 'Real mode')}
              size="small"
              variant="outlined"
              onClick={toggleMode}
              sx={{ cursor: 'pointer', fontWeight: 600 }}
              color={isDemo ? 'default' : 'success'}
            />
          </Tooltip>

          {isAdmin && (
            <Tooltip title={t('AI 临床助手', 'Clinical AI')}>
              <IconButton onClick={() => navigate('/ai/chat')} sx={{ color: 'secondary.main' }}>
                <SmartToy />
              </IconButton>
            </Tooltip>
          )}

          {isAdmin && (
            <Tooltip title={t('结局对比', 'Outcome Comparison')}>
              <IconButton onClick={() => navigate('/outcomes')} sx={{ color: 'primary.main' }}>
                <CompareArrows />
              </IconButton>
            </Tooltip>
          )}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: isAdmin ? 'primary.main' : 'secondary.main', fontSize: 14 }}>
              {user?.name?.[0] || 'U'}
            </Avatar>
          </IconButton>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { minWidth: 220, mt: 1 } }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.role === 'admin' ? t('系统管理员', 'Administrator') : t('用户', 'User')}
              </Typography>
            </Box>
            <Divider />
            {isAdmin && (
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/ai/chat'); }}>
                <ListItemIcon><SmartToy fontSize="small" /></ListItemIcon>
                <ListItemText>{t('AI 临床助手', 'Clinical AI')}</ListItemText>
              </MenuItem>
            )}
            {isAdmin && (
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/outcomes'); }}>
                <ListItemIcon><CompareArrows fontSize="small" /></ListItemIcon>
                <ListItemText>{t('结局对比', 'Outcome Comparison')}</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings'); }}>
              <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
              <ListItemText>{t('系统设置', 'Settings')}</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { logout(); navigate('/login'); }}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              <ListItemText>{t('退出登录', 'Log out')}</ListItemText>
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
        <ContentContainer>{children}</ContentContainer>
      </Box>
    </Box>
  );
}

export default Layout;

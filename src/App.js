import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataModeProvider } from './contexts/DataModeContext';
import { HealthDataProvider } from './contexts/HealthDataContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminGuard from './components/AdminGuard';
import ModeShell from './components/ModeShell';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminOverview from './pages/AdminOverview';
import PatientManagement from './pages/PatientManagement';
import Organization from './pages/Organization';
import Compliance from './pages/Compliance';
import ReportCenter from './pages/ReportCenter';
import RealTimeMonitoring from './pages/RealTimeMonitoring';
import ECGMonitoring from './pages/ECGMonitoring';
import AlertCenter from './pages/AlertCenter';
import AIHealthAssistant from './pages/AIHealthAssistant';
import AIHealthReport from './pages/AIHealthReport';
import AnomalyDetection from './pages/AnomalyDetection';
import PredictiveAnalytics from './pages/PredictiveAnalytics';
import SleepAnalysis from './pages/SleepAnalysis';
import RecoveryStress from './pages/RecoveryStress';
import DigitalTwin from './pages/DigitalTwin';
import DataFusion from './pages/DataFusion';
import HealthGoals from './pages/HealthGoals';
import DeviceManagement from './pages/DeviceManagement';
import SettingsPage from './pages/Settings';
import DiseaseScreening from './pages/DiseaseScreening';
import ExamAppointment from './pages/ExamAppointment';
import DoctorReport from './pages/DoctorReport';
import PlatformHub from './pages/PlatformHub';
import DataImport from './pages/DataImport';
import ResearchCenter from './pages/ResearchCenter';
import PublicHealthDashboard from './pages/PublicHealthDashboard';

const AppLoading = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

function wrap(Page, title, requireData = true) {
  return (
    <ModeShell title={title} requireData={requireData}>
      <Page />
    </ModeShell>
  );
}

function adminWrap(Page, title, requireData = false) {
  return (
    <AdminGuard>
      <ModeShell title={title} requireData={requireData}>
        <Page />
      </ModeShell>
    </AdminGuard>
  );
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <AppLoading />;

  return (
    <DataModeProvider>
      <HealthDataProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={adminWrap(AdminOverview, '管理控制台', false)} />
            <Route path="/admin/patients" element={adminWrap(PatientManagement, '患者管理', false)} />
            <Route path="/admin/organization" element={adminWrap(Organization, '组织架构', false)} />
            <Route path="/admin/compliance" element={adminWrap(Compliance, '合规管理', false)} />
            <Route path="/admin/reports" element={adminWrap(ReportCenter, '报告中心', false)} />
            <Route path="/import" element={wrap(DataImport, '数据导入', false)} />
            <Route path="/dashboard" element={wrap(Dashboard, '健康总览')} />
            <Route path="/monitoring" element={wrap(RealTimeMonitoring, '实时监测')} />
            <Route path="/ecg" element={wrap(ECGMonitoring, 'ECG 心电')} />
            <Route path="/alerts" element={wrap(AlertCenter, '预警中心')} />
            <Route path="/screening" element={wrap(DiseaseScreening, '临床筛查中心')} />
            <Route path="/appointments" element={wrap(ExamAppointment, '预约体检', false)} />
            <Route path="/doctor-report" element={wrap(DoctorReport, '医生接诊报告')} />
            <Route path="/platform" element={wrap(PlatformHub, '互联平台', false)} />
            <Route path="/devices" element={wrap(DeviceManagement, '我的设备')} />
            <Route path="/ai/assistant" element={wrap(AIHealthAssistant, 'AI 健康助手', false)} />
            <Route path="/ai/report" element={wrap(AIHealthReport, 'AI 健康报告')} />
            <Route path="/ai/anomaly" element={wrap(AnomalyDetection, '异常检测')} />
            <Route path="/ai/predictive" element={wrap(PredictiveAnalytics, '预测分析')} />
            <Route path="/ai/sleep" element={wrap(SleepAnalysis, '睡眠分析')} />
            <Route path="/ai/recovery" element={wrap(RecoveryStress, '恢复与压力')} />
            <Route path="/ai/digital-twin" element={wrap(DigitalTwin, '数字孪生')} />
            <Route path="/ai/fusion" element={wrap(DataFusion, '数据融合')} />
            <Route path="/ai/goals" element={wrap(HealthGoals, '健康目标')} />
            <Route path="/research" element={wrap(ResearchCenter, '分析评价中心', false)} />
            <Route path="/public-health" element={wrap(PublicHealthDashboard, '公共卫生监测', false)} />
            <Route path="/settings" element={wrap(SettingsPage, '系统设置', false)} />
          </Route>
        </Routes>
      </HealthDataProvider>
    </DataModeProvider>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

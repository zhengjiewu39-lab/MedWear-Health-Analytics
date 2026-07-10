import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { DataModeProvider } from './contexts/DataModeContext';
import { DemoPatientProvider } from './contexts/DemoPatientContext';
import { HealthDataProvider } from './contexts/HealthDataContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminGuard from './components/AdminGuard';
import ModeShell from './components/ModeShell';
import { getHomePath } from './config/paperDemo';

import Login from './pages/Login';
import PatientManagement from './pages/PatientManagement';
import AIIntervention from './pages/AIIntervention';
import AnomalyDetection from './pages/AnomalyDetection';
import PredictiveAnalytics from './pages/PredictiveAnalytics';
import SettingsPage from './pages/Settings';
import DiseaseScreening from './pages/DiseaseScreening';
import ExamAppointment from './pages/ExamAppointment';
import DoctorReport from './pages/DoctorReport';
import DataImport from './pages/DataImport';
import ResearchCenter from './pages/ResearchCenter';
import Methodology from './pages/Methodology';
import OutcomesComparison from './pages/OutcomesComparison';
import DoctorAiChat from './pages/DoctorAiChat';

const AppLoading = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

function wrap(Page, title, requireData = true, aiExempt = false) {
  return (
    <ModeShell title={title} requireData={requireData} aiExempt={aiExempt}>
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

function HomeRedirect() {
  return <Navigate to={getHomePath()} replace />;
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <AppLoading />;

  return (
    <DataModeProvider>
      <DemoPatientProvider>
        <HealthDataProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeRedirect />} />

          {/* Legacy routes → thesis pathway */}
          <Route path="/dashboard" element={<Navigate to="/screening" replace />} />
          <Route path="/monitoring" element={<Navigate to="/ai/anomaly" replace />} />
          <Route path="/alerts" element={<Navigate to="/ai/anomaly" replace />} />
          <Route path="/devices" element={<Navigate to="/screening" replace />} />
          <Route path="/admin" element={<Navigate to="/outcomes" replace />} />
          <Route path="/admin/compliance" element={<Navigate to="/settings" replace />} />
          <Route path="/admin/organization" element={<Navigate to="/outcomes" replace />} />
          <Route path="/admin/reports" element={<Navigate to="/outcomes" replace />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/admin/patients" element={adminWrap(PatientManagement, '患者队列', false)} />
            <Route path="/import" element={wrap(DataImport, '数据导入', false)} />
            <Route path="/screening" element={wrap(DiseaseScreening, '临床筛查', true)} />
            <Route path="/appointments" element={wrap(ExamAppointment, '预约体检', true)} />
            <Route path="/doctor-report" element={wrap(DoctorReport, '医生报告', true)} />
            <Route path="/ai/anomaly" element={wrap(AnomalyDetection, '异常检测', false, true)} />
            <Route path="/ai/predictive" element={wrap(PredictiveAnalytics, '预测分析', false, true)} />
            <Route path="/ai/intervention" element={wrap(AIIntervention, 'AI 干预', true)} />
            <Route path="/ai/chat" element={wrap(DoctorAiChat, 'AI 临床助手', false, true)} />
            <Route path="/outcomes" element={wrap(OutcomesComparison, '结局对比', false)} />
            <Route path="/research" element={wrap(ResearchCenter, '研究评价', false)} />
            <Route path="/methodology" element={wrap(Methodology, '方法学文档', false)} />
            <Route path="/settings" element={wrap(SettingsPage, '系统设置', false)} />
          </Route>
        </Routes>
        </HealthDataProvider>
      </DemoPatientProvider>
    </DataModeProvider>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

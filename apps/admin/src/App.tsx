import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminShell } from './components/AdminShell';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { LecturesPage } from './pages/LecturesPage';
import { JobsPage } from './pages/JobsPage';
import { UsagePage } from './pages/UsagePage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="lectures" element={<LecturesPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

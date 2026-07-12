import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { LecturesPage } from './pages/LecturesPage';
import { NewLecturePage } from './pages/NewLecturePage';
import { LectureDetailPage } from './pages/LectureDetailPage';
import { RecorderPage } from './pages/RecorderPage';
import { ChatPage } from './pages/ChatPage';
import { StudyPlanPage } from './pages/StudyPlanPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/lectures" element={<LecturesPage />} />
        <Route path="/lectures/new" element={<NewLecturePage />} />
        <Route path="/lectures/:lectureId" element={<LectureDetailPage />} />
        <Route path="/recorder" element={<RecorderPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/study-plan" element={<StudyPlanPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

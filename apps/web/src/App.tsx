import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

// Eagerly loaded: lightweight pages that form the initial user journey
import { HomePage } from './pages/HomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { LecturesPage } from './pages/LecturesPage';
import { NewLecturePage } from './pages/NewLecturePage';
import { PrivacyPage } from './pages/PrivacyPage';

// Lazy-loaded: heavier pages that are not needed on first render
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage })));
const LectureDetailPage = lazy(() => import('./pages/LectureDetailPage').then((m) => ({ default: m.LectureDetailPage })));
const RecorderPage = lazy(() => import('./pages/RecorderPage').then((m) => ({ default: m.RecorderPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const StudyPlanPage = lazy(() => import('./pages/StudyPlanPage').then((m) => ({ default: m.StudyPlanPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ModelManagerPage = lazy(() => import('./pages/ModelManagerPage').then((m) => ({ default: m.ModelManagerPage })));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px' }}>
      <span>Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route
          path="/courses/:courseId"
          element={<Suspense fallback={<PageLoader />}><CourseDetailPage /></Suspense>}
        />
        <Route path="/lectures" element={<LecturesPage />} />
        <Route path="/lectures/new" element={<NewLecturePage />} />
        <Route
          path="/lectures/:lectureId"
          element={<Suspense fallback={<PageLoader />}><LectureDetailPage /></Suspense>}
        />
        <Route
          path="/recorder"
          element={<Suspense fallback={<PageLoader />}><RecorderPage /></Suspense>}
        />
        <Route
          path="/chat"
          element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>}
        />
        <Route
          path="/study-plan"
          element={<Suspense fallback={<PageLoader />}><StudyPlanPage /></Suspense>}
        />
        <Route
          path="/settings"
          element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>}
        />
        <Route
          path="/settings/models"
          element={<Suspense fallback={<PageLoader />}><ModelManagerPage /></Suspense>}
        />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

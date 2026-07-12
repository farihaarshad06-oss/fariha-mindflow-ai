export const WEB_ROUTES = {
  home: '/',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  courses: '/courses',
  courseDetail: (courseId: string) => `/courses/${courseId}`,
  lectures: '/lectures',
  newLecture: '/lectures/new',
  lectureDetail: (lectureId: string) => `/lectures/${lectureId}`,
  recorder: '/recorder',
  chat: '/chat',
  studyPlan: '/study-plan',
  settings: '/settings',
  privacy: '/privacy',
} as const;

export const ADMIN_ROUTES = {
  dashboard: '/admin',
  users: '/admin/users',
  lectures: '/admin/lectures',
  jobs: '/admin/jobs',
  usage: '/admin/usage',
  auditLogs: '/admin/audit-logs',
  settings: '/admin/settings',
} as const;

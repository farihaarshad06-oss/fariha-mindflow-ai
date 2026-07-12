# Fariha MindFlow AI - System Architecture

## Overview
The Fariha MindFlow AI platform is a comprehensive personal learning assistant designed for students. The architecture follows a modern monorepo structure with clear separation of concerns and scalable design.

## Architecture Components

### 1. Monorepo Structure
- **Root**: pnpm workspaces with Turborepo
- **Applications**:
  - `apps/web`: React + Vite + Tailwind + i18n + Zustand
  - `apps/admin`: React admin dashboard
  - `apps/mobile`: Expo React Native (skeleton)
- **Services**:
  - `services/api`: NestJS API gateway
  - `services/ai-worker`: Background AI processing
  - `services/transcription-worker`: Audio transcription
- **Packages**:
  - `packages/ui`: Shared UI components
  - `packages/config`: Configuration management
  - `packages/types`: Type definitions
  - `packages/validation`: Schema validation
  - `packages/api-client`: Client-side API utilities
  - `packages/eslint-config`: Linting rules
  - `packages/tsconfig`: TypeScript configuration

## Key Components

### 1. Authentication System
- **JWT-based authentication** with access and refresh tokens
- **Secure password hashing** using bcrypt
- **Session management** with token rotation
- **Environment-based configuration** for dev/prod
- **Current State**: JWT implementation exists but uses in-memory storage

### 2. API Gateway
- **NestJS Framework**: RESTful API design
- **Security**: Helmet, CORS, Validation pipes, Request ID
- **Authentication**: JWT Auth Guard protects most endpoints
- **Versioning**: URI-based versioning (v1)
- **Current State**: API endpoints exist but lack full security

### 3. Database Layer
- **Primary Database**: PostgreSQL with pgvector extension
- **ORM**: Prisma (schema defined but not fully connected)
- **Models**: Comprehensive entity model with relationships
- **Current State**: Schema exists but application uses in-memory repositories

### 4. AI Provider System
- **Adapter Pattern**: Provider-agnostic architecture
- **Supported Providers**:
  - OpenAI-compatible
  - Azure OpenAI
  - Google Gemini
  - Anthropic
  - Local Ollama
- **Mock Provider**: Development/testing fallback
- **Current State**: Framework exists but mock implementation only

### 5. Knowledge Base & RAG
- **Document Processing Pipeline**:
  1. Secure upload
  2. File-type validation
  3. Malware-safe handling
  4. Metadata extraction
  5. Text extraction
  6. Language detection
  7. Text cleanup
  8. Semantic chunking
  9. Embeddings
  10. Searchable indexing
  10. Source citation
- **Current State**: Framework exists but no real processing

### 6. Background Jobs
- **Job Types**: Transcription, summarization, embedding, quiz generation, mind-map generation
- **Status Tracking**: QUEUED, RUNNING, RETRYING, COMPLETED, FAILED, CANCELLED
- **Current State**: Job framework exists but limited implementation

## Security Architecture

### 1. Authentication & Authorization
- **JWT Tokens**: Access + refresh tokens with expiration
- **RBAC**: Role-based access control with ownership checks
- **Secure Headers**: Helmet, CORS, CSP
- **Rate Limiting**: Not yet implemented
- **Audit Logging**: Partial implementation

### 2. Security Controls
- **Input Validation**: Via ValidationPipe
- **Secure File Uploads**: Framework exists but needs implementation
- **MIME Validation**: Required for file uploads
- **File Size Limits**: Required for large documents
- **Path Traversal Prevention**: Required for file operations

### 3. Security Best Practices
- **Secure Headers**: Implemented via Helmet
- **CORS**: Allowlist configured
- **Rate Limiting**: Not yet implemented
- **CSRF Protection**: Required for state-changing endpoints
- **Structured Error Responses**: Implemented
- **No Stack Traces**: Production error handling needed

## Database Design

### Current Schema (Prisma)
- **User**: Email, password hash, roles, status, profile
- **UserProfile**: Institution, degree, semester, language preferences
- **Session**: Refresh tokens, revocation, expiration
- **Role**: Multiple roles with different permissions
- **Course**: Title, description, subject, instructor, progress
- **Lecture**: State management, audio file, consent
- **Transcript**: Segments with timestamps, speaker diarization
- **Document**: File storage, embedding support
- **Flashcard**: Question/answer pairs with deck organization
- **Quiz**: Question types, difficulty levels, modes
- **StudyPlan**: Adaptive scheduling and tasks

## API Structure

### REST Endpoints
- **Auth**: /api/v1/auth (register, login, logout, refresh)
- **Users**: /api/v1/users (profile, audit logs)
- **Courses**: /api/v1/courses (CRUD operations)
- **Lectures**: /api/v1/lectures (recording, management)
- **Documents**: /api/v1/documents (upload, processing)
- **AI Jobs**: /api/v1/jobs (transcription, summarization)
- **Health**: /api/v1/health (system status)

## Deployment Architecture

### Local Development
- **Web**: http://localhost:5173
- **Admin**: http://localhost:4173
- **API**: http://localhost:3333
- **Health**: http://localhost:3333/api/health
- **Requires**: Docker for database services

### Production Deployment
- **Web**: Azure Static Web Apps or App Service
- **API**: App Service or Container Apps
- **Workers**: Container Apps or Azure Functions
- **Database**: PostgreSQL-compatible (Azure Database for PostgreSQL)
- **Storage**: Blob Storage for files
- **Secrets**: Key Vault for secrets management
- **Monitoring**: Application Insights for observability
- **CI/CD**: GitHub Actions for automated deployment

## Technology Stack

### Frontend
- React 18+
- Vite
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Zustand
- i18next
- Lucide React

### Backend
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- Docker

### Mobile
- Expo React Native
- Shared codebase with web

## Security Architecture

### 1. Authentication
- JWT-based authentication
- Secure token storage
- Refresh token rotation
- Session management

### 2. Authorization
- Role-based access control
- Resource-level permissions
- Ownership verification
- Admin privileges

### 3. Security Controls
- Input validation
- File upload security
- Rate limiting (pending)
- CSRF protection (pending)
- Secure headers
- Audit logging

### 4. Privacy
- Consent management
- Data minimization
- Anonymization capabilities
- Data export and deletion
- Audit trails

## Performance Considerations

- **Bundle Size**: Optimized with code splitting
- **Database**: pgvector for semantic search
- **Caching**: Redis for session and query caching
- **Lazy Loading**: Route-based code splitting
- **Pagination**: Virtualized lists for large datasets
- **Background Processing**: Worker queues for long tasks

## Deployment Pipeline

1. **Development**: Local Docker compose (Postgres + Redis)
2. **Build**: Turborepo build process
3. **Test**: Unit, integration, E2E tests
4. **Build**: Production build with minification
5. **Deploy**: CI/CD pipeline to Azure
6. **Monitor**: Health checks and logging

## Observability

### Logging
- Structured logging with request ID
- User context (when safe)
- Endpoint and status tracking
- Duration and performance metrics
- Provider and job ID tracking
- Error codes and details

### Health Endpoints
- `/api/health` - Basic system health
- `/api/health/ready` - Ready to serve requests
- `/api/health/live` - Live traffic verification

## Testing Strategy

### Unit Tests
- Service logic validation
- Permission checks
- Study scheduling algorithms
- Spaced repetition logic

### Integration Tests
- Authentication flows
- Course CRUD operations
- Document pipeline
- Transcription jobs
- Chat functionality
- Quiz submission

### E2E Tests
- Onboarding flow
- Lecture recording
- Document upload
- Course creation
- Flashcard generation
- Quiz taking
- Chat interaction
- Settings editing
- Export data

## Security Testing

- Unauthorized access attempts
- Cross-user data access
- Prompt injection attempts
- Invalid file uploads
- Rate limiting tests
- Admin endpoint protection

## Accessibility Testing

- Landing page
- Dashboard
- Recorder
- Chat interface
- Settings page

## Documentation Requirements

- Architecture diagrams
- API documentation
- Security guidelines
- Privacy policy
- Deployment instructions
- Development setup
- Troubleshooting guide
- Feature flags documentation

## Performance Optimization

- Route-based code splitting
- Lazy loading components
- Query caching
- Transcript virtualization
- Large file handling
- Background processing
- Bundle size optimization
- Image optimization
- Mobile performance tuning
- Low-bandwidth support

## Final Notes
This architecture provides a solid foundation for building a reliable, secure, and scalable personal AI learning assistant. The current state shows significant progress in core functionality, but requires critical security and database consistency improvements before full production readiness.
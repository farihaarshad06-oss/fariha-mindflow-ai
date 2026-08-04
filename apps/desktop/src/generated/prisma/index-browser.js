
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.SettingsScalarFieldEnum = {
  id: 'id',
  preferredLanguage: 'preferredLanguage',
  theme: 'theme',
  audioRetentionDays: 'audioRetentionDays',
  recordingConsentGiven: 'recordingConsentGiven',
  onboardingComplete: 'onboardingComplete',
  storagePath: 'storagePath',
  whisperModelId: 'whisperModelId',
  defaultAiProvider: 'defaultAiProvider',
  aiMode: 'aiMode',
  dailyTokenLimit: 'dailyTokenLimit',
  monthlyTokenLimit: 'monthlyTokenLimit',
  dailyCostLimitCents: 'dailyCostLimitCents',
  monthlyCostLimitCents: 'monthlyCostLimitCents',
  quizDayOfWeek: 'quizDayOfWeek',
  privacyModeDefault: 'privacyModeDefault',
  updatedAt: 'updatedAt'
};

exports.Prisma.CourseScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  color: 'color',
  nextExamDate: 'nextExamDate',
  progress: 'progress',
  weakTopics: 'weakTopics',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LectureScalarFieldEnum = {
  id: 'id',
  courseId: 'courseId',
  title: 'title',
  state: 'state',
  durationSeconds: 'durationSeconds',
  audioPath: 'audioPath',
  language: 'language',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RecordingSessionScalarFieldEnum = {
  id: 'id',
  lectureId: 'lectureId',
  microphoneId: 'microphoneId',
  microphoneName: 'microphoneName',
  state: 'state',
  privacyMode: 'privacyMode',
  totalDurationMs: 'totalDurationMs',
  chunkCount: 'chunkCount',
  startedAt: 'startedAt',
  pausedAt: 'pausedAt',
  stoppedAt: 'stoppedAt',
  crashedAt: 'crashedAt',
  recoveredAt: 'recoveredAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AudioChunkScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  lectureId: 'lectureId',
  index: 'index',
  filePath: 'filePath',
  fileSizeBytes: 'fileSizeBytes',
  durationMs: 'durationMs',
  startOffsetMs: 'startOffsetMs',
  state: 'state',
  checksum: 'checksum',
  createdAt: 'createdAt',
  completedAt: 'completedAt'
};

exports.Prisma.TranscriptSegmentScalarFieldEnum = {
  id: 'id',
  lectureId: 'lectureId',
  segmentIndex: 'segmentIndex',
  speaker: 'speaker',
  text: 'text',
  editedText: 'editedText',
  timestampStart: 'timestampStart',
  timestampEnd: 'timestampEnd',
  confidence: 'confidence',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LectureSummaryScalarFieldEnum = {
  id: 'id',
  lectureId: 'lectureId',
  content: 'content',
  keyPoints: 'keyPoints',
  definitions: 'definitions',
  unclearTopics: 'unclearTopics',
  reviewSuggestions: 'reviewSuggestions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.KeyConceptScalarFieldEnum = {
  id: 'id',
  lectureId: 'lectureId',
  label: 'label',
  description: 'description',
  createdAt: 'createdAt'
};

exports.Prisma.FlashcardScalarFieldEnum = {
  id: 'id',
  lectureId: 'lectureId',
  courseId: 'courseId',
  question: 'question',
  answer: 'answer',
  difficulty: 'difficulty',
  easeFactor: 'easeFactor',
  intervalDays: 'intervalDays',
  repetitions: 'repetitions',
  nextReviewDate: 'nextReviewDate',
  lastReviewDate: 'lastReviewDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QuizScalarFieldEnum = {
  id: 'id',
  title: 'title',
  courseId: 'courseId',
  weekStart: 'weekStart',
  state: 'state',
  score: 'score',
  totalPoints: 'totalPoints',
  earnedPoints: 'earnedPoints',
  createdAt: 'createdAt',
  completedAt: 'completedAt'
};

exports.Prisma.QuizQuestionScalarFieldEnum = {
  id: 'id',
  quizId: 'quizId',
  questionType: 'questionType',
  text: 'text',
  options: 'options',
  correctAnswer: 'correctAnswer',
  explanation: 'explanation',
  points: 'points',
  sourceSegmentIds: 'sourceSegmentIds'
};

exports.Prisma.QuizAttemptScalarFieldEnum = {
  id: 'id',
  quizId: 'quizId',
  startedAt: 'startedAt',
  submittedAt: 'submittedAt',
  score: 'score'
};

exports.Prisma.QuizAnswerScalarFieldEnum = {
  id: 'id',
  attemptId: 'attemptId',
  questionId: 'questionId',
  answer: 'answer',
  isCorrect: 'isCorrect',
  pointsEarned: 'pointsEarned',
  feedback: 'feedback'
};

exports.Prisma.WhisperModelScalarFieldEnum = {
  id: 'id',
  name: 'name',
  sizeBytes: 'sizeBytes',
  downloadUrl: 'downloadUrl',
  sha256: 'sha256',
  localPath: 'localPath',
  state: 'state',
  downloadedBytes: 'downloadedBytes',
  downloadedAt: 'downloadedAt',
  lastUsedAt: 'lastUsedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AiProviderScalarFieldEnum = {
  id: 'id',
  providerType: 'providerType',
  displayName: 'displayName',
  enabled: 'enabled',
  isDefault: 'isDefault',
  baseUrl: 'baseUrl',
  modelRouting: 'modelRouting',
  secretKeyRef: 'secretKeyRef',
  lastTestedAt: 'lastTestedAt',
  lastTestOk: 'lastTestOk',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AiUsageEventScalarFieldEnum = {
  id: 'id',
  provider: 'provider',
  model: 'model',
  operation: 'operation',
  inputTokens: 'inputTokens',
  outputTokens: 'outputTokens',
  estimatedCostCents: 'estimatedCostCents',
  cacheHit: 'cacheHit',
  requestHash: 'requestHash',
  lectureId: 'lectureId',
  courseId: 'courseId',
  createdAt: 'createdAt'
};

exports.Prisma.AiRequestCacheScalarFieldEnum = {
  requestHash: 'requestHash',
  provider: 'provider',
  model: 'model',
  operation: 'operation',
  responseJson: 'responseJson',
  inputTokens: 'inputTokens',
  outputTokens: 'outputTokens',
  createdAt: 'createdAt',
  expiresAt: 'expiresAt',
  hitCount: 'hitCount'
};

exports.Prisma.ProcessingJobScalarFieldEnum = {
  id: 'id',
  jobType: 'jobType',
  status: 'status',
  priority: 'priority',
  payload: 'payload',
  retryCount: 'retryCount',
  maxRetries: 'maxRetries',
  errorCode: 'errorCode',
  safeErrorMessage: 'safeErrorMessage',
  lockedBy: 'lockedBy',
  lockedAt: 'lockedAt',
  scheduledAfter: 'scheduledAfter',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BackupRecordScalarFieldEnum = {
  id: 'id',
  filePath: 'filePath',
  fileSizeBytes: 'fileSizeBytes',
  sha256: 'sha256',
  includeAudio: 'includeAudio',
  createdAt: 'createdAt'
};

exports.Prisma.ChatMessageScalarFieldEnum = {
  id: 'id',
  courseId: 'courseId',
  role: 'role',
  content: 'content',
  citationIds: 'citationIds',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Settings: 'Settings',
  Course: 'Course',
  Lecture: 'Lecture',
  RecordingSession: 'RecordingSession',
  AudioChunk: 'AudioChunk',
  TranscriptSegment: 'TranscriptSegment',
  LectureSummary: 'LectureSummary',
  KeyConcept: 'KeyConcept',
  Flashcard: 'Flashcard',
  Quiz: 'Quiz',
  QuizQuestion: 'QuizQuestion',
  QuizAttempt: 'QuizAttempt',
  QuizAnswer: 'QuizAnswer',
  WhisperModel: 'WhisperModel',
  AiProvider: 'AiProvider',
  AiUsageEvent: 'AiUsageEvent',
  AiRequestCache: 'AiRequestCache',
  ProcessingJob: 'ProcessingJob',
  BackupRecord: 'BackupRecord',
  ChatMessage: 'ChatMessage'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)

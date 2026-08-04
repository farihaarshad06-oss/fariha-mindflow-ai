-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "audioRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "recordingConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "storagePath" TEXT,
    "whisperModelId" TEXT,
    "defaultAiProvider" TEXT,
    "aiMode" TEXT NOT NULL DEFAULT 'local',
    "dailyTokenLimit" INTEGER NOT NULL DEFAULT 50000,
    "monthlyTokenLimit" INTEGER NOT NULL DEFAULT 500000,
    "dailyCostLimitCents" INTEGER NOT NULL DEFAULT 500,
    "monthlyCostLimitCents" INTEGER NOT NULL DEFAULT 5000,
    "quizDayOfWeek" INTEGER NOT NULL DEFAULT 0,
    "privacyModeDefault" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "nextExamDate" DATETIME,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "weakTopics" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "durationSeconds" INTEGER,
    "audioPath" TEXT,
    "language" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lecture_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecordingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lectureId" TEXT NOT NULL,
    "microphoneId" TEXT,
    "microphoneName" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "privacyMode" BOOLEAN NOT NULL DEFAULT false,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" DATETIME,
    "stoppedAt" DATETIME,
    "crashedAt" DATETIME,
    "recoveredAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecordingSession_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startOffsetMs" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'RECORDING',
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AudioChunk_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecordingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AudioChunk_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lectureId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "speaker" TEXT,
    "text" TEXT NOT NULL,
    "editedText" TEXT,
    "timestampStart" REAL NOT NULL,
    "timestampEnd" REAL NOT NULL,
    "confidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TranscriptSegment_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LectureSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lectureId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keyPoints" TEXT NOT NULL DEFAULT '[]',
    "definitions" TEXT NOT NULL DEFAULT '[]',
    "unclearTopics" TEXT NOT NULL DEFAULT '[]',
    "reviewSuggestions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LectureSummary_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KeyConcept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lectureId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KeyConcept_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lectureId" TEXT,
    "courseId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Flashcard_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "courseId" TEXT,
    "weekStart" DATETIME,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "earnedPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT NOT NULL DEFAULT '[]',
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "sourceSegmentIds" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "score" INTEGER,
    CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhisperModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "localPath" TEXT,
    "state" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "downloadedBytes" INTEGER NOT NULL DEFAULT 0,
    "downloadedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT,
    "modelRouting" TEXT NOT NULL DEFAULT '{}',
    "secretKeyRef" TEXT,
    "lastTestedAt" DATETIME,
    "lastTestOk" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "requestHash" TEXT,
    "lectureId" TEXT,
    "courseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiRequestCache" (
    "requestHash" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "errorCode" TEXT,
    "safeErrorMessage" TEXT,
    "lockedBy" TEXT,
    "lockedAt" DATETIME,
    "scheduledAfter" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "includeAudio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citationIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSession_lectureId_key" ON "RecordingSession"("lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "AudioChunk_sessionId_index_key" ON "AudioChunk"("sessionId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptSegment_lectureId_segmentIndex_key" ON "TranscriptSegment"("lectureId", "segmentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "LectureSummary_lectureId_key" ON "LectureSummary"("lectureId");

-- FTS5 virtual table for full-text search over transcript segments
CREATE VIRTUAL TABLE IF NOT EXISTS "TranscriptFts" USING fts5(
    "lectureId" UNINDEXED,
    "segmentId" UNINDEXED,
    "text",
    content="TranscriptSegment",
    content_rowid="rowid",
    tokenize="unicode61"
);

-- Triggers to keep FTS in sync with TranscriptSegment
CREATE TRIGGER "ts_fts_insert" AFTER INSERT ON "TranscriptSegment" BEGIN
    INSERT INTO "TranscriptFts"(rowid, lectureId, segmentId, text)
    VALUES (new.rowid, new.lectureId, new.id, COALESCE(new.editedText, new.text));
END;

CREATE TRIGGER "ts_fts_delete" AFTER DELETE ON "TranscriptSegment" BEGIN
    INSERT INTO "TranscriptFts"("TranscriptFts", rowid, lectureId, segmentId, text)
    VALUES ('delete', old.rowid, old.lectureId, old.id, COALESCE(old.editedText, old.text));
END;

CREATE TRIGGER "ts_fts_update" AFTER UPDATE ON "TranscriptSegment" BEGIN
    INSERT INTO "TranscriptFts"("TranscriptFts", rowid, lectureId, segmentId, text)
    VALUES ('delete', old.rowid, old.lectureId, old.id, COALESCE(old.editedText, old.text));
    INSERT INTO "TranscriptFts"(rowid, lectureId, segmentId, text)
    VALUES (new.rowid, new.lectureId, new.id, COALESCE(new.editedText, new.text));
END;

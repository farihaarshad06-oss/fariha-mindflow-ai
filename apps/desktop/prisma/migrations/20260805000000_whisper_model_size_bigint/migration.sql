-- Migration: whisper_model_size_bigint
-- Change sizeBytes and downloadedBytes from INTEGER to BIGINT on WhisperModel.
-- SQLite does not support ALTER COLUMN, so we recreate the table without data loss.

-- Step 1: rename existing table
ALTER TABLE "WhisperModel" RENAME TO "WhisperModel_old";

-- Step 2: create new table with BIGINT columns
CREATE TABLE "WhisperModel" (
    "id"              TEXT      NOT NULL PRIMARY KEY,
    "name"            TEXT      NOT NULL,
    "sizeBytes"       BIGINT    NOT NULL,
    "downloadUrl"     TEXT      NOT NULL,
    "sha256"          TEXT      NOT NULL,
    "localPath"       TEXT,
    "state"           TEXT      NOT NULL DEFAULT 'AVAILABLE',
    "downloadedBytes" BIGINT    NOT NULL DEFAULT 0,
    "downloadedAt"    DATETIME,
    "lastUsedAt"      DATETIME,
    "createdAt"       DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME  NOT NULL
);

-- Step 3: copy existing data
INSERT INTO "WhisperModel" SELECT * FROM "WhisperModel_old";

-- Step 4: drop the old table
DROP TABLE "WhisperModel_old";

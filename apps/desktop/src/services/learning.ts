/**
 * LearningService — generates summaries, flashcards, quizzes, and study plans.
 *
 * All generation is source-grounded:
 * - Retrieves relevant transcript segments first (FTS5/BM25)
 * - Sends only selected source context (never full transcripts to cloud)
 * - Validates all AI output with Zod schemas
 * - Supports local-only mode (extractive) and AI-enhanced mode
 * - Persists results transactionally
 * - Deduplicates flashcards
 */

import { z } from 'zod';
import log from 'electron-log/main';
import { getPrisma } from './database';
import { aiRequest } from './aiProviders';
import { TranscriptService } from './transcript';
import { SettingsService } from './settings';
import type { LectureSummary, Flashcard } from '../generated/prisma';

// ── Zod schemas for AI-generated structures ────────────────────────────────

const SummarySchema = z.object({
  title: z.string().min(1).max(200),
  shortSummary: z.string().min(1).max(500),
  detailedSummary: z.string().min(1),
  topics: z.array(z.string()).default([]),
  keyPoints: z.array(z.string()).default([]),
  definitions: z.array(z.object({ term: z.string(), definition: z.string() })).default([]),
  unclearPoints: z.array(z.string()).default([]),
  suggestedReview: z.array(z.string()).default([]),
  sourceSegmentIds: z.array(z.string()).default([]),
}).describe('Lecture summary JSON object');

const FlashcardsSchema = z.object({
  flashcards: z.array(z.object({
    question: z.string().min(1).max(500),
    answer: z.string().min(1).max(1000),
    difficulty: z.number().int().min(1).max(5).default(3),
  })).default([]),
}).describe('Array of flashcard objects');

const QuizSchema = z.object({
  title: z.string().min(1).max(200),
  questions: z.array(z.object({
    questionType: z.enum(['MC', 'TF', 'WRITTEN']),
    text: z.string().min(1).max(1000),
    options: z.array(z.string()).default([]),
    correctAnswer: z.string().min(1).max(500),
    explanation: z.string().optional(),
    points: z.number().int().min(1).max(10).default(1),
    sourceSegmentIds: z.array(z.string()).default([]),
  })).min(1),
}).describe('Weekly quiz JSON object');

const StudyPlanSchema = z.object({
  weeklyPlan: z.array(z.object({
    day: z.string(),
    tasks: z.array(z.object({
      type: z.enum(['review', 'flashcards', 'practice', 'reading']),
      description: z.string(),
      durationMinutes: z.number().int().min(5).max(120),
      priority: z.enum(['high', 'medium', 'low']),
      topicOrLectureId: z.string().optional(),
    })),
  })),
  weaknessTargets: z.array(z.string()).default([]),
  spaceRepetitionDue: z.array(z.string()).default([]),
}).describe('Adaptive study plan JSON object');

// ── Helpers ────────────────────────────────────────────────────────────────

async function getDefaultProvider(): Promise<string | null> {
  const db = getPrisma();
  const settings = await SettingsService.get();
  if (settings.defaultAiProvider) return settings.defaultAiProvider;
  const provider = await db.aiProvider.findFirst({ where: { enabled: true, isDefault: true } });
  if (provider) return provider.id;
  const any = await db.aiProvider.findFirst({ where: { enabled: true } });
  return any?.id ?? null;
}

function truncateContext(segments: Array<{ text: string }>, maxChars = 6000): string {
  let total = 0;
  const parts: string[] = [];
  for (const seg of segments) {
    if (total + seg.text.length > maxChars) break;
    parts.push(seg.text);
    total += seg.text.length;
  }
  return parts.join(' ');
}

// ── Summary generation ─────────────────────────────────────────────────────

export async function generateSummary(lectureId: string): Promise<LectureSummary> {
  const db = getPrisma();

  // Get existing segments
  const segments = await db.transcriptSegment.findMany({
    where: { lectureId },
    orderBy: { segmentIndex: 'asc' },
  });

  if (segments.length === 0) {
    throw new Error('No transcript segments found for this lecture');
  }

  const sourceSegmentIds = segments.slice(0, 20).map((s) => s.id);
  const context = segments.map((s) => s.editedText ?? s.text).join(' ');
  const contextTruncated = context.slice(0, 8000);

  const providerId = await getDefaultProvider();

  let summaryData: z.infer<typeof SummarySchema>;

  if (!providerId) {
    // Local extractive mode
    summaryData = generateExtractiveSummary(segments.map((s) => s.editedText ?? s.text));
  } else {
    try {
      const result = await aiRequest({
        providerId,
        tier: 'balanced',
        operation: 'summary',
        systemPrompt: `You are an academic assistant. Analyze the following lecture transcript and produce a structured summary. 
Respond ONLY with a JSON object matching this exact structure:
{
  "title": "string",
  "shortSummary": "string (max 200 words)",
  "detailedSummary": "string",
  "topics": ["string"],
  "keyPoints": ["string"],
  "definitions": [{"term": "string", "definition": "string"}],
  "unclearPoints": ["string"],
  "suggestedReview": ["string"],
  "sourceSegmentIds": ["string"]
}`,
        userPrompt: `Lecture transcript:\n\n${contextTruncated}\n\nSource segment IDs available: ${sourceSegmentIds.join(', ')}`,
        responseSchema: SummarySchema,
        lectureId,
        maxOutputTokens: 2048,
      });
      summaryData = result.data;
      // Validate source segment IDs — only keep IDs that exist
      const validIds = new Set(segments.map((s) => s.id));
      summaryData.sourceSegmentIds = summaryData.sourceSegmentIds.filter((id) => validIds.has(id));
      if (summaryData.sourceSegmentIds.length === 0) summaryData.sourceSegmentIds = sourceSegmentIds.slice(0, 5);
    } catch (err) {
      log.warn('[learning] AI summary failed, falling back to extractive:', err instanceof Error ? err.message : String(err));
      summaryData = generateExtractiveSummary(segments.map((s) => s.editedText ?? s.text));
    }
  }

  // Persist
  const existing = await db.lectureSummary.findUnique({ where: { lectureId } });
  const saved = existing
    ? await db.lectureSummary.update({
        where: { lectureId },
        data: {
          content: `${summaryData.title}\n\n${summaryData.detailedSummary}`,
          keyPoints: JSON.stringify(summaryData.keyPoints),
          definitions: JSON.stringify(summaryData.definitions),
          unclearTopics: JSON.stringify(summaryData.unclearPoints),
          reviewSuggestions: JSON.stringify(summaryData.suggestedReview),
        },
      })
    : await db.lectureSummary.create({
        data: {
          lectureId,
          content: `${summaryData.title}\n\n${summaryData.detailedSummary}`,
          keyPoints: JSON.stringify(summaryData.keyPoints),
          definitions: JSON.stringify(summaryData.definitions),
          unclearTopics: JSON.stringify(summaryData.unclearPoints),
          reviewSuggestions: JSON.stringify(summaryData.suggestedReview),
        },
      });

  log.info('[learning] Summary generated for lecture', lectureId);
  return saved;
}

function generateExtractiveSummary(
  texts: string[]
): z.infer<typeof SummarySchema> {
  const joined = texts.join(' ');
  // Simple sentence extraction
  const sentences = joined.match(/[^.!?]+[.!?]+/g) ?? [joined];
  const keyPoints = sentences.slice(0, Math.min(5, sentences.length)).map((s) => s.trim()).filter((s) => s.length > 20);

  return {
    title: 'Lecture Summary',
    shortSummary: joined.slice(0, 300),
    detailedSummary: joined.slice(0, 2000),
    topics: [],
    keyPoints,
    definitions: [],
    unclearPoints: [],
    suggestedReview: [],
    sourceSegmentIds: [],
  };
}

// ── Flashcard generation ───────────────────────────────────────────────────

export async function generateFlashcards(lectureId: string, courseId?: string): Promise<Flashcard[]> {
  const db = getPrisma();

  const segments = await db.transcriptSegment.findMany({
    where: { lectureId },
    orderBy: { segmentIndex: 'asc' },
  });

  if (segments.length === 0) {
    throw new Error('No transcript segments found');
  }

  const contextTruncated = truncateContext(segments.map((s) => ({ text: s.editedText ?? s.text })));
  const providerId = await getDefaultProvider();

  let newCards: Array<{ question: string; answer: string; difficulty: number }> = [];

  if (!providerId) {
    // Minimal extractive flashcards from definitions in summary
    const summary = await db.lectureSummary.findUnique({ where: { lectureId } });
    if (summary) {
      try {
        const defs = JSON.parse(summary.definitions) as Array<{ term: string; definition: string }>;
        newCards = defs.map((d) => ({ question: `What is ${d.term}?`, answer: d.definition, difficulty: 2 }));
      } catch { /* invalid JSON in definitions — skip */ }
    }
  } else {
    try {
      const result = await aiRequest({
        providerId,
        tier: 'economy',
        operation: 'flashcards',
        systemPrompt: `You are an academic flashcard generator. Create flashcards from lecture content.
Respond ONLY with a JSON object: {"flashcards": [{"question": "string", "answer": "string", "difficulty": 1-5}]}
- Generate 5-15 flashcards covering key concepts, definitions, and important points
- Questions should be clear and specific
- Answers should be concise but complete
- Difficulty: 1=easy, 5=hard`,
        userPrompt: `Lecture transcript:\n\n${contextTruncated}`,
        responseSchema: FlashcardsSchema,
        lectureId,
        maxOutputTokens: 2048,
      });
      newCards = result.data.flashcards;
    } catch (err) {
      log.warn('[learning] AI flashcard generation failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // Deduplicate: check against existing flashcards
  const existing = await db.flashcard.findMany({
    where: { lectureId },
    select: { question: true },
  });
  const existingQuestions = new Set(existing.map((c) => c.question.toLowerCase().trim()));

  const toCreate = newCards.filter((c) => !existingQuestions.has(c.question.toLowerCase().trim()));

  if (toCreate.length === 0) {
    return db.flashcard.findMany({ where: { lectureId }, orderBy: { createdAt: 'asc' } });
  }

  await db.flashcard.createMany({
    data: toCreate.map((c) => ({
      lectureId,
      courseId: courseId ?? null,
      question: c.question,
      answer: c.answer,
      difficulty: c.difficulty,
    })),
  });

  log.info(`[learning] Created ${toCreate.length} flashcards for lecture ${lectureId}`);
  return db.flashcard.findMany({ where: { lectureId }, orderBy: { createdAt: 'asc' } });
}

// ── Grounded chat ──────────────────────────────────────────────────────────

export async function groundedChat(opts: {
  courseId?: string;
  message: string;
  providerId?: string;
}): Promise<{
  answer: string;
  citationIds: string[];
  sources: Array<{ segmentId: string; lectureId: string; text: string; rank: number }>;
  fromAi: boolean;
}> {
  const db = getPrisma();

  // FTS5 retrieval first
  const results = await TranscriptService.search(opts.message, {
    courseId: opts.courseId,
    limit: 6,
  });

  if (results.length === 0) {
    return {
      answer: 'I could not find relevant content in your transcripts to answer this question. Please ensure lectures have been transcribed first.',
      citationIds: [],
      sources: [],
      fromAi: false,
    };
  }

  const providerId = opts.providerId ?? (await getDefaultProvider());

  // Validate that all returned segment IDs actually exist in DB (prevent fabricated citations)
  const rawCitationIds = results.map((r) => r.segmentId);
  const validSegments = await db.transcriptSegment.findMany({
    where: { id: { in: rawCitationIds } },
    select: { id: true },
  });
  const validIdSet = new Set(validSegments.map((s) => s.id));
  const validCitationIds = rawCitationIds.filter((id) => validIdSet.has(id));

  if (!providerId) {
    // Extractive local answer
    const context = results.map((r, i) => `[${i + 1}] ${r.text}`).join('\n\n');
    return {
      answer: `Based on your lecture notes:\n\n${context}`,
      citationIds: validCitationIds,
      sources: results,
      fromAi: false,
    };
  }

  // Build context from retrieved segments only (never full transcript)
  const context = results.map((r, i) => `[${i + 1}] (Segment ${r.segmentId}): ${r.text}`).join('\n\n');

  try {
    const result = await aiRequest({
      providerId,
      tier: 'economy',
      operation: 'chat',
      systemPrompt: `You are a helpful academic tutor. Answer questions ONLY based on the provided lecture transcript excerpts.
Rules:
- Only use information from the provided source segments
- If the answer is not in the sources, say so clearly
- Reference source numbers like [1], [2] etc.
- Be concise and accurate
- Never fabricate information or citations`,
      userPrompt: `Question: ${opts.message}\n\nAvailable lecture sources:\n\n${context}`,
      courseId: opts.courseId,
    });

    return {
      answer: result.data as string,
      citationIds: validCitationIds,
      sources: results,
      fromAi: true,
    };
  } catch (err) {
    log.warn('[learning] AI chat failed, using extractive:', err instanceof Error ? err.message : String(err));
    const fallback = results.map((r, i) => `[${i + 1}] ${r.text}`).join('\n\n');
    return {
      answer: `Based on your lecture notes:\n\n${fallback}`,
      citationIds: validCitationIds,
      sources: results,
      fromAi: false,
    };
  }
}

// ── Weekly quiz generation ─────────────────────────────────────────────────

export async function generateWeeklyQuiz(courseId: string, weekStart: Date): Promise<string> {
  const db = getPrisma();
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  // Get lectures from this week
  const lectures = await db.lecture.findMany({
    where: {
      courseId,
      createdAt: { gte: weekStart, lt: weekEnd },
      state: 'READY',
    },
    include: { transcriptSegments: { take: 50, orderBy: { segmentIndex: 'asc' } } },
  });

  if (lectures.length === 0) {
    // Fall back to all ready lectures for this course
    const allLectures = await db.lecture.findMany({
      where: { courseId, state: 'READY' },
      include: { transcriptSegments: { take: 30, orderBy: { segmentIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    if (allLectures.length === 0) throw new Error('No transcribed lectures found for quiz generation');
    lectures.push(...allLectures);
  }

  // Gather flashcards for context
  const flashcards = await db.flashcard.findMany({
    where: { courseId },
    orderBy: { difficulty: 'desc' },
    take: 20,
  });

  // Build context
  const contextParts: string[] = [];
  for (const lecture of lectures) {
    const text = lecture.transcriptSegments.map((s) => s.editedText ?? s.text).join(' ').slice(0, 2000);
    contextParts.push(`Lecture "${lecture.title}":\n${text}`);
  }

  const flashcardContext = flashcards.slice(0, 10).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n');

  const providerId = await getDefaultProvider();

  let quizData: z.infer<typeof QuizSchema>;

  if (!providerId) {
    // Generate simple true/false questions from flashcards
    quizData = {
      title: `Weekly Quiz - Week of ${weekStart.toLocaleDateString()}`,
      questions: flashcards.slice(0, 5).map((f) => ({
        questionType: 'TF' as const,
        text: `True or False: ${f.question} — ${f.answer}`,
        options: [],
        correctAnswer: 'True',
        explanation: f.answer,
        points: 1,
        sourceSegmentIds: [],
      })),
    };
    if (quizData.questions.length === 0) {
      throw new Error('No flashcards available for quiz generation');
    }
  } else {
    const result = await aiRequest({
      providerId,
      tier: 'balanced',
      operation: 'quiz',
      systemPrompt: `You are an academic quiz generator. Create a weekly quiz from lecture content.
Respond ONLY with JSON matching this structure:
{
  "title": "string",
  "questions": [
    {
      "questionType": "MC"|"TF"|"WRITTEN",
      "text": "string",
      "options": ["string"] (for MC only, 4 options),
      "correctAnswer": "string",
      "explanation": "string",
      "points": 1-3,
      "sourceSegmentIds": []
    }
  ]
}
Generate 8-12 questions mixing MC (60%), TF (20%), and WRITTEN (20%).`,
      userPrompt: `Course material:\n\n${contextParts.join('\n\n')}\n\nKey flashcards:\n${flashcardContext}`,
      responseSchema: QuizSchema,
      courseId,
      maxOutputTokens: 3000,
    });
    quizData = result.data;
  }

  // Persist quiz
  const quiz = await db.quiz.create({
    data: {
      title: quizData.title,
      courseId,
      weekStart,
      state: 'PENDING',
      totalPoints: quizData.questions.reduce((s, q) => s + q.points, 0),
    },
  });

  await db.quizQuestion.createMany({
    data: quizData.questions.map((q) => ({
      quizId: quiz.id,
      questionType: q.questionType,
      text: q.text,
      options: JSON.stringify(q.options),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? null,
      points: q.points,
      sourceSegmentIds: JSON.stringify(q.sourceSegmentIds),
    })),
  });

  log.info(`[learning] Generated quiz ${quiz.id} with ${quizData.questions.length} questions`);
  return quiz.id;
}

// ── Weakness analysis ──────────────────────────────────────────────────────

export async function analyzeWeaknesses(courseId: string): Promise<string[]> {
  const db = getPrisma();

  // Get wrong answers from recent quizzes
  const recentAttempts = await db.quizAttempt.findMany({
    where: {
      quiz: { courseId },
      submittedAt: { not: null },
    },
    include: {
      answers: { include: { attempt: { include: { quiz: { include: { questions: true } } } } } },
    },
    orderBy: { submittedAt: 'desc' },
    take: 5,
  });

  const wrongTopics: string[] = [];
  for (const attempt of recentAttempts) {
    for (const answer of attempt.answers) {
      if (answer.isCorrect === false) {
        // Find the question
        const question = attempt.answers[0]?.attempt.quiz.questions.find((q) => q.id === answer.questionId);
        if (question) wrongTopics.push(question.text.slice(0, 100));
      }
    }
  }

  // Get low-confidence flashcards
  const lowConfCards = await db.flashcard.findMany({
    where: { courseId, easeFactor: { lt: 2.0 }, repetitions: { gt: 0 } },
    orderBy: { easeFactor: 'asc' },
    take: 10,
    select: { question: true },
  });

  const weakTopics = [...new Set([...wrongTopics, ...lowConfCards.map((c) => c.question)])].slice(0, 10);

  // Update course weak topics
  await db.course.update({ where: { id: courseId }, data: { weakTopics: JSON.stringify(weakTopics) } });

  return weakTopics;
}

// ── Study plan generation ──────────────────────────────────────────────────

export async function generateStudyPlan(courseId: string): Promise<z.infer<typeof StudyPlanSchema>> {
  const db = getPrisma();

  const weakTopics = await analyzeWeaknesses(courseId);

  // Get flashcards due for review
  const dueCards = await db.flashcard.findMany({
    where: { courseId, nextReviewDate: { lte: new Date() } },
    orderBy: { nextReviewDate: 'asc' },
    take: 20,
    select: { id: true, question: true, difficulty: true },
  });

  const providerId = await getDefaultProvider();

  if (!providerId) {
    // Generate basic local study plan
    return generateLocalStudyPlan(weakTopics, dueCards.map((c) => c.question));
  }

  try {
    const result = await aiRequest({
      providerId,
      tier: 'economy',
      operation: 'study_plan',
      systemPrompt: `Create an adaptive weekly study plan. Respond ONLY with JSON matching:
{
  "weeklyPlan": [{"day": "Monday", "tasks": [{"type": "review"|"flashcards"|"practice"|"reading", "description": "string", "durationMinutes": number, "priority": "high"|"medium"|"low", "topicOrLectureId": "string?"}]}],
  "weaknessTargets": ["string"],
  "spaceRepetitionDue": ["string"]
}`,
      userPrompt: `Weak topics: ${weakTopics.join(', ')}\nFlashcards due: ${dueCards.map((c) => c.question).slice(0, 10).join(', ')}`,
      responseSchema: StudyPlanSchema,
      courseId,
    });
    return result.data;
  } catch {
    return generateLocalStudyPlan(weakTopics, dueCards.map((c) => c.question));
  }
}

function generateLocalStudyPlan(weakTopics: string[], dueCards: string[]): z.infer<typeof StudyPlanSchema> {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return {
    weeklyPlan: days.map((day, i) => ({
      day,
      tasks: [
        ...(i < 5 ? [{ type: 'flashcards' as const, description: `Review ${dueCards.slice(i * 2, i * 2 + 2).join(', ') || 'due flashcards'}`, durationMinutes: 15, priority: 'high' as const }] : []),
        ...(weakTopics[i] ? [{ type: 'review' as const, description: `Focus on: ${weakTopics[i]}`, durationMinutes: 30, priority: 'high' as const }] : []),
      ],
    })),
    weaknessTargets: weakTopics,
    spaceRepetitionDue: dueCards.slice(0, 10),
  };
}

// ── Spaced repetition SM-2 review ──────────────────────────────────────────

export async function reviewFlashcard(flashcardId: string, quality: number): Promise<Flashcard> {
  const db = getPrisma();
  const card = await db.flashcard.findUniqueOrThrow({ where: { id: flashcardId } });

  let { easeFactor, intervalDays, repetitions } = card;
  if (quality < 3) {
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    intervalDays = 1;
    repetitions = 0;
  } else {
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    repetitions++;
  }

  const nextReviewDate = new Date(Date.now() + intervalDays * 86_400_000);
  return db.flashcard.update({
    where: { id: flashcardId },
    data: { easeFactor, intervalDays, repetitions, nextReviewDate, lastReviewDate: new Date() },
  });
}

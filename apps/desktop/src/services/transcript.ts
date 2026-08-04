/**
 * TranscriptService — manages transcript segments including user edits.
 * Also provides FTS5-based full-text search.
 */

import { getPrisma } from './database';
import log from 'electron-log/main';
import type { TranscriptSegment } from '../generated/prisma';

export const TranscriptService = {
  async listForLecture(lectureId: string): Promise<TranscriptSegment[]> {
    return getPrisma().transcriptSegment.findMany({
      where: { lectureId },
      orderBy: { segmentIndex: 'asc' },
    });
  },

  async editSegment(segmentId: string, editedText: string): Promise<TranscriptSegment> {
    const segment = await getPrisma().transcriptSegment.update({
      where: { id: segmentId },
      data: { editedText: editedText.trim() || null },
    });
    log.info('[transcript] Edited segment:', segmentId);
    return segment;
  },

  async bulkInsert(lectureId: string, segments: Array<{
    segmentIndex: number;
    text: string;
    timestampStart: number;
    timestampEnd: number;
    speaker?: string;
    confidence?: number;
  }>): Promise<void> {
    const db = getPrisma();
    await db.$transaction(
      segments.map((seg) =>
        db.transcriptSegment.upsert({
          where: { lectureId_segmentIndex: { lectureId, segmentIndex: seg.segmentIndex } },
          create: {
            lectureId,
            segmentIndex: seg.segmentIndex,
            text: seg.text,
            timestampStart: seg.timestampStart,
            timestampEnd: seg.timestampEnd,
            speaker: seg.speaker,
            confidence: seg.confidence,
          },
          update: {
            text: seg.text,
            timestampStart: seg.timestampStart,
            timestampEnd: seg.timestampEnd,
            confidence: seg.confidence,
          },
        })
      )
    );
    log.info(`[transcript] Inserted ${segments.length} segments for lecture ${lectureId}`);
  },

  /**
   * FTS5 BM25 search across transcript segments.
   * Returns segments ordered by relevance.
   * Falls back to LIKE search if FTS5 table is not available.
   */
  async search(query: string, opts?: {
    courseId?: string;
    lectureId?: string;
    limit?: number;
  }): Promise<Array<{
    segmentId: string;
    lectureId: string;
    text: string;
    rank: number;
  }>> {
    const db = getPrisma();
    const limit = opts?.limit ?? 20;

    type FtsRow = { segmentId: string; lectureId: string; text: string; rank: number };

    try {
      // Build raw SQL with optional filters
      const params: (string | number)[] = [query, limit];

      const rows = await db.$queryRawUnsafe<FtsRow[]>(
        `SELECT fts.segmentId, fts.lectureId, fts.text, bm25(TranscriptFts) AS rank
         FROM TranscriptFts fts
         JOIN TranscriptSegment s ON s.id = fts.segmentId
         WHERE TranscriptFts MATCH ?
         ${opts?.lectureId ? 'AND s.lectureId = ?' : ''}
         ORDER BY rank
         LIMIT ?`,
        ...params
      );

      return rows;
    } catch (ftsErr) {
      // FTS5 table not available (e.g. fresh test DB without migration) — fall back to LIKE
      log.warn('[transcript] FTS5 unavailable, using LIKE fallback:', ftsErr instanceof Error ? ftsErr.message : String(ftsErr));

      const likeQuery = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
      const segments = await db.transcriptSegment.findMany({
        where: {
          ...(opts?.lectureId ? { lectureId: opts.lectureId } : {}),
          text: { contains: likeQuery.replace(/%/g, '') },
        },
        take: limit,
        orderBy: { segmentIndex: 'asc' },
      });

      return segments.map((s, i) => ({
        segmentId: s.id,
        lectureId: s.lectureId,
        text: s.editedText ?? s.text,
        rank: -1 * (limit - i),
      }));
    }
  },
};

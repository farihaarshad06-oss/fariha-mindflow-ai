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

    // Build raw SQL with optional filters
    // FTS5 bm25() returns negative scores (closer to 0 = better)
    const params: (string | number)[] = [query, limit];

    let whereClause = '';
    if (opts?.lectureId) {
      whereClause = `AND s.lectureId = ?`;
      params.splice(1, 0, opts.lectureId);
      params[params.length - 1] = limit; // fix limit position
    }

    type FtsRow = { segmentId: string; lectureId: string; text: string; rank: number };

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
  },
};

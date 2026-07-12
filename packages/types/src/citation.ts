export type CitationSourceType =
  | 'TRANSCRIPT_SEGMENT'
  | 'DOCUMENT'
  | 'LECTURE'
  | 'COURSE';

export interface Citation {
  id: string;
  sourceType: CitationSourceType;
  lectureId?: string;
  transcriptSegmentId?: string;
  timestampStart?: number;
  timestampEnd?: number;
  documentId?: string;
  documentPage?: number;
  sourceLabel: string;
}

export interface GroundedAnswer {
  content: string;
  citations: Citation[];
}

import { create } from 'zustand';

interface SelectedLecture {
  id: string;
  title?: string;
}

interface LectureStore {
  selectedLecture: SelectedLecture | null;
  selectLecture: (lecture: SelectedLecture | null) => void;
}

export const useLectureStore = create<LectureStore>((set) => ({
  selectedLecture: null,
  selectLecture: (lecture) => set({ selectedLecture: lecture }),
}));

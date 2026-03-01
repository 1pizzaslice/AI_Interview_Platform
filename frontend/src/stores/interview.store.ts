import { create } from 'zustand';

interface InterviewState {
  currentState: string;
  sessionId: string | null;
  setCurrentState: (state: string) => void;
  setSessionId: (id: string) => void;
  reset: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  currentState: 'INTRO',
  sessionId: null,
  setCurrentState: (currentState) => set({ currentState }),
  setSessionId: (sessionId) => set({ sessionId }),
  reset: () => set({ currentState: 'INTRO', sessionId: null }),
}));


export interface Verse {
  verse: number;
  text: string;
}

export interface DailyContent {
  day: number;
  scriptureReference: string;
  scriptureVerses: Verse[];
  interpretation: string;
  practicalSteps: string[];
  reflectionQuestion: string;
  historicalCuriosity: string;
}

export interface UserState {
  name: string;
  currentDay: number; // 1 to 31
  completedDays: number[];
  journalEntries: Record<number, string>;
  favorites: number[];
  theme: 'light' | 'dark';
  isOnboarded: boolean;
}

export type ViewState = 'home' | 'journal' | 'favorites' | 'settings';

export interface IconProps {
  className?: string;
  size?: number;
  fill?: string;
}

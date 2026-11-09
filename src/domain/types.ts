export type LearningObjective =
  | 'meaning_en_vi'
  | 'meaning_vi_en'
  | 'listening_recognition'
  | 'spelling_recall'
  | 'pronunciation';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt?: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  content: string; // Markdown formatted, sides separated by '---'
  cardType: 'basic' | 'reverse' | 'typed' | 'cloze' | 'listening' | 'pronunciation';
  objective: LearningObjective;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  trashedAt: number | null;
  isPinned: boolean;
  reviewReverse: boolean;
  ipaUs?: string | null;
  ipaUk?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface ImageItem {
  id: string;
  url: string;
  thumbnailUrl: string;
  title?: string;
  source: 'wikimedia' | 'pexels' | 'pixabay';
  photographer?: string;
}

export interface CardSummary extends Card {
  tags: string[];
  sides: string[];
  hiddenSidesCount: number;
  isDue: boolean;
  isNew: boolean;
  intervalDays?: number;
  reps?: number;
  state?: CardState;
}

export interface SavedView {
  id: string;
  name: string;
  query: { text?: string; deckId?: string; tag?: string; archived?: boolean };
  createdAt: number;
}

export interface FsrsState {
  cardId: string;
  objective: LearningObjective;
  state: CardState;
  dueAt: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReviewAt: number | null;
  rawJson: string;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  objective: string;
  rating: Rating;
  reviewedAt: number;
  stateBefore: string;
  stateAfter: string;
  scheduledDays: number;
  elapsedDays: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  dateStr?: string;
  secondaryValue?: number;
}

export interface DashboardStats {
  cardsLearned: number;
  retentionRate: number; // percentage (0-100)
  totalReviews: number;
  cardsDueCount: number;
  activeDaysCount: number;
  totalDaysSpan: number;
  totalReviewYearCount: number;
  cardsLearnedTotal: number;
  activityHeatmap: { [dateStr: string]: number }; // YYYY-MM-DD -> count

  // Streak Duolingo flame
  streakDays: number;
  isStreakActiveToday: boolean;
  isStreakFrozen: boolean;
  activeDates: string[];
  streakFrozenDates: string[];

  // Charts
  cumulativeLearnedChart: ChartDataPoint[];
  reviewsChart: ChartDataPoint[];
  retentionChart: ChartDataPoint[];
  reviewTimeChart: ChartDataPoint[]; // in minutes
  reviewForecastChart: ChartDataPoint[]; // upcoming days forecast
  intervalsDistribution: ChartDataPoint[]; // intervals buckets
}

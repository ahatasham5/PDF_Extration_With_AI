
export interface PageExtraction {
  pageNumber: number;
  content: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  imageUrl?: string;
}

export interface ProcessingState {
  status: 'idle' | 'loading' | 'processing' | 'completed' | 'error';
  totalPages: number;
  currentPage: number;
  results: PageExtraction[];
  errorMessage?: string;
}

export interface EvaluationItem {
  id: string;
  questionNumber: string;
  questionText: string;
  modelAnswer: string;
  studentAnswer: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface EvaluationReport {
  items: EvaluationItem[];
  totalScore: number;
  maxPossibleScore: number;
  summary: string;
  improvementAreas: string[];
}

export interface FileData {
  base64: string;
  mimeType: string;
  name: string;
}

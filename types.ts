
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

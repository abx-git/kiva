import type { Session } from '@supabase/supabase-js';
import type { LocalArtifactRecord } from './lib/artifacts-types';
import type { InstructionListItem } from './lib/instructions-types';

export type AppView = 'login' | 'home';

export interface LocalArtifactDraft {
  id: string;
  instructionId: string;
  fileName: string;
  sha256: string;
  createdAt: string;
  syncStatus: 'local' | 'uploading' | 'published' | 'error';
}

export interface AppState {
  view: AppView;
  session: Session | null;
  error: string | null;
  loading: boolean;
  instructions: InstructionListItem[];
  instructionsLoading: boolean;
  downloadingId: string | null;
  artifacts: LocalArtifactRecord[];
  uploadingArtifactId: string | null;
}

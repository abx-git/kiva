import {
  applySession,
  bindAppController,
  bootstrapHomeData,
  createInitialState,
  renderApp,
} from './app';
import type { AppState } from './types';
import { loadConfig } from './config';
import { getSession, onAuthStateChange } from './lib/supabase';
import './styles.css';

const appEl = document.querySelector<HTMLDivElement>('#app');
if (!appEl) throw new Error('#app missing');
const root: HTMLDivElement = appEl;

const config = loadConfig();
let state = createInitialState(null);

function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
}

bindAppController({
  config,
  root,
  setState,
  getState: () => state,
});

async function bootstrap(): Promise<void> {
  const session = await getSession(config);
  state = createInitialState(session);
  renderApp(root, config, state);
  if (session) {
    void bootstrapHomeData(config);
  }

  onAuthStateChange(config, (session) => {
    applySession(session);
  });

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      });
    } catch (err) {
      console.warn('Service Worker registration failed', err);
    }
  }
}

void bootstrap();

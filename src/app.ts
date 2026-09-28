import type { Session } from '@supabase/supabase-js';
import { signInWithPassword, signOut } from './auth/login';
import { getSession } from './lib/supabase';
import type { KivaConfig } from './config';
import { isSupabaseConfigured } from './config';
import {
  refreshArtifactList,
  registerArtifactFromFile,
  setArtifactVisibility,
  uploadArtifact,
} from './lib/artifacts-service';
import type { LocalArtifactRecord } from './lib/artifacts-types';
import {
  cacheInstructionFile,
  loadInstructionsView,
  openCachedInstruction,
  syncInstructionsFromRemote,
} from './lib/instructions-service';
import type { InstructionListItem } from './lib/instructions-types';
import type { AppState } from './types';

export function createInitialState(session: Session | null): AppState {
  return {
    view: session ? 'home' : 'login',
    session,
    error: null,
    loading: false,
    instructions: [],
    instructionsLoading: false,
    downloadingId: null,
    artifacts: [],
    uploadingArtifactId: null,
    registeringInstructionId: null,
    notice: null,
  };
}

export function renderApp(root: HTMLElement, config: KivaConfig, state: AppState): void {
  const configured = isSupabaseConfigured(config);

  root.innerHTML = `
    <header class="brand">
      <img src="${import.meta.env.BASE_URL}icon.svg" width="40" height="40" alt="" />
      <div>
        <h1>Kiva</h1>
        <p class="tagline">Get instructions · work in your apps · upload results</p>
      </div>
    </header>
    ${!configured ? `<div class="alert warn" role="status">Supabase is not configured for this build. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (local: <code>kiva/.env</code>; GitHub Pages: repository secrets) and redeploy.</div>` : ''}
    ${state.notice ? `<div class="alert ok" role="status">${escapeHtml(state.notice)}</div>` : ''}
    ${state.error ? `<div class="alert error" role="alert">${escapeHtml(state.error)}</div>` : ''}
    ${state.view === 'login' ? renderLogin(state.loading) : renderHome(state)}
  `;

  if (state.view === 'login') {
    const form = root.querySelector<HTMLFormElement>('#login-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const email = String(fd.get('email') ?? '').trim();
      const password = String(fd.get('password') ?? '');
      void onLogin(config, email, password);
    });
  }

  if (state.view === 'home') {
    root.querySelector<HTMLButtonElement>('#refresh-instructions')?.addEventListener('click', () =>
      void onRefreshInstructions(config),
    );

    root.querySelectorAll<HTMLButtonElement>('[data-download-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.downloadId;
        const path = btn.dataset.storagePath;
        if (id && path) void onDownloadInstruction(config, id, path);
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-open-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.openId;
        if (id) void onOpenCached(id);
      });
    });

    root.querySelectorAll<HTMLInputElement>('[data-file-input]').forEach((input) => {
      input.addEventListener('change', () => {
        const instructionId = input.dataset.fileInput;
        const files = input.files ? [...input.files] : [];
        input.value = '';
        if (!instructionId || files.length === 0) return;
        void onRegisterArtifacts(instructionId, files);
      });
    });

    root.querySelectorAll<HTMLInputElement>('[data-artifact-visibility]').forEach((box) => {
      box.addEventListener('change', () => {
        const id = box.dataset.artifactVisibility;
        if (!id) return;
        void onArtifactVisibilityChange(id, box.checked ? 'community' : 'private');
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-upload-artifact]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.uploadArtifact;
        if (id) void onUploadArtifact(config, id);
      });
    });
  }

  root.querySelector<HTMLButtonElement>('#logout')?.addEventListener('click', () => void onLogout(config));
}

function renderLogin(loading: boolean): string {
  return `
    <section class="card" aria-labelledby="login-title">
      <h2 id="login-title">Sign in</h2>
      <p class="section-lead">Download team instructions, open them in your own software, upload your result files.</p>
      <form id="login-form">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required ${loading ? 'disabled' : ''} />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required ${loading ? 'disabled' : ''} />
        <button type="submit" ${loading ? 'disabled' : ''}>${loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  `;
}

function renderHome(state: AppState): string {
  const email = state.session?.user.email ?? 'Unknown';
  return `
    <section class="card card-session" aria-labelledby="home-title">
      <div class="instruction-head">
        <h2 id="home-title">Instructions</h2>
        <button type="button" class="secondary compact" id="logout">Sign out</button>
      </div>
      <p class="session-line">${escapeHtml(email)}</p>
      <button type="button" class="secondary compact" id="refresh-instructions" ${state.instructionsLoading ? 'disabled' : ''}>
        ${state.instructionsLoading ? 'Syncing…' : 'Sync list'}
      </button>
    </section>
    <section class="card" aria-labelledby="list-title">
      <h2 id="list-title" class="sr-only">Instruction list</h2>
      ${renderInstructionList(
        state.instructions,
        state.artifacts,
        state.instructionsLoading,
        state.downloadingId,
        state.registeringInstructionId,
        state.uploadingArtifactId,
      )}
    </section>
  `;
}

function pendingArtifacts(
  artifacts: LocalArtifactRecord[],
  instructionId: string,
): LocalArtifactRecord[] {
  return artifacts.filter(
    (a) => a.instructionId === instructionId && a.syncStatus !== 'published',
  );
}

function renderInstructionList(
  items: InstructionListItem[],
  artifacts: LocalArtifactRecord[],
  loading: boolean,
  downloadingId: string | null,
  registeringInstructionId: string | null,
  uploadingArtifactId: string | null,
): string {
  if (loading && items.length === 0) {
    return `<p class="muted">Loading…</p>`;
  }

  if (items.length === 0) {
    return `<p class="muted">No instructions yet. Tap <strong>Sync list</strong>.</p>`;
  }

  return `
    <ul class="instruction-list">
      ${items
        .map((item) => {
          const busy = downloadingId === item.id;
          const pending = pendingArtifacts(artifacts, item.id);
          return `
        <li class="instruction-item">
          <h3 class="instruction-title">${escapeHtml(item.title)}</h3>
          <div class="instruction-actions">
            <button
              type="button"
              class="secondary compact"
              data-download-id="${escapeHtml(item.id)}"
              data-storage-path="${escapeHtml(item.storagePath)}"
              ${busy ? 'disabled' : ''}
            >${busy ? '…' : item.isCached ? 'Re-download' : 'Download'}</button>
            <button
              type="button"
              class="secondary compact"
              data-open-id="${escapeHtml(item.id)}"
              ${item.isCached ? '' : 'disabled'}
            >Open file</button>
            <label class="file-attach-btn secondary compact">
              ${registeringInstructionId === item.id ? '…' : 'Add results'}
              <input
                type="file"
                multiple
                data-file-input="${escapeHtml(item.id)}"
                ${registeringInstructionId === item.id ? 'disabled' : ''}
              />
            </label>
          </div>
          ${renderPendingUploads(pending, uploadingArtifactId)}
        </li>`;
        })
        .join('')}
    </ul>
  `;
}

function renderPendingUploads(pending: LocalArtifactRecord[], uploadingId: string | null): string {
  if (pending.length === 0) return '';

  return `
    <ul class="pending-uploads">
      ${pending
        .map((a) => {
          const busy = uploadingId === a.id;
          return `
        <li class="pending-row">
          <span class="pending-name">${escapeHtml(a.fileName)}</span>
          <label class="checkbox compact-check">
            <input type="checkbox" data-artifact-visibility="${escapeHtml(a.id)}" ${a.visibility === 'community' ? 'checked' : ''} ${busy ? 'disabled' : ''} />
            Share
          </label>
          <button type="button" class="secondary compact" data-upload-artifact="${escapeHtml(a.id)}" ${busy ? 'disabled' : ''}>
            ${busy ? '…' : 'Upload'}
          </button>
        </li>
        ${a.errorMessage ? `<li class="pending-error">${escapeHtml(a.errorMessage)}</li>` : ''}`;
        })
        .join('')}
    </ul>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type AppController = {
  config: KivaConfig;
  root: HTMLElement;
  setState: (patch: Partial<AppState>) => void;
  getState: () => AppState;
};

let controller: AppController | null = null;

export function bindAppController(c: AppController): void {
  controller = c;
}

async function onLogin(config: KivaConfig, email: string, password: string): Promise<void> {
  if (!controller) return;
  controller.setState({ loading: true, error: null });
  renderApp(controller.root, controller.config, controller.getState());
  const result = await signInWithPassword(config, email, password);
  if (!result.ok) {
    controller.setState({ loading: false, error: result.message });
    renderApp(controller.root, controller.config, controller.getState());
    return;
  }
  const session = await getSession(config);
  applySession(session);
}

async function onLogout(config: KivaConfig): Promise<void> {
  await signOut(config);
}

export async function bootstrapHomeData(config: KivaConfig): Promise<void> {
  if (!controller) return;
  controller.setState({ instructionsLoading: true, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());

  try {
    const items = await loadInstructionsView(config);
    const artifacts = await refreshArtifactList();
    controller.setState({ instructions: items, artifacts, instructionsLoading: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load instructions.';
    controller.setState({ instructionsLoading: false, error: message });
  }
  renderApp(controller.root, controller.config, controller.getState());
}

async function onRefreshInstructions(config: KivaConfig): Promise<void> {
  if (!controller) return;
  controller.setState({ instructionsLoading: true, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());

  const result = await syncInstructionsFromRemote(config);
  const artifacts = await refreshArtifactList();
  controller.setState({
    instructions: result.items,
    artifacts,
    instructionsLoading: false,
    error: result.ok ? null : result.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

async function onDownloadInstruction(
  config: KivaConfig,
  instructionId: string,
  storagePath: string,
): Promise<void> {
  if (!controller) return;
  controller.setState({ downloadingId: instructionId, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());

  const result = await cacheInstructionFile(config, instructionId, storagePath);
  const items = await loadInstructionsView(config);
  const artifacts = await refreshArtifactList();
  controller.setState({
    downloadingId: null,
    instructions: items,
    artifacts,
    error: result.ok ? null : result.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

async function onRegisterArtifacts(instructionId: string, files: File[]): Promise<void> {
  if (!controller || files.length === 0) return;
  controller.setState({ registeringInstructionId: instructionId, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());

  try {
    for (const file of files) {
      await registerArtifactFromFile(instructionId, file, 'private');
    }
    const artifacts = await refreshArtifactList();
    controller.setState({
      artifacts,
      registeringInstructionId: null,
      error: null,
      notice: files.length === 1 ? `Added ${files[0].name}. Tap Upload when ready.` : `Added ${files.length} files. Tap Upload on each.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not add file.';
    controller.setState({ registeringInstructionId: null, error: message, notice: null });
  }
  renderApp(controller.root, controller.config, controller.getState());
}

async function onArtifactVisibilityChange(
  artifactId: string,
  visibility: 'private' | 'community',
): Promise<void> {
  if (!controller) return;
  const result = await setArtifactVisibility(artifactId, visibility);
  if (!result.ok) {
    controller.setState({ error: result.message });
  } else {
    const artifacts = await refreshArtifactList();
    controller.setState({ artifacts, error: null });
  }
  renderApp(controller.root, controller.config, controller.getState());
}

async function onUploadArtifact(config: KivaConfig, artifactId: string): Promise<void> {
  if (!controller) return;
  const userId = controller.getState().session?.user.id;
  if (!userId) {
    controller.setState({ error: 'Not signed in.' });
    renderApp(controller.root, controller.config, controller.getState());
    return;
  }

  const fileName =
    controller.getState().artifacts.find((a) => a.id === artifactId)?.fileName ?? 'File';

  controller.setState({ uploadingArtifactId: artifactId, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());

  const result = await uploadArtifact(config, artifactId, userId);
  const artifacts = await refreshArtifactList();
  controller.setState({
    uploadingArtifactId: null,
    artifacts,
    error: result.ok ? null : result.message,
    notice: result.ok ? `Uploaded ${fileName}.` : null,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

async function onOpenCached(instructionId: string): Promise<void> {
  if (!controller) return;
  const result = await openCachedInstruction(instructionId);
  if (!result.ok) {
    controller.setState({ error: result.message });
    renderApp(controller.root, controller.config, controller.getState());
  }
}

export function applySession(session: Session | null): void {
  if (!controller) return;
  const prev = controller.getState();
  const nextView = session ? 'home' : 'login';

  if (!session && !prev.session && prev.view === 'login' && nextView === 'login') {
    return;
  }

  controller.setState({
    session,
    view: nextView,
    loading: false,
    error: null,
    instructions: session ? prev.instructions : [],
    artifacts: session ? prev.artifacts : [],
    downloadingId: null,
    uploadingArtifactId: null,
    registeringInstructionId: null,
    notice: null,
  });
  renderApp(controller.root, controller.config, controller.getState());
  if (session) {
    void bootstrapHomeData(controller.config);
  }
}

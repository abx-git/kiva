import type { Session } from '@supabase/supabase-js';
import { signInWithPassword, signOut } from './auth/login';
import { getSession } from './lib/supabase';
import type { KivaConfig } from './config';
import { isSupabaseConfigured } from './config';
import {
  refreshArtifactList,
  registerArtifactFromFile,
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
        <p class="tagline">Instructions in. Results out. Work in your own apps.</p>
      </div>
    </header>
    ${!configured ? `<div class="alert warn" role="status">Supabase is not configured for this build. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (local: <code>kiva/.env</code>; GitHub Pages: repository secrets) and redeploy.</div>` : ''}
    ${state.notice ? `<div class="alert ok" role="status">${escapeHtml(state.notice)}</div>` : ''}
    ${state.error ? `<div class="alert error" role="alert">${escapeHtml(state.error)}</div>` : ''}
    ${state.view === 'login' ? renderLogin(configured, state.loading) : renderHome(state)}
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
    const refreshBtn = root.querySelector<HTMLButtonElement>('#refresh-instructions');
    refreshBtn?.addEventListener('click', () => void onRefreshInstructions(config));

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
        const file = input.files?.[0];
        input.value = '';
        if (!instructionId) return;
        if (!file) {
          controller?.setState({ notice: null });
          return;
        }
        const visibility =
          root.querySelector<HTMLInputElement>(`#vis-${instructionId}`)?.checked
            ? 'community'
            : 'private';
        void onRegisterArtifact(instructionId, file, visibility);
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-upload-artifact]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.uploadArtifact;
        if (id) void onUploadArtifact(config, id);
      });
    });
  }

  const logoutBtn = root.querySelector<HTMLButtonElement>('#logout');
  logoutBtn?.addEventListener('click', () => void onLogout(config));
}

function renderHowItWorks(): string {
  return `
    <section class="card how-it-works" aria-labelledby="how-title">
      <h2 id="how-title">How Kiva works</h2>
      <p>Kiva is not where you edit files. It lists instructions from the server, keeps a copy in this browser, and sends your finished result files back.</p>
      <ol class="step-list">
        <li><strong>Sync from server</strong> — update the instruction list from Supabase.</li>
        <li><strong>Save offline</strong> — store the instruction file inside Kiva on this device.</li>
        <li><strong>Export to device</strong> — download that copy so PDF, CAD, or other apps can open it.</li>
        <li>Work in your apps, then <strong>Attach result file</strong> and <strong>Send to server</strong>.</li>
      </ol>
    </section>
  `;
}

function renderLogin(_configured: boolean, loading: boolean): string {
  return `
    ${renderHowItWorks()}
    <section class="card" aria-labelledby="login-title">
      <h2 id="login-title">Sign in</h2>
      <p>Use your team account. Editing happens in your own software after you export an instruction.</p>
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
    ${renderHowItWorks()}
    <section class="card card-session" aria-labelledby="home-title">
      <h2 id="home-title">Instruction catalog</h2>
      <p class="session-line">Signed in as <span class="session-email">${escapeHtml(email)}</span></p>
      <p class="help-line" id="sync-help"><strong>Sync from server</strong> reloads the published instruction list from Supabase. It does not download files — use <strong>Save offline</strong> on each item.</p>
      <div class="toolbar">
        <button type="button" class="secondary compact" id="refresh-instructions" aria-describedby="sync-help" ${state.instructionsLoading ? 'disabled' : ''}>
          ${state.instructionsLoading ? 'Syncing…' : 'Sync from server'}
        </button>
        <button type="button" class="secondary compact" id="logout">Sign out</button>
      </div>
    </section>
    <section class="card" aria-labelledby="list-title">
      <h2 id="list-title">Published instructions</h2>
      <p class="section-lead">Each row is one instruction package on the server. Save it offline, export it to work elsewhere, then attach your result below.</p>
      ${renderInstructionList(state.instructions, state.instructionsLoading, state.downloadingId, state.registeringInstructionId)}
    </section>
    <section class="card" aria-labelledby="artifacts-title">
      <h2 id="artifacts-title">Your result files</h2>
      <p class="section-lead">Files you attached to an instruction. <strong>Send to server</strong> uploads them to the team storage.</p>
      ${renderArtifactList(state.artifacts, state.uploadingArtifactId, state.session?.user.id)}
    </section>
  `;
}

function renderInstructionList(
  items: InstructionListItem[],
  loading: boolean,
  downloadingId: string | null,
  registeringInstructionId: string | null,
): string {
  if (loading && items.length === 0) {
    return `<p class="muted">Loading instruction list…</p>`;
  }

  if (items.length === 0) {
    return `<p class="muted">No published instructions yet. Ask an admin to publish in Supabase, then tap <strong>Sync from server</strong>.</p>`;
  }

  return `
    <ul class="instruction-list">
      ${items
        .map((item) => {
          const busy = downloadingId === item.id;
          const size =
            item.sizeBytes != null ? formatBytes(item.sizeBytes) : null;
          return `
        <li class="instruction-item">
          <div class="instruction-head">
            <h3>${escapeHtml(item.title)}</h3>
            <span class="badge">${escapeHtml(item.version)}</span>
            ${item.isCached ? '<span class="badge badge-ok">Saved in app</span>' : '<span class="badge badge-muted">Server only</span>'}
          </div>
          ${item.description ? `<p class="instruction-desc">${escapeHtml(item.description)}</p>` : ''}
          <p class="instruction-meta">
            <span>${escapeHtml(item.fileName)}</span>
            ${size ? `<span>${size}</span>` : ''}
          </p>
          <div class="instruction-actions">
            <button
              type="button"
              class="secondary compact"
              data-download-id="${escapeHtml(item.id)}"
              data-storage-path="${escapeHtml(item.storagePath)}"
              ${busy ? 'disabled' : ''}
            >${busy ? 'Saving…' : item.isCached ? 'Update offline copy' : 'Save offline'}</button>
            <button
              type="button"
              class="secondary compact"
              data-open-id="${escapeHtml(item.id)}"
              ${item.isCached ? '' : 'disabled'}
              title="${item.isCached ? 'Download the saved copy to your device' : 'Save offline first'}"
            >Export to device</button>
          </div>
          <div class="register-row">
            <p class="share-hint"><strong>Share with team:</strong> leave off for a private server copy (only you). Turn on if colleagues should see this file after <strong>Send to server</strong>.</p>
            <label class="checkbox">
              <input type="checkbox" id="vis-${escapeHtml(item.id)}" />
              Share with team when uploaded
            </label>
            <label class="file-attach-btn secondary compact">
              ${registeringInstructionId === item.id ? 'Attaching…' : 'Attach result file'}
              <input
                type="file"
                id="file-${escapeHtml(item.id)}"
                data-file-input="${escapeHtml(item.id)}"
                ${registeringInstructionId === item.id ? 'disabled' : ''}
              />
            </label>
          </div>
        </li>`;
        })
        .join('')}
    </ul>
  `;
}

function renderArtifactList(
  artifacts: LocalArtifactRecord[],
  uploadingId: string | null,
  userId?: string,
): string {
  if (!userId) {
    return `<p class="muted">Not signed in.</p>`;
  }
  if (artifacts.length === 0) {
    return `<p class="muted">Nothing attached yet. After you finish work in another app, use <strong>Attach result file</strong> on the matching instruction.</p>`;
  }

  return `
    <ul class="instruction-list">
      ${artifacts
        .map((a) => {
          const busy = uploadingId === a.id;
          const statusLabel =
            a.syncStatus === 'published'
              ? 'On server'
              : a.syncStatus === 'local'
                ? 'On this device only'
                : a.syncStatus === 'uploading'
                  ? 'Sending…'
                  : 'Error';
          return `
        <li class="instruction-item">
          <div class="instruction-head">
            <h3>${escapeHtml(a.fileName)}</h3>
            <span class="badge">${escapeHtml(statusLabel)}</span>
          </div>
          <p class="instruction-meta">
            <span>SHA-256: ${escapeHtml(a.sha256.slice(0, 12))}…</span>
            <span>${formatBytes(a.sizeBytes)}</span>
          </p>
          ${a.errorMessage ? `<p class="instruction-desc">${escapeHtml(a.errorMessage)}</p>` : ''}
          <div class="instruction-actions">
            <button type="button" class="secondary compact" data-upload-artifact="${escapeHtml(a.id)}" ${a.syncStatus === 'published' || busy ? 'disabled' : ''}>
              ${busy ? 'Sending…' : 'Send to server'}
            </button>
          </div>
        </li>`;
        })
        .join('')}
    </ul>
  `;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

async function onRegisterArtifact(
  instructionId: string,
  file: File,
  visibility: 'private' | 'community',
): Promise<void> {
  if (!controller) return;
  controller.setState({
    registeringInstructionId: instructionId,
    error: null,
    notice: null,
  });
  renderApp(controller.root, controller.config, controller.getState());

  try {
    await registerArtifactFromFile(instructionId, file, visibility);
    const artifacts = await refreshArtifactList();
    const shareNote =
      visibility === 'community'
        ? 'It will be visible to teammates after Send to server.'
        : 'It stays private on the server until you share a community upload later.';
    controller.setState({
      artifacts,
      registeringInstructionId: null,
      error: null,
      notice: `Attached “${file.name}”. See Your result files below, then tap Send to server. ${shareNote}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not attach file.';
    controller.setState({
      registeringInstructionId: null,
      error: message,
      notice: null,
    });
  }
  renderApp(controller.root, controller.config, controller.getState());
  document.getElementById('artifacts-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onUploadArtifact(config: KivaConfig, artifactId: string): Promise<void> {
  if (!controller) return;
  const userId = controller.getState().session?.user.id;
  if (!userId) {
    controller.setState({ error: 'Not signed in.' });
    renderApp(controller.root, controller.config, controller.getState());
    return;
  }

  controller.setState({ uploadingArtifactId: artifactId, error: null });
  renderApp(controller.root, controller.config, controller.getState());

  const result = await uploadArtifact(config, artifactId, userId);
  const artifacts = await refreshArtifactList();
  controller.setState({
    uploadingArtifactId: null,
    artifacts,
    error: result.ok ? null : result.message,
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
  const nextUserId = session?.user.id ?? null;
  const prevUserId = prev.session?.user.id ?? null;

  // Supabase emits INITIAL_SESSION after startup with null session; don't wipe the login form.
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

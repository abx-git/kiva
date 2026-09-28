import type { Session } from '@supabase/supabase-js';
import { signInWithPassword, signOut } from './auth/login';
import { getSession } from './lib/supabase';
import type { KivaConfig } from './config';
import { isSupabaseConfigured } from './config';
import {
  deleteLocalDraft,
  downloadServerArtifactFile,
  listLocalDrafts,
  loadServerArtifacts,
  registerArtifactFromFile,
  removeServerArtifact,
  setServerArtifactVisibility,
  uploadArtifact,
  type ServerArtifactRow,
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
    drafts: [],
    serverArtifacts: [],
    artifactsLoading: false,
    actingArtifactId: null,
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
        <p class="tagline">Instructions · results · shared files</p>
      </div>
    </header>
    ${!configured ? `<div class="alert warn" role="status">Supabase is not configured for this build.</div>` : ''}
    ${state.notice ? `<div class="alert ok" role="status">${escapeHtml(state.notice)}</div>` : ''}
    ${state.error ? `<div class="alert error" role="alert">${escapeHtml(state.error)}</div>` : ''}
    ${state.view === 'login' ? renderLogin(state.loading) : renderHome(state)}
  `;

  bindEvents(root, config, state);
}

function bindEvents(root: HTMLElement, config: KivaConfig, state: AppState): void {
  if (state.view === 'login') {
    root.querySelector<HTMLFormElement>('#login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const fd = new FormData(form);
      void onLogin(config, String(fd.get('email') ?? '').trim(), String(fd.get('password') ?? ''));
    });
    return;
  }

  root.querySelector('#refresh-instructions')?.addEventListener('click', () =>
    void onRefreshInstructions(config),
  );
  root.querySelector('#reload-artifacts')?.addEventListener('click', () => void reloadArtifacts(config));

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
      if (instructionId && files.length) void onRegisterArtifacts(instructionId, files);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-upload-draft]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.uploadDraft;
      if (id) void onUploadDraft(config, id);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-delete-draft]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteDraft;
      if (id) void onDeleteDraft(id);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-move-shared]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.moveShared;
      if (id) void onMoveArtifact(config, id, 'community');
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-move-private]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.movePrivate;
      if (id) void onMoveArtifact(config, id, 'private');
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-delete-server]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteServer;
      if (id) void onDeleteServer(config, id);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-download-server]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.downloadServer;
      if (id) void onDownloadServer(config, id);
    });
  });

  root.querySelector('#logout')?.addEventListener('click', () => void onLogout(config));
}

function renderLogin(loading: boolean): string {
  return `
    <section class="card">
      <h2>Sign in</h2>
      <p class="section-lead">Team instructions and result files in two tables: <strong>Shared</strong> and <strong>Private</strong>.</p>
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
  const userId = state.session?.user.id ?? '';
  const shared = state.serverArtifacts.filter((a) => a.visibility === 'community');
  const privateServer = state.serverArtifacts.filter(
    (a) => a.visibility === 'private' && a.ownerId === userId,
  );

  return `
    <section class="card card-session">
      <div class="instruction-head">
        <h2>Instructions</h2>
        <button type="button" class="secondary compact" id="logout">Sign out</button>
      </div>
      <p class="session-line">${escapeHtml(state.session?.user.email ?? '')}</p>
      <button type="button" class="secondary compact" id="refresh-instructions" ${state.instructionsLoading ? 'disabled' : ''}>
        ${state.instructionsLoading ? 'Syncing…' : 'Sync list'}
      </button>
      ${renderInstructionList(state.instructions, state.instructionsLoading, state.downloadingId, state.registeringInstructionId)}
    </section>

    <section class="card">
      <div class="instruction-head">
        <h2>Shared</h2>
        <button type="button" class="secondary compact" id="reload-artifacts" ${state.artifactsLoading ? 'disabled' : ''}>
          ${state.artifactsLoading ? '…' : 'Refresh'}
        </button>
      </div>
      <p class="section-lead">Your shared files and teammates’ shared files. Use <strong>Move to private</strong> on your own rows.</p>
      ${renderServerTable(shared, state.instructions, userId, state.actingArtifactId)}
    </section>

    <section class="card">
      <h2>Private</h2>
      <p class="section-lead">Only you. Drafts waiting for upload appear here too. Use <strong>Move to shared</strong> after upload.</p>
      ${renderPrivateTable(privateServer, state.drafts, state.instructions, userId, state.actingArtifactId)}
    </section>
  `;
}

function renderInstructionList(
  items: InstructionListItem[],
  loading: boolean,
  downloadingId: string | null,
  registeringInstructionId: string | null,
): string {
  if (loading && items.length === 0) return `<p class="muted">Loading…</p>`;
  if (items.length === 0) return `<p class="muted">No instructions. Tap Sync list.</p>`;

  return `
    <ul class="instruction-list">
      ${items
        .map((item) => {
          const busy = downloadingId === item.id;
          return `
        <li class="instruction-item">
          <h3 class="instruction-title">${escapeHtml(item.title)}</h3>
          <div class="instruction-actions">
            <button type="button" class="secondary compact" data-download-id="${escapeHtml(item.id)}" data-storage-path="${escapeHtml(item.storagePath)}" ${busy ? 'disabled' : ''}>
              ${busy ? '…' : item.isCached ? 'Re-download' : 'Download'}
            </button>
            <button type="button" class="secondary compact" data-open-id="${escapeHtml(item.id)}" ${item.isCached ? '' : 'disabled'}>Open file</button>
            <label class="file-attach-btn secondary compact">
              ${registeringInstructionId === item.id ? '…' : 'Add results'}
              <input type="file" multiple data-file-input="${escapeHtml(item.id)}" ${registeringInstructionId === item.id ? 'disabled' : ''} />
            </label>
          </div>
        </li>`;
        })
        .join('')}
    </ul>
  `;
}

function instructionTitle(instructions: InstructionListItem[], instructionId: string): string {
  return instructions.find((i) => i.id === instructionId)?.title ?? '—';
}

function renderServerTable(
  rows: ServerArtifactRow[],
  instructions: InstructionListItem[],
  userId: string,
  actingId: string | null,
): string {
  if (rows.length === 0) {
    return `<p class="muted">No shared files yet.</p>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr><th>File</th><th>Instruction</th><th>Owner</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const own = row.ownerId === userId;
            const busy = actingId === row.id;
            return `
          <tr>
            <td>${escapeHtml(row.fileName)}</td>
            <td>${escapeHtml(instructionTitle(instructions, row.instructionId))}</td>
            <td>${own ? 'You' : 'Teammate'}</td>
            <td class="table-actions">
              <button type="button" class="secondary compact" data-download-server="${escapeHtml(row.id)}" ${busy ? 'disabled' : ''}>Download</button>
              ${own ? `<button type="button" class="secondary compact" data-move-private="${escapeHtml(row.id)}" ${busy ? 'disabled' : ''}>Move to private</button>` : ''}
              ${own ? `<button type="button" class="secondary compact" data-delete-server="${escapeHtml(row.id)}" ${busy ? 'disabled' : ''}>Delete</button>` : ''}
            </td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function renderPrivateTable(
  serverRows: ServerArtifactRow[],
  drafts: LocalArtifactRecord[],
  instructions: InstructionListItem[],
  userId: string,
  actingId: string | null,
): string {
  if (serverRows.length === 0 && drafts.length === 0) {
    return `<p class="muted">No private files. Add results on an instruction above.</p>`;
  }

  const draftRows = drafts
    .map((d) => {
      const busy = actingId === d.id;
      return `
      <tr>
        <td>${escapeHtml(d.fileName)}</td>
        <td>${escapeHtml(instructionTitle(instructions, d.instructionId))}</td>
        <td>Draft</td>
        <td class="table-actions">
          <button type="button" class="secondary compact" data-upload-draft="${escapeHtml(d.id)}" ${busy ? 'disabled' : ''}>Upload</button>
          <button type="button" class="secondary compact" data-delete-draft="${escapeHtml(d.id)}" ${busy ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  const serverHtml = serverRows
    .map((row) => {
      const busy = actingId === row.id;
      return `
      <tr>
        <td>${escapeHtml(row.fileName)}</td>
        <td>${escapeHtml(instructionTitle(instructions, row.instructionId))}</td>
        <td>You</td>
        <td class="table-actions">
          <button type="button" class="secondary compact" data-download-server="${escapeHtml(row.id)}" ${busy ? 'disabled' : ''}>Download</button>
          <button type="button" class="secondary compact" data-move-shared="${escapeHtml(row.id)}" ${busy ? 'disabled' : ''}>Move to shared</button>
          <button type="button" class="secondary compact" data-delete-server="${escapeHtml(row.id)}" ${busy ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  return `
    <table class="data-table">
      <thead>
        <tr><th>File</th><th>Instruction</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>${draftRows}${serverHtml}</tbody>
    </table>
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

async function reloadArtifacts(config: KivaConfig): Promise<void> {
  if (!controller) return;
  controller.setState({ artifactsLoading: true, error: null });
  renderApp(controller.root, controller.config, controller.getState());

  const drafts = await listLocalDrafts();
  const remote = await loadServerArtifacts(config);
  controller.setState({
    drafts,
    serverArtifacts: remote.ok ? remote.rows : controller.getState().serverArtifacts,
    artifactsLoading: false,
    error: remote.ok ? null : remote.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
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
  applySession(await getSession(config));
}

async function onLogout(config: KivaConfig): Promise<void> {
  await signOut(config);
}

export async function bootstrapHomeData(config: KivaConfig): Promise<void> {
  if (!controller) return;
  controller.setState({ instructionsLoading: true, artifactsLoading: true, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());

  try {
    const items = await loadInstructionsView(config);
    const drafts = await listLocalDrafts();
    const remote = await loadServerArtifacts(config);
    controller.setState({
      instructions: items,
      drafts,
      serverArtifacts: remote.ok ? remote.rows : [],
      instructionsLoading: false,
      artifactsLoading: false,
      error: remote.ok ? null : remote.message,
    });
  } catch (err) {
    controller.setState({
      instructionsLoading: false,
      artifactsLoading: false,
      error: err instanceof Error ? err.message : 'Load failed.',
    });
  }
  renderApp(controller.root, controller.config, controller.getState());
}

async function onRefreshInstructions(config: KivaConfig): Promise<void> {
  if (!controller) return;
  controller.setState({ instructionsLoading: true, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());
  const result = await syncInstructionsFromRemote(config);
  controller.setState({
    instructions: result.items,
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
  controller.setState({
    downloadingId: null,
    instructions: items,
    error: result.ok ? null : result.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

async function onRegisterArtifacts(instructionId: string, files: File[]): Promise<void> {
  if (!controller) return;
  controller.setState({ registeringInstructionId: instructionId, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());
  try {
    for (const file of files) {
      await registerArtifactFromFile(instructionId, file);
    }
    const drafts = await listLocalDrafts();
    controller.setState({
      drafts,
      registeringInstructionId: null,
      notice: `Added ${files.length} file(s) to Private (draft). Tap Upload when ready.`,
    });
  } catch (err) {
    controller.setState({
      registeringInstructionId: null,
      error: err instanceof Error ? err.message : 'Could not add file.',
    });
  }
  renderApp(controller.root, controller.config, controller.getState());
}

async function onUploadDraft(config: KivaConfig, draftId: string): Promise<void> {
  if (!controller) return;
  const userId = controller.getState().session?.user.id;
  if (!userId) return;
  controller.setState({ actingArtifactId: draftId, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());
  const result = await uploadArtifact(config, draftId, userId);
  await reloadArtifacts(config);
  controller.setState({
    actingArtifactId: null,
    notice: result.ok ? 'Uploaded to Private.' : null,
    error: result.ok ? null : result.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

async function onDeleteDraft(draftId: string): Promise<void> {
  if (!controller) return;
  controller.setState({ actingArtifactId: draftId });
  renderApp(controller.root, controller.config, controller.getState());
  await deleteLocalDraft(draftId);
  const drafts = await listLocalDrafts();
  controller.setState({ drafts, actingArtifactId: null, notice: 'Draft deleted.' });
  renderApp(controller.root, controller.config, controller.getState());
}

async function onMoveArtifact(
  config: KivaConfig,
  artifactId: string,
  visibility: 'private' | 'community',
): Promise<void> {
  if (!controller) return;
  controller.setState({ actingArtifactId: artifactId, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());
  const result = await setServerArtifactVisibility(config, artifactId, visibility);
  await reloadArtifacts(config);
  controller.setState({
    actingArtifactId: null,
    notice: result.ok
      ? visibility === 'community'
        ? 'Moved to Shared.'
        : 'Moved to Private.'
      : null,
    error: result.ok ? null : result.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

async function onDeleteServer(config: KivaConfig, artifactId: string): Promise<void> {
  if (!controller) return;
  const row = controller.getState().serverArtifacts.find((a) => a.id === artifactId);
  if (!row) return;
  controller.setState({ actingArtifactId: artifactId, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());
  const result = await removeServerArtifact(config, row);
  await reloadArtifacts(config);
  controller.setState({
    actingArtifactId: null,
    notice: result.ok ? 'Deleted.' : null,
    error: result.ok ? null : result.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

async function onDownloadServer(config: KivaConfig, artifactId: string): Promise<void> {
  if (!controller) return;
  const row = controller.getState().serverArtifacts.find((a) => a.id === artifactId);
  if (!row) return;
  controller.setState({ actingArtifactId: artifactId, error: null });
  renderApp(controller.root, controller.config, controller.getState());
  const result = await downloadServerArtifactFile(config, row);
  controller.setState({
    actingArtifactId: null,
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
  if (!session && !prev.session && prev.view === 'login') return;

  controller.setState({
    session,
    view: session ? 'home' : 'login',
    loading: false,
    error: null,
    instructions: session ? prev.instructions : [],
    drafts: session ? prev.drafts : [],
    serverArtifacts: session ? prev.serverArtifacts : [],
    downloadingId: null,
    actingArtifactId: null,
    registeringInstructionId: null,
    notice: null,
  });
  renderApp(controller.root, controller.config, controller.getState());
  if (session) void bootstrapHomeData(controller.config);
}

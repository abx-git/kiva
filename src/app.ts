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
} from './lib/instructions-service';
import type { InstructionListItem } from './lib/instructions-types';
import { renderAdminPage } from './admin-ui';
import {
  createInstructionAsAdmin,
  defaultStoragePath,
  deleteInstructionAsAdmin,
  listAllInstructionsForAdmin,
  updateInstructionAsAdmin,
} from './lib/instructions-admin';
import { fetchIsAdmin } from './lib/profile';
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
    isAdmin: false,
    adminRows: [],
    adminLoading: false,
    adminSaving: false,
    adminEditId: null,
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
    ${state.view === 'login' ? renderLogin(state.loading) : state.view === 'admin' ? renderAdminPage(state) : renderHome(state)}
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

  if (state.view === 'admin') {
    bindAdminEvents(root, config);
    return;
  }

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
  root.querySelector('#go-admin')?.addEventListener('click', () => void openAdmin(config));
}

function bindAdminEvents(root: HTMLElement, config: KivaConfig): void {
  root.querySelector('#admin-back')?.addEventListener('click', () => goHome());
  root.querySelector('#admin-new')?.addEventListener('click', () => {
    if (!controller) return;
    controller.setState({ adminEditId: 'new', error: null });
    renderApp(controller.root, controller.config, controller.getState());
  });
  root.querySelector('#admin-cancel')?.addEventListener('click', () => {
    if (!controller) return;
    controller.setState({ adminEditId: null });
    renderApp(controller.root, controller.config, controller.getState());
  });
  root.querySelectorAll<HTMLButtonElement>('[data-admin-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.adminEdit;
      if (id && controller) {
        controller.setState({ adminEditId: id, error: null });
        renderApp(controller.root, controller.config, controller.getState());
      }
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-admin-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.adminDelete;
      if (id) void onAdminDelete(config, id);
    });
  });
  root.querySelector<HTMLFormElement>('#admin-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    void onAdminFormSubmit(config, e.currentTarget as HTMLFormElement);
  });
  root.querySelector<HTMLInputElement>('#admin-slug')?.addEventListener('input', syncAdminStoragePathFromSlug);
  root.querySelector<HTMLInputElement>('#admin-file')?.addEventListener('change', syncAdminStoragePathFromFile);
  root.querySelector<HTMLInputElement>('#admin-storage-path')?.addEventListener('input', () => {
    const el = document.querySelector<HTMLInputElement>('#admin-storage-path');
    if (el) el.dataset.userEdited = '1';
  });
}

function renderLogin(loading: boolean): string {
  return `
    <section class="card">
      <h2>Sign in</h2>
      <p class="section-lead">Instructions, shared files, and private files.</p>
      <form id="login-form">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required ${loading ? 'disabled' : ''} />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required ${loading ? 'disabled' : ''} />
        <button type="submit" class="primary-block" ${loading ? 'disabled' : ''}>${loading ? 'Signing in…' : 'Sign in'}</button>
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
    <div class="layout-stack">
    <section class="card panel">
      <header class="panel-header">
        <div>
          <h2 class="panel-title">Instructions</h2>
          <p class="panel-sub">${escapeHtml(state.session?.user.email ?? '')}</p>
        </div>
        <div class="header-actions">
          ${state.isAdmin ? `<button type="button" class="action" id="go-admin">Admin</button><span class="action-sep">·</span>` : ''}
          <button type="button" class="action" id="logout">Sign out</button>
        </div>
      </header>
      ${renderInstructionList(state.instructions, state.instructionsLoading, state.downloadingId, state.registeringInstructionId)}
    </section>

    <section class="card panel">
      <header class="panel-header">
        <h2 class="panel-title">Shared</h2>
      </header>
      ${renderSharedList(shared, state.instructions, userId, state.actingArtifactId)}
    </section>

    <section class="card panel">
      <header class="panel-header">
        <h2 class="panel-title">Private</h2>
      </header>
      ${renderPrivateList(privateServer, state.drafts, state.instructions, state.actingArtifactId)}
    </section>
    </div>
  `;
}

function renderInstructionList(
  items: InstructionListItem[],
  loading: boolean,
  downloadingId: string | null,
  registeringInstructionId: string | null,
): string {
  if (loading && items.length === 0) return `<p class="muted">Loading…</p>`;
  if (items.length === 0) {
    return `<p class="muted">No instructions yet. Reload the app after new ones are published.</p>`;
  }

  return `
    <ul class="instruction-list">
      ${items
        .map((item) => {
          const busy = downloadingId === item.id;
          return `
        <li class="instruction-item">
          <div class="row-main">
            <h3 class="row-title">${escapeHtml(item.title)}</h3>
            <div class="action-group">
              ${actionButton(busy ? '…' : item.isCached ? 'Re-download' : 'Download', `data-download-id="${escapeHtml(item.id)}" data-storage-path="${escapeHtml(item.storagePath)}"`, busy)}
              ${actionSep()}
              ${actionButton('Open', `data-open-id="${escapeHtml(item.id)}"`, !item.isCached)}
              ${actionSep()}
              <label class="action action-file">
                ${registeringInstructionId === item.id ? '…' : 'Add results'}
                <input type="file" multiple data-file-input="${escapeHtml(item.id)}" ${registeringInstructionId === item.id ? 'disabled' : ''} />
              </label>
            </div>
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

function actionButton(label: string, attrs: string, disabled = false, danger = false): string {
  return `<button type="button" class="action${danger ? ' action-danger' : ''}" ${attrs}${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
}

function actionSep(): string {
  return `<span class="action-sep" aria-hidden="true">·</span>`;
}

function renderArtifactRow(
  fileName: string,
  meta: string,
  actionsHtml: string,
): string {
  return `
    <article class="artifact-row">
      <div class="row-main">
        <p class="row-title">${escapeHtml(fileName)}</p>
        <p class="row-meta">${escapeHtml(meta)}</p>
      </div>
      <div class="action-group">${actionsHtml}</div>
    </article>`;
}

function renderSharedList(
  rows: ServerArtifactRow[],
  instructions: InstructionListItem[],
  userId: string,
  actingId: string | null,
): string {
  if (rows.length === 0) return `<p class="empty">No shared files.</p>`;

  return `<div class="artifact-list">${rows
    .map((row) => {
      const own = row.ownerId === userId;
      const busy = actingId === row.id;
      const title = instructionTitle(instructions, row.instructionId);
      const meta = own ? `Instruction: ${title}` : `Instruction: ${title} · from teammate`;
      const actions = [
        actionButton('Download', `data-download-server="${escapeHtml(row.id)}"`, busy),
        own ? actionSep() : '',
        own ? actionButton('Make private', `data-move-private="${escapeHtml(row.id)}"`, busy) : '',
        own ? actionSep() : '',
        own ? actionButton('Delete', `data-delete-server="${escapeHtml(row.id)}"`, busy, true) : '',
      ].join('');
      return renderArtifactRow(row.fileName, meta, actions);
    })
    .join('')}</div>`;
}

function renderPrivateList(
  serverRows: ServerArtifactRow[],
  drafts: LocalArtifactRecord[],
  instructions: InstructionListItem[],
  actingId: string | null,
): string {
  if (serverRows.length === 0 && drafts.length === 0) {
    return `<p class="empty">No private files.</p>`;
  }

  const draftHtml = drafts
    .map((d) => {
      const busy = actingId === d.id;
      const meta = `Instruction: ${instructionTitle(instructions, d.instructionId)} · not uploaded yet`;
      const actions = [
        actionButton('Upload', `data-upload-draft="${escapeHtml(d.id)}"`, busy),
        actionSep(),
        actionButton('Delete', `data-delete-draft="${escapeHtml(d.id)}"`, busy, true),
      ].join('');
      return renderArtifactRow(d.fileName, meta, actions);
    })
    .join('');

  const serverHtml = serverRows
    .map((row) => {
      const busy = actingId === row.id;
      const meta = `Instruction: ${instructionTitle(instructions, row.instructionId)}`;
      const actions = [
        actionButton('Download', `data-download-server="${escapeHtml(row.id)}"`, busy),
        actionSep(),
        actionButton('Make shared', `data-move-shared="${escapeHtml(row.id)}"`, busy),
        actionSep(),
        actionButton('Delete', `data-delete-server="${escapeHtml(row.id)}"`, busy, true),
      ].join('');
      return renderArtifactRow(row.fileName, meta, actions);
    })
    .join('');

  return `<div class="artifact-list">${draftHtml}${serverHtml}</div>`;
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
  const userId = controller.getState().session?.user.id;
  controller.setState({ instructionsLoading: true, artifactsLoading: true, error: null, notice: null });
  renderApp(controller.root, controller.config, controller.getState());

  try {
    const isAdmin = userId ? await fetchIsAdmin(config, userId) : false;
    const items = await loadInstructionsView(config);
    const drafts = await listLocalDrafts();
    const remote = await loadServerArtifacts(config);
    controller.setState({
      isAdmin,
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
    isAdmin: session ? prev.isAdmin : false,
    adminRows: session ? prev.adminRows : [],
    adminEditId: null,
  });
  renderApp(controller.root, controller.config, controller.getState());
  if (session) void bootstrapHomeData(controller.config);
}

function goHome(): void {
  if (!controller) return;
  controller.setState({ view: 'home', adminEditId: null, error: null });
  renderApp(controller.root, controller.config, controller.getState());
}

async function openAdmin(config: KivaConfig): Promise<void> {
  if (!controller) return;
  controller.setState({ view: 'admin', adminLoading: true, adminEditId: null, error: null });
  renderApp(controller.root, controller.config, controller.getState());
  const result = await listAllInstructionsForAdmin(config);
  controller.setState({
    adminRows: result.ok ? result.rows : [],
    adminLoading: false,
    error: result.ok ? null : result.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

async function reloadAdminList(config: KivaConfig): Promise<void> {
  if (!controller) return;
  const result = await listAllInstructionsForAdmin(config);
  controller.setState({
    adminRows: result.ok ? result.rows : [],
    error: result.ok ? null : result.message,
  });
  renderApp(controller.root, controller.config, controller.getState());
}

function readAdminForm(form: HTMLFormElement): {
  slug: string;
  title: string;
  version: string;
  description: string;
  published: boolean;
  storagePath: string;
  file: File | null;
} {
  const fd = new FormData(form);
  return {
    slug: String(fd.get('slug') ?? '').trim(),
    title: String(fd.get('title') ?? '').trim(),
    version: String(fd.get('version') ?? '').trim(),
    description: String(fd.get('description') ?? '').trim(),
    published: fd.get('published') === 'on',
    storagePath: String(fd.get('storagePath') ?? '').trim(),
    file: (form.querySelector<HTMLInputElement>('[name="file"]')?.files?.[0] as File | undefined) ?? null,
  };
}

function syncAdminStoragePathFromSlug(): void {
  const slug = document.querySelector<HTMLInputElement>('#admin-slug')?.value ?? '';
  const fileInput = document.querySelector<HTMLInputElement>('#admin-file');
  const pathInput = document.querySelector<HTMLInputElement>('#admin-storage-path');
  if (!pathInput || pathInput.dataset.userEdited === '1') return;
  const name = fileInput?.files?.[0]?.name ?? 'file.pdf';
  pathInput.value = defaultStoragePath(slug, name);
}

function syncAdminStoragePathFromFile(): void {
  const slug = document.querySelector<HTMLInputElement>('#admin-slug')?.value ?? '';
  const fileInput = document.querySelector<HTMLInputElement>('#admin-file');
  const pathInput = document.querySelector<HTMLInputElement>('#admin-storage-path');
  if (!pathInput || !fileInput?.files?.[0]) return;
  if (pathInput.dataset.userEdited !== '1') {
    pathInput.value = defaultStoragePath(slug, fileInput.files[0].name);
  }
}

async function onAdminFormSubmit(config: KivaConfig, form: HTMLFormElement): Promise<void> {
  if (!controller) return;
  const userId = controller.getState().session?.user.id;
  if (!userId) return;

  const input = readAdminForm(form);
  const editId = controller.getState().adminEditId;
  controller.setState({ adminSaving: true, error: null });
  renderApp(controller.root, controller.config, controller.getState());

  const result =
    editId === 'new'
      ? await createInstructionAsAdmin(config, input, userId)
      : editId
        ? await updateInstructionAsAdmin(config, editId, input)
        : { ok: false as const, message: 'Nothing to save.' };

  controller.setState({ adminSaving: false });
  if (!result.ok) {
    controller.setState({ error: result.message });
    renderApp(controller.root, controller.config, controller.getState());
    return;
  }

  controller.setState({ adminEditId: null, notice: 'Instruction saved.' });
  await reloadAdminList(config);
  await bootstrapHomeData(config);
  renderApp(controller.root, controller.config, controller.getState());
}

async function onAdminDelete(config: KivaConfig, id: string): Promise<void> {
  if (!controller) return;
  const row = controller.getState().adminRows.find((r) => r.id === id);
  if (!row) return;
  if (!window.confirm(`Delete “${row.title}”?`)) return;

  controller.setState({ actingArtifactId: id, error: null });
  renderApp(controller.root, controller.config, controller.getState());
  const result = await deleteInstructionAsAdmin(config, row);
  controller.setState({ actingArtifactId: null });
  if (!result.ok) {
    controller.setState({ error: result.message });
  } else {
    controller.setState({ notice: 'Instruction deleted.' });
    await reloadAdminList(config);
    await bootstrapHomeData(config);
  }
  renderApp(controller.root, controller.config, controller.getState());
}

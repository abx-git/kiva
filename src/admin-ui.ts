import type { InstructionAdminRow } from './lib/instructions-admin';

export type AdminUiState = {
  adminRows: InstructionAdminRow[];
  adminLoading: boolean;
  adminSaving: boolean;
  adminEditId: string | null;
};

export function renderAdminPage(state: AdminUiState): string {
  const editing = state.adminEditId
    ? state.adminRows.find((r) => r.id === state.adminEditId)
    : null;
  const isNew = state.adminEditId === 'new';

  return `
    <div class="layout-stack">
      <section class="card panel">
        <header class="panel-header">
          <div>
            <h2 class="panel-title">Admin</h2>
            <p class="panel-sub">Manage instructions (requires <code>profiles.is_admin</code> in Supabase)</p>
          </div>
          <button type="button" class="action" id="admin-back">Back to app</button>
        </header>
      </section>

      <section class="card panel">
        <header class="panel-header">
          <h2 class="panel-title">${isNew ? 'New instruction' : editing ? 'Edit instruction' : 'Instructions'}</h2>
          ${!state.adminEditId ? `<button type="button" class="action" id="admin-new">Add instruction</button>` : ''}
        </header>
        ${state.adminEditId ? renderAdminForm(editing ?? undefined, isNew, state.adminSaving) : renderAdminList(state)}
      </section>
    </div>
  `;
}

function renderAdminList(state: AdminUiState): string {
  if (state.adminLoading) return `<p class="empty">Loading…</p>`;
  if (state.adminRows.length === 0) {
    return `<p class="empty">No instructions in the database yet.</p>`;
  }

  return `
    <div class="artifact-list admin-list">
      ${state.adminRows
        .map(
          (row) => `
        <article class="artifact-row">
          <div class="row-main">
            <p class="row-title">${escapeHtml(row.title)}</p>
            <p class="row-meta">${escapeHtml(row.slug)} · ${row.published ? 'Published' : 'Draft'} · ${escapeHtml(row.storagePath)}</p>
          </div>
          <div class="action-group">
            <button type="button" class="action" data-admin-edit="${escapeHtml(row.id)}">Edit</button>
            <span class="action-sep">·</span>
            <button type="button" class="action action-danger" data-admin-delete="${escapeHtml(row.id)}">Delete</button>
          </div>
        </article>`,
        )
        .join('')}
    </div>
  `;
}

function renderAdminForm(row: InstructionAdminRow | undefined, isNew: boolean, saving: boolean): string {
  const slug = row?.slug ?? '';
  const title = row?.title ?? '';
  const version = row?.version ?? '1.0.0';
  const description = row?.description ?? '';
  const storagePath = row?.storagePath ?? '';
  const published = row?.published ?? false;

  return `
    <form id="admin-form" class="admin-form">
      <label for="admin-slug">Slug (unique id)</label>
      <input id="admin-slug" name="slug" required value="${escapeHtml(slug)}" ${isNew ? '' : 'readonly'} />

      <label for="admin-title">Title</label>
      <input id="admin-title" name="title" required value="${escapeHtml(title)}" />

      <label for="admin-version">Version</label>
      <input id="admin-version" name="version" value="${escapeHtml(version)}" />

      <label for="admin-description">Description</label>
      <textarea id="admin-description" name="description" rows="2">${escapeHtml(description)}</textarea>

      <label for="admin-storage-path">Storage path</label>
      <input id="admin-storage-path" name="storagePath" required value="${escapeHtml(storagePath)}" />

      <label class="checkbox">
        <input type="checkbox" name="published" ${published ? 'checked' : ''} />
        Published (visible in app)
      </label>

      <label for="admin-file">${isNew ? 'Instruction file' : 'Replace file (optional)'}</label>
      <input id="admin-file" name="file" type="file" ${isNew ? 'required' : ''} />

      <div class="admin-form-actions">
        <button type="submit" class="primary-block" ${saving ? 'disabled' : ''}>${saving ? 'Saving…' : 'Save'}</button>
        <button type="button" class="action" id="admin-cancel">Cancel</button>
      </div>
    </form>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

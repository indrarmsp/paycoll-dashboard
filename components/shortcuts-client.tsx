"use client";

import { useEffect, useMemo, useState } from 'react';
import { Link2, LoaderCircle, Plus, Pen, Trash2, X } from 'lucide-react';
import { getDefaultShortcutStore, normalizeShortcutStore, normalizeShortcutUrl, SHORTCUT_STORAGE_KEY } from '../lib/shortcuts';
import type { ShortcutCategory, ShortcutItem, ShortcutStore } from '../lib/types';

type ShortcutFormState = {
  id: string;
  name: string;
  url: string;
  icon: string;
  categoryId: string;
};

const emptyShortcutForm: ShortcutFormState = {
  id: '',
  name: '',
  url: '',
  icon: '',
  categoryId: ''
};

function ShortcutLogo({ name, src }: { name: string; src: string }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return <span className="text-[clamp(1.5rem,7vw,2.4rem)] leading-none">🌐</span>;
  }

  return (
    <img
      src={src}
      alt={name}
      className="h-full w-full object-contain"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

export function ShortcutsClient() {
  const [mounted, setMounted] = useState(false);
  const [store, setStore] = useState<ShortcutStore>(getDefaultShortcutStore());
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [deleteShortcutModalOpen, setDeleteShortcutModalOpen] = useState(false);
  const [shortcutForm, setShortcutForm] = useState<ShortcutFormState>(emptyShortcutForm);
  const [categoryName, setCategoryName] = useState('');
  const [pendingDeleteShortcut, setPendingDeleteShortcut] = useState<ShortcutItem | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
      if (raw) {
        setStore(normalizeShortcutStore(JSON.parse(raw)));
      }
    } catch {
      setStore(getDefaultShortcutStore());
    } finally {
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(store));
  }, [mounted, store]);

  const groupedShortcuts = useMemo(() => {
    const grouped: Record<string, ShortcutItem[]> = {};
    store.categories.forEach((category) => {
      grouped[category.id] = [];
    });

    store.shortcuts.forEach((shortcut) => {
      if (!grouped[shortcut.categoryId]) {
        grouped[shortcut.categoryId] = [];
      }

      grouped[shortcut.categoryId].push(shortcut);
    });

    return grouped;
  }, [store.categories, store.shortcuts]);

  const hasVisibleShortcuts = store.categories.some((category) => (groupedShortcuts[category.id] || []).length > 0);

  function openShortcutModal(defaultCategoryId?: string) {
    const fallbackCategoryId = defaultCategoryId || store.categories[0]?.id || '';
    setShortcutForm({ ...emptyShortcutForm, categoryId: fallbackCategoryId });
    setShortcutModalOpen(true);
  }

  function editShortcut(id: string) {
    const shortcut = store.shortcuts.find((item) => item.id === id);
    if (!shortcut) {
      return;
    }

    setShortcutForm({
      id: shortcut.id,
      name: shortcut.name,
      url: shortcut.url,
      icon: shortcut.icon === '🌐' ? '' : shortcut.icon,
      categoryId: shortcut.categoryId
    });
    setShortcutModalOpen(true);
  }

  function closeShortcutModal() {
    setShortcutModalOpen(false);
  }

  function openCategoryModal() {
    setCategoryName('');
    setCategoryModalOpen(true);
  }

  function closeCategoryModal() {
    setCategoryModalOpen(false);
  }

  function closeDeleteShortcutModal() {
    setPendingDeleteShortcut(null);
    setDeleteShortcutModalOpen(false);
  }

  function saveCategory() {
    const name = categoryName.trim();
    if (!name) {
      return;
    }

    const exists = store.categories.some((category) => category.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      window.alert('Category name already exists.');
      return;
    }

    const nextCategory: ShortcutCategory = { id: `cat-${Date.now()}`, name };
    setStore((current) => ({
      ...current,
      categories: [...current.categories, nextCategory]
    }));
    setCategoryModalOpen(false);
  }

  function deleteCategory(categoryId: string) {
    if (store.categories.length <= 1) {
      window.alert('At least 1 category is required.');
      return;
    }

    const category = store.categories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    const confirmed = window.confirm(`Delete category "${category.name}"? All shortcuts inside this category will also be deleted.`);
    if (!confirmed) {
      return;
    }

    setStore((current) => ({
      ...current,
      categories: current.categories.filter((item) => item.id !== categoryId),
      shortcuts: current.shortcuts.filter((item) => item.categoryId !== categoryId)
    }));
  }

  function saveShortcut() {
    const name = shortcutForm.name.trim();
    const url = normalizeShortcutUrl(shortcutForm.url);
    const icon = shortcutForm.icon.trim();
    const categoryId = shortcutForm.categoryId;

    if (!name || !url || !categoryId) {
      return;
    }

    setStore((current) => {
      const nextShortcuts = [...current.shortcuts];

      if (shortcutForm.id) {
        const index = nextShortcuts.findIndex((item) => item.id === shortcutForm.id);
        if (index > -1) {
          nextShortcuts[index] = { ...nextShortcuts[index], id: shortcutForm.id, name, url, icon, categoryId };
        }
      } else {
        nextShortcuts.push({ id: String(Date.now()), name, url, icon, categoryId });
      }

      return {
        ...current,
        shortcuts: nextShortcuts
      };
    });

    setShortcutModalOpen(false);
  }

  function deleteShortcut(id: string) {
    const shortcut = store.shortcuts.find((item) => item.id === id);
    if (!shortcut) {
      return;
    }

    setPendingDeleteShortcut(shortcut);
    setDeleteShortcutModalOpen(true);
  }

  function confirmDeleteShortcut() {
    if (!pendingDeleteShortcut) {
      closeDeleteShortcutModal();
      return;
    }

    setStore((current) => ({
      ...current,
      shortcuts: current.shortcuts.filter((item) => item.id !== pendingDeleteShortcut.id)
    }));

    closeDeleteShortcutModal();
  }

  function renderShortcutCard(shortcut: ShortcutItem) {
    return (
      <div
        key={shortcut.id}
        data-shortcut-id={shortcut.id}
        data-shortcut-url={shortcut.url}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) {
            return;
          }

          window.open(shortcut.url, '_blank', 'noopener,noreferrer');
        }}
        className="pc-shortcut-card group relative flex cursor-pointer flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm"
      >
        <div className="pc-shortcut-card-actions absolute right-2 top-2 z-10 flex space-x-1">
          <button
            type="button"
            title="Edit"
            onClick={() => editShortcut(shortcut.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
          >
            <Pen className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={() => deleteShortcut(shortcut.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        <div
          className="pc-shortcut-card-icon mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-2"
          style={{ width: 'clamp(2.75rem, 18vw, 4rem)' }}
        >
          {shortcut.icon.startsWith('http') ? (
            <ShortcutLogo name={shortcut.name} src={shortcut.icon} />
          ) : (
            shortcut.icon ? (
              <span className="text-[clamp(1.4rem,6.5vw,2.1rem)] leading-none">{shortcut.icon}</span>
            ) : (
              <span className="text-[clamp(1.4rem,6.5vw,2.1rem)] leading-none">🌐</span>
            )
          )}
        </div>
        <h3 className="pc-shortcut-card-title w-full truncate px-1 text-sm font-semibold text-slate-800">{shortcut.name}</h3>
        <p className="pc-shortcut-card-url mt-1 w-full truncate px-1 text-xs text-slate-400">{shortcut.url.replace(/^https?:\/\//, '')}</p>
      </div>
    );
  }

  function renderCategorySection(category: ShortcutCategory) {
    const categoryShortcuts = groupedShortcuts[category.id] || [];

    return (
      <section
        key={category.id}
        data-category-id={category.id}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-800">{category.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openShortcutModal(category.id)}
              className="rounded-md bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100"
            >
              <Plus className="mr-1 inline-block h-3 w-3" />
              Shortcut
            </button>
            <button
              type="button"
              onClick={() => deleteCategory(category.id)}
              className="rounded-md bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
            >
              <Trash2 className="mr-1 inline-block h-3 w-3" />
              Delete
            </button>
          </div>
        </div>

        <div
          data-shortcut-list={category.id}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {categoryShortcuts.map((shortcut) => renderShortcutCard(shortcut))}
        </div>

        {!categoryShortcuts.length ? (
          <p className="px-1 text-sm italic text-slate-400">No shortcuts in this category yet.</p>
        ) : null}
      </section>
    );
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-brand-500" />
        Loading shortcuts...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={openCategoryModal}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900"
        >
          <Plus className="mr-1 inline-block h-4 w-4" />
          Add Category
        </button>
      </div>

      <div id="shortcutsGrid" className="space-y-5">
        {store.categories.map((category) => renderCategorySection(category))}
      </div>

      {!hasVisibleShortcuts ? (
        <div id="emptyShortcutsState" className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-slate-300">
            <Link2 className="h-10 w-10" />
          </div>
          <p className="text-lg font-medium text-slate-600">No shortcuts found</p>
          <p className="mt-2 max-w-sm text-center text-sm">Create quick access links to important resources, wikis, or external tools.</p>
        </div>
      ) : null}

      {shortcutModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeShortcutModal();
          }
        }}>
          <div id="shortcutModalContent" className="m-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-800">{shortcutForm.id ? 'Edit Shortcut' : 'Add Shortcut'}</h3>
              <button type="button" onClick={closeShortcutModal} className="rounded-full p-1 text-slate-400 transition-colors hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-white p-6">
              <form className="space-y-4" onSubmit={(event) => {
                event.preventDefault();
                saveShortcut();
              }}>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                  <input
                    type="text"
                    value={shortcutForm.name}
                    onChange={(event) => setShortcutForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    placeholder="e.g. HR Portal"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">URL</label>
                  <input
                    type="text"
                    value={shortcutForm.url}
                    onChange={(event) => setShortcutForm((current) => ({ ...current, url: event.target.value }))}
                    required
                    placeholder="https://example.com"
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Icon (Emoji or Image URL)</label>
                  <input
                    type="text"
                    value={shortcutForm.icon}
                    onChange={(event) => setShortcutForm((current) => ({ ...current, icon: event.target.value }))}
                    placeholder="🌐 or https://.../icon.png"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">Leave empty to use the default globe icon.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                  <select
                    value={shortcutForm.categoryId}
                    onChange={(event) => setShortcutForm((current) => ({ ...current, categoryId: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {store.categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-0 pt-4">
                  <button type="button" onClick={closeShortcutModal} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-teal-500/30 hover:bg-teal-700">
                    Save Shortcut
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {deleteShortcutModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeDeleteShortcutModal();
          }
        }}>
          <div id="deleteShortcutModalContent" className="m-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-800">Delete Shortcut</h3>
              <button type="button" onClick={closeDeleteShortcutModal} className="rounded-full p-1 text-slate-400 transition-colors hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-white p-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm text-slate-700">
                    Shortcut <span className="font-semibold text-slate-800">{pendingDeleteShortcut ? `"${pendingDeleteShortcut.name}"` : ''}</span> will be permanently deleted.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeDeleteShortcutModal} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                Cancel
              </button>
              <button type="button" onClick={confirmDeleteShortcut} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-rose-500/30 hover:bg-rose-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {categoryModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeCategoryModal();
          }
        }}>
          <div id="categoryModalContent" className="m-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-800">Add Category</h3>
              <button type="button" onClick={closeCategoryModal} className="rounded-full p-1 text-slate-400 transition-colors hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-white p-6">
              <label className="mb-1 block text-sm font-medium text-slate-700">Category Name</label>
              <input
                type="text"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Example: Finance Tools"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeCategoryModal} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                Cancel
              </button>
              <button type="button" onClick={saveCategory} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900">
                Save Category
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
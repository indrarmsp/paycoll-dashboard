import type { ShortcutCategory, ShortcutItem, ShortcutStore } from './types';

export const SHORTCUT_STORAGE_KEY = 'paycol_shortcuts';

export function normalizeShortcutUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getDefaultShortcuts(): ShortcutItem[] {
  return [
    { id: '1', name: 'Billing System', url: 'https://billing.example.com', icon: '💳', categoryId: 'cat-general' },
    { id: '2', name: 'Internal Wiki', url: 'https://wiki.example.com', icon: '📚', categoryId: 'cat-general' },
    { id: '3', name: 'HR Portal', url: 'https://hr.example.com', icon: '🏢', categoryId: 'cat-general' },
    { id: '4', name: 'Design Assets', url: 'https://figma.com', icon: '🎨', categoryId: 'cat-general' },
    { id: '5', name: 'Support Tickets', url: 'https://zendesk.com', icon: '🎫', categoryId: 'cat-general' }
  ];
}

export function getDefaultShortcutStore(): ShortcutStore {
  return {
    version: 2,
    categories: [{ id: 'cat-general', name: 'General' }],
    shortcuts: getDefaultShortcuts()
  };
}

export function normalizeShortcutStore(rawValue: unknown): ShortcutStore {
  const fallback = getDefaultShortcutStore();

  if (Array.isArray(rawValue)) {
    return {
      version: 2,
      categories: [{ id: 'cat-general', name: 'General' }],
      shortcuts: rawValue.map((item) => ({
        id: String((item as Partial<ShortcutItem>).id || Date.now()),
        name: String((item as Partial<ShortcutItem>).name || ''),
        url: String((item as Partial<ShortcutItem>).url || ''),
        icon: String((item as Partial<ShortcutItem>).icon || '🌐'),
        categoryId: 'cat-general'
      }))
    };
  }

  if (!rawValue || typeof rawValue !== 'object') {
    return fallback;
  }

  const raw = rawValue as Partial<ShortcutStore>;

  const categories = Array.isArray(raw.categories)
    ? raw.categories
        .map((category) => ({
          id: String(category.id || ''),
          name: String(category.name || '').trim()
        }))
        .filter((category) => category.id && category.name)
    : [];

  const normalizedCategories = categories.length ? categories : [{ id: 'cat-general', name: 'General' } satisfies ShortcutCategory];
  const validCategoryIds = new Set(normalizedCategories.map((category) => category.id));
  const fallbackCategoryId = normalizedCategories[0].id;

  const shortcuts = Array.isArray(raw.shortcuts)
    ? raw.shortcuts.map((item) => ({
        id: String(item.id || Date.now()),
        name: String(item.name || ''),
        url: String(item.url || ''),
        icon: String(item.icon || '🌐'),
        categoryId: validCategoryIds.has(String(item.categoryId || '')) ? String(item.categoryId) : fallbackCategoryId
      }))
    : [];

  return {
    version: 2,
    categories: normalizedCategories,
    shortcuts
  };
}
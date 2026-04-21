export type Role = 'admin' | 'ar';

export interface SessionData {
  role: Role;
  username: string;
  issuedAt: number;
  expiresAt: number;
  fingerprint: string;
}

export interface MainRow {
  snd: string;
  sndGroup: string;
  nama: string;
  alamat: string;
  datel: string;
  billCategory: string;
  saldo: number;
  umurCustomer: string;
  noHp: string;
  email: string;
  paidL11: string;
  _sndLower: string;
  _namaLower: string;
  _paidStatus: string;
}

export interface FilterOptions {
  datel: string[];
  billCategory: string[];
  umurCustomer: string[];
}

export interface DashboardStats {
  categoryStats: Record<string, number>;
  paidCount: number;
  unpaidCount: number;
}

export interface MainDashboardPayload {
  rows: MainRow[];
  filterOptions: FilterOptions;
  stats: DashboardStats;
}

export interface ARRow {
  idAgent: string;
  namaAgent: string;
  snd: string;
  namaPerusahaan: string;
  witel: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface ShortcutCategory {
  id: string;
  name: string;
}

export interface ShortcutItem {
  id: string;
  name: string;
  url: string;
  icon: string;
  categoryId: string;
}

export interface ShortcutStore {
  version: number;
  categories: ShortcutCategory[];
  shortcuts: ShortcutItem[];
}
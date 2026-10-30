export interface Candidate {
  schema?: string;
  id?: string;
  name: string;
  brightness_percent: number;
  key_colors: Record<string, string>;
  [key: string]: unknown;
}

export interface LayoutKey {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
}

export interface CatalogProfile {
  id: string;
  name: string;
  summary: string;
  parentId?: string | null;
  status: 'keeper' | 'accepted' | 'experiment' | 'reference';
  acceptance?: string;
  tell?: string;
  palette: string;
  preview?: string;
  tags?: string[];
}

export interface Catalog {
  schema: string;
  title?: string;
  defaultProfileId: string;
  profiles: CatalogProfile[];
  slots?: Array<{ slot: number; profileId: string; tell?: string }>;
  verifiedAt?: string;
  setupLabel?: string;
  compatibility?: string;
}

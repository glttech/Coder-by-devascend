/**
 * Pure filter-builder for GitHub PR list queries.
 * Returns a plain object suitable for use as a Prisma `where` clause.
 * Extracted as a pure function so it can be unit-tested without a DB connection.
 */

export type PRStateFilter = 'open' | 'merged' | 'closed' | 'all';
export type PRCIFilter = 'success' | 'failure' | 'pending' | 'neutral' | 'unknown' | 'all';

export interface PRFilters {
  state?: PRStateFilter;
  ci?: PRCIFilter;
  q?: string;
}

export interface PRWhereClause {
  state?: string;
  merged?: boolean;
  ciStatus?: string | null;
  title?: { contains: string; mode: 'insensitive' };
  AND?: PRWhereClause[];
}

export function buildPRFilters(filters: PRFilters): PRWhereClause {
  const clauses: PRWhereClause[] = [];

  // State filter
  if (filters.state && filters.state !== 'all') {
    switch (filters.state) {
      case 'open':
        clauses.push({ state: 'open' });
        break;
      case 'merged':
        clauses.push({ merged: true });
        break;
      case 'closed':
        clauses.push({ state: 'closed', merged: false });
        break;
    }
  }

  // CI status filter
  if (filters.ci && filters.ci !== 'all') {
    if (filters.ci === 'unknown') {
      clauses.push({ ciStatus: null });
    } else {
      clauses.push({ ciStatus: filters.ci });
    }
  }

  // Title text search
  const q = filters.q?.trim();
  if (q) {
    clauses.push({ title: { contains: q, mode: 'insensitive' } });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

/**
 * Normalize a raw search-param value into a typed enum value, with a fallback.
 */
export function normaliseStateFilter(raw: string | undefined): PRStateFilter {
  if (raw === 'open' || raw === 'merged' || raw === 'closed') return raw;
  return 'all';
}

export function normaliseCIFilter(raw: string | undefined): PRCIFilter {
  if (raw === 'success' || raw === 'failure' || raw === 'pending' || raw === 'neutral' || raw === 'unknown') return raw;
  return 'all';
}

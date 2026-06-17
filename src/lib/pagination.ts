/**
 * Cursor-based pagination helpers.
 */

const DEFAULT_TAKE = 25;
const MAX_TAKE = 100;

export interface PageParams {
  take: number;
  cursor?: string;
  order: 'asc' | 'desc';
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Parse pagination query parameters from a URLSearchParams instance.
 *
 * - `take`: number of items to fetch (default 25, max 100)
 * - `cursor`: opaque cursor string (optional)
 * - `order`: 'asc' or 'desc' (default 'desc')
 */
export function parsePageParams(searchParams: URLSearchParams): PageParams {
  const rawTake = searchParams.get('take');
  let take = rawTake !== null ? parseInt(rawTake, 10) : DEFAULT_TAKE;
  if (!Number.isFinite(take) || take < 1) take = DEFAULT_TAKE;
  if (take > MAX_TAKE) take = MAX_TAKE;

  const cursor = searchParams.get('cursor') ?? undefined;

  const rawOrder = searchParams.get('order');
  const order: 'asc' | 'desc' = rawOrder === 'asc' ? 'asc' : 'desc';

  return { take, cursor, order };
}

/**
 * Wrap a page of rows into a result object with a nextCursor.
 *
 * Pass `take` rows from the query (fetch take+1, then slice) so we can detect
 * whether a next page exists without an extra COUNT query.
 *
 * If `rows.length <= take` there is no next page and `nextCursor` is null.
 * Otherwise the last row's `id` becomes the cursor and it is excluded from
 * `items`.
 */
export function buildPageResult<T extends { id: string }>(
  rows: T[],
  take: number,
): PageResult<T> {
  if (rows.length > take) {
    const items = rows.slice(0, take);
    const nextCursor = rows[take].id;
    return { items, nextCursor };
  }
  return { items: rows, nextCursor: null };
}

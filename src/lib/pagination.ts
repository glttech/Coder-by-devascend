export interface PageParams {
  take: number;
  cursor?: string;
  order: 'asc' | 'desc';
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export function parsePageParams(searchParams: URLSearchParams): PageParams {
  const rawLimit = searchParams.get('limit');
  const take = Math.min(rawLimit ? parseInt(rawLimit, 10) || 25 : 25, 100);
  const cursor = searchParams.get('cursor') ?? undefined;
  const rawOrder = searchParams.get('order');
  const order: 'asc' | 'desc' = rawOrder === 'asc' ? 'asc' : 'desc';
  return { take, cursor, order };
}

export function buildPageResult<T extends { id: string }>(rows: T[], take: number): PageResult<T> {
  if (rows.length > take) {
    const items = rows.slice(0, take);
    const nextCursor = items[items.length - 1].id;
    return { items, nextCursor };
  }
  return { items: rows, nextCursor: null };
}

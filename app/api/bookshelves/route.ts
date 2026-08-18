import {
    APIResponseError,
    Client,
    DEFAULT_BASE_URL,
    extractDatabaseId,
  } from '@notionhq/client';
  import { NextResponse } from 'next/server';
  
  const NOTION_API_V1 = `${DEFAULT_BASE_URL}/v1`;
  
  type TextNode = { plain_text?: string };
  
  type NotionProperty = {
    type?: string;
    title?: TextNode[];
    rich_text?: TextNode[];
    files?: Array<{
      type?: 'file' | 'external';
      file?: { url?: string };
      external?: { url?: string };
    }>;
    status?: { name?: string } | null;
    select?: { name?: string } | null;
    multi_select?: Array<{ name?: string }>;
    relation?: Array<{ id: string }>;
    formula?: {
      type?: 'number' | 'string' | 'boolean' | 'date';
      number?: number | null;
      string?: string | null;
    };
    number?: number | null;
  };
  
  type QueryPageResult = {
    object?: string;
    id?: string;
    url?: string;
    created_time?: string;
    icon?: {
      type?: 'emoji' | 'external' | 'file' | 'custom_emoji' | 'icon';
      emoji?: string;
      external?: { url?: string };
      file?: { url?: string };
      custom_emoji?: { id?: string; name?: string; url?: string };
      icon?: { name?: string; color?: string };
    } | null;
    properties?: Record<string, NotionProperty>;
  };
  
  type RelationItem = {
    id: string;
    title: string | null;
    key: string | null;
  };
  
  function readText(nodes?: TextNode[]) {
    if (!Array.isArray(nodes)) return '';
    return nodes.map((node) => node?.plain_text ?? '').join('').trim();
  }
  
  function sanitizeEnvDatabaseId(raw: string | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().replace(/^["']|["']$/g, '').trim();
    const fromUrlOrUuid = extractDatabaseId(trimmed);
    if (fromUrlOrUuid) return fromUrlOrUuid;
  
    const compact = trimmed.replace(/-/g, '').replace(/\s/g, '');
    if (/^[a-f0-9]{32}$/i.test(compact)) return extractDatabaseId(compact);
  
    return null;
  }
  
  function sanitizeIntegrationToken(raw: string | undefined): string | null {
    if (!raw) return null;
    const token = raw.trim().replace(/^["']|["']$/g, '').trim();
    return token || null;
  }
  
  function normalizePropertyName(name: string) {
    return name.replace(/\s/g, '').toLowerCase();
  }
  
  function findProperty(properties: Record<string, NotionProperty>, candidates: string[]) {
    for (const key of candidates) {
      if (properties[key]) return properties[key];
    }
  
    const foundKey = Object.keys(properties).find((key) =>
      candidates.some((candidate) =>
        normalizePropertyName(key).includes(normalizePropertyName(candidate))
      )
    );
  
    return foundKey ? properties[foundKey] : undefined;
  }
  
  function propertyToText(property: NotionProperty | undefined) {
    if (!property) return null;
  
    if (property.type === 'title') return readText(property.title) || null;
    if (property.type === 'rich_text') return readText(property.rich_text) || null;
    if (property.type === 'status') return property.status?.name ?? null;
    if (property.type === 'select') return property.select?.name ?? null;
  
    if (property.type === 'multi_select') {
      const names = property.multi_select?.map((item) => item.name).filter(Boolean);
      return names?.join(', ') || null;
    }
  
    if (property.type === 'number' && typeof property.number === 'number') {
      return String(property.number);
    }
  
    if (property.type === 'formula') {
      const formula = property.formula;
  
      if (formula?.type === 'number' && typeof formula.number === 'number') {
        return String(formula.number);
      }
  
      if (formula?.type === 'string') {
        return formula.string ?? null;
      }
    }
  
    return null;
  }
  
  function parseProgressValue(progressText: string | null) {
    if (!progressText) return null;
  
    const matched = progressText.match(/-?\d+(\.\d+)?/);
    if (!matched) return null;
  
    const parsed = Number(matched[0]);
    if (Number.isNaN(parsed)) return null;
  
    const percent = parsed <= 1 ? parsed * 100 : parsed;
  
    if (percent < 0) return 0;
    if (percent > 100) return 100;
  
    return Math.round(percent);
  }
  
  function toCategoryKey(value: string | null | undefined) {
    if (!value) return null;
  
    const compact = value
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, '')
      .replace(/_/g, '-')
      .replace(/[()]/g, '')
      .toUpperCase();
  
    if (compact === 'BL' || compact === '비엘') return 'BL';
    if (compact === 'ROMANCE' || compact === '로맨스') return 'ROMANCE';
  
    if (
      compact === 'RO-FAN' ||
      compact === 'ROFAN' ||
      compact === '로판' ||
      compact === '로맨스판타지'
    ) {
      return 'RO-FAN';
    }
  
    if (
      compact === 'LITERATURE' ||
      compact === '일반' ||
      compact === '일반서적' ||
      compact === '문학'
    ) {
      return 'LITERATURE';
    }
  
    return null;
  }
  
  function toCategoryLabel(key: string | null | undefined) {
    if (key === 'BL') return 'BL';
    if (key === 'ROMANCE') return '로맨스';
    if (key === 'RO-FAN') return '로맨스판타지';
    if (key === 'LITERATURE') return '일반서적';
    return null;
  }
  
  function readTitleFromProperties(properties: Record<string, NotionProperty>) {
    const titleProp = findProperty(properties, ['제목', 'title', '이름', 'Name']);
  
    if (titleProp?.type === 'title') return readText(titleProp.title) || null;
    if (titleProp?.type === 'rich_text') return readText(titleProp.rich_text) || null;
  
    return null;
  }
  
  function getCoverUrl(properties: Record<string, NotionProperty>) {
    const coverProp = findProperty(properties, ['cover', '표지', '커버']);
  
    if (
      coverProp?.type !== 'files' ||
      !Array.isArray(coverProp.files) ||
      coverProp.files.length === 0
    ) {
      return null;
    }
  
    const first = coverProp.files[0];
  
    if (first?.type === 'file') return first.file?.url ?? null;
    if (first?.type === 'external') return first.external?.url ?? null;
  
    return null;
  }
  
  function getAuthor(properties: Record<string, NotionProperty>) {
    const authorProp = findProperty(properties, ['author', '저자']);
    if (authorProp?.type !== 'rich_text') return null;
    return readText(authorProp.rich_text) || null;
  }
  
  function getStatusName(properties: Record<string, NotionProperty>) {
    const statusProp = findProperty(properties, ['상태', 'status']);
    if (statusProp?.type !== 'status') return null;
    return statusProp.status?.name ?? null;
  }
  
  function getRatingText(properties: Record<string, NotionProperty>) {
    return propertyToText(findProperty(properties, ['평점', 'rating', '별점']));
  }
  
  function getPlatformText(properties: Record<string, NotionProperty>) {
    return propertyToText(findProperty(properties, ['플랫폼', 'platform']));
  }
  
  function getProgressText(properties: Record<string, NotionProperty>) {
    return propertyToText(findProperty(properties, ['진행상태', '진행률', 'progress']));
  }

  function getReviewText(
    properties: Record<string, NotionProperty>,
    candidates: string[]
  ) {
    return propertyToText(findProperty(properties, candidates));
  }

  function getPageIcon(page: QueryPageResult) {
    if (page.icon?.type === 'emoji') {
      return { type: 'emoji' as const, value: page.icon.emoji ?? '📖' };
    }

    if (page.icon?.type === 'external' && page.icon.external?.url) {
      return { type: 'image' as const, value: page.icon.external.url };
    }

    if (page.icon?.type === 'file' && page.icon.file?.url) {
      return { type: 'image' as const, value: page.icon.file.url };
    }

    if (page.icon?.type === 'custom_emoji' && page.icon.custom_emoji?.url) {
      return { type: 'image' as const, value: page.icon.custom_emoji.url };
    }

    return { type: 'emoji' as const, value: '📖' };
  }
  
  function parseRatingValue(ratingText: string | null) {
    if (!ratingText) return null;
  
    const yellowHeartCount = (ratingText.match(/💛/g) ?? []).length;
    const filledStarCount = (ratingText.match(/[★⭐]/g) ?? []).length;
    const numericMatch = ratingText.match(/\d+(\.\d+)?/);
    const numeric = numericMatch ? Number(numericMatch[0]) : NaN;
  
    if (yellowHeartCount > 0) return Math.min(5, yellowHeartCount);
    if (filledStarCount > 0) return Math.min(5, filledStarCount);
    if (!Number.isNaN(numeric) && numeric >= 0) return Math.min(5, numeric);
  
    return null;
  }
  
  function getCategoryRelationIds(properties: Record<string, NotionProperty>) {
    const categoryProp = findProperty(properties, ['카테고리']);
  
    if (categoryProp?.type !== 'relation' || !Array.isArray(categoryProp.relation)) {
      return [];
    }
  
    return categoryProp.relation.map((item) => item.id).filter(Boolean);
  }
  
  function extractCategoryTitleFromRelationPage(page: unknown) {
    const p = page as { properties?: Record<string, NotionProperty> };
    const props = p.properties ?? {};
  
    for (const key of Object.keys(props)) {
      const property = props[key];
  
      if (property?.type === 'title') {
        const title = readText(property.title);
        if (title) return title;
      }
    }
  
    return null;
  }
  
  async function resolveCategoryRelations(
    notion: Client,
    relationIds: string[]
  ): Promise<RelationItem[]> {
    const results: RelationItem[] = [];
  
    for (const id of relationIds) {
      try {
        const page = await notion.pages.retrieve({ page_id: id });
        const title = extractCategoryTitleFromRelationPage(page);
        const key = toCategoryKey(title);
  
        results.push({ id, title, key });
      } catch {
        results.push({ id, title: null, key: null });
      }
    }
  
    return results;
  }
  
  function logOutgoingQueryUrl(dataSourceId: string) {
    const peek = `${dataSourceId.slice(0, 4)}…${dataSourceId.slice(-4)}`;
    console.log(`[api/bookshelves] POST ${NOTION_API_V1}/data_sources/${peek}/query`);
  }
  
  async function queryAllPages(notion: Client, dataSourceId: string): Promise<QueryPageResult[]> {
    const rows: QueryPageResult[] = [];
    let cursor: string | undefined;
  
    for (;;) {
      logOutgoingQueryUrl(dataSourceId);
  
      const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        sorts: [
          {
            timestamp: 'created_time',
            direction: 'descending',
          },
        ],
        ...(cursor ? { start_cursor: cursor } : {}),
      });
  
      for (const row of response.results) {
        if ((row as QueryPageResult).object === 'page') {
          rows.push(row as QueryPageResult);
        }
      }
  
      if (!response.has_more || !response.next_cursor) break;
      cursor = response.next_cursor;
    }
  
    return rows;
  }
  
  async function resolveDataSourceId(notion: Client, rawId: string): Promise<string> {
    try {
      await notion.dataSources.query({ data_source_id: rawId, page_size: 1 });
      return rawId;
    } catch (error) {
      if (
        !APIResponseError.isAPIResponseError(error) ||
        !['object_not_found', 'validation_error', 'invalid_request_url'].includes(error.code)
      ) {
        throw error;
      }
    }
  
    const db = await notion.databases.retrieve({ database_id: rawId });
    const dsList = (db as { data_sources?: Array<{ id: string }> }).data_sources;
    const firstDataSourceId = dsList?.[0]?.id;
  
    if (!firstDataSourceId) {
      throw new Error('연결된 data_source를 찾을 수 없습니다.');
    }
  
    return firstDataSourceId;
  }
  
  export async function GET() {
    const notionToken = sanitizeIntegrationToken(process.env.NOTION_TOKEN);
    const dataSourceId = sanitizeEnvDatabaseId(process.env.NOTION_DATABASE_ID);
  
    if (!notionToken || !dataSourceId) {
      return NextResponse.json(
        { error: 'NOTION_TOKEN 또는 NOTION_DATABASE_ID가 없거나 올바르지 않습니다.' },
        { status: 500 }
      );
    }
  
    const notion = new Client({ auth: notionToken });
  
    try {
      const resolvedDataSourceId = await resolveDataSourceId(notion, dataSourceId);
      const pages = await queryAllPages(notion, resolvedDataSourceId);
  
      const items = await Promise.all(
        pages.map(async (page) => {
          const properties = page.properties ?? {};
  
          const relationIds = getCategoryRelationIds(properties);
          const relationCategories = await resolveCategoryRelations(notion, relationIds);
  
          const categoryKeys = Array.from(
            new Set(relationCategories.map((item) => item.key).filter(Boolean))
          ) as string[];
  
          const categoryLabels = categoryKeys
            .map((key) => toCategoryLabel(key))
            .filter(Boolean) as string[];
  
          const ratingText = getRatingText(properties);
          const progressText = getProgressText(properties);
  
          return {
            id: page.id ?? null,
            url: page.url ?? null,
            createdTime: page.created_time ?? null,
            icon: getPageIcon(page),
  
            title: readTitleFromProperties(properties),
            cover: getCoverUrl(properties),
            author: getAuthor(properties),
            status: getStatusName(properties),
  
            platform: getPlatformText(properties),
            progressText,
            progress: parseProgressValue(progressText),
  
            category: relationCategories,
            categoryRelationIds: relationIds,
            categoryRawTexts: relationCategories.map((item) => item.title).filter(Boolean),
            categoryKeys,
            categoryLabels,
            primaryCategoryKey: categoryKeys[0] ?? null,
            primaryCategoryLabel: categoryLabels[0] ?? null,
  
            ratingText,
            rating: parseRatingValue(ratingText),
            liked: getReviewText(properties, ['좋았던 점', '좋았던점', '장점']),
            disliked: getReviewText(properties, ['싫었던 점', '싫었던점', '아쉬웠던 점', '단점']),
          };
        })
      );
  
      return NextResponse.json({ items });
    } catch (error) {
      if (APIResponseError.isAPIResponseError(error)) {
        return NextResponse.json(
          { error: error.message, code: error.code, status: error.status },
          { status: 500 }
        );
      }
  
      const message =
        error instanceof Error ? error.message : '도서 데이터 조회 중 오류가 발생했습니다.';
  
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  
  export async function POST() {
    const notionToken = sanitizeIntegrationToken(process.env.NOTION_TOKEN);
    const dataSourceId = sanitizeEnvDatabaseId(process.env.NOTION_DATABASE_ID);
  
    if (!notionToken || !dataSourceId) {
      return NextResponse.json(
        { error: 'NOTION_TOKEN 또는 NOTION_DATABASE_ID가 없거나 올바르지 않습니다.' },
        { status: 500 }
      );
    }
  
    const notion = new Client({ auth: notionToken });
  
    try {
      const resolvedDataSourceId = await resolveDataSourceId(notion, dataSourceId);
  
      const created = await notion.pages.create({
        parent: { data_source_id: resolvedDataSourceId },
        properties: {
          제목: {
            title: [{ type: 'text', text: { content: '새로운 도서 기록' } }],
          },
          상태: {
            status: { name: '책바구니' },
          },
        },
      });
  
      return NextResponse.json(
        {
          ok: true,
          id: created.id,
          url: (created as { url?: string }).url ?? null,
        },
        { status: 201 }
      );
    } catch (error) {
      if (APIResponseError.isAPIResponseError(error)) {
        return NextResponse.json(
          { error: error.message, code: error.code, status: error.status },
          { status: 500 }
        );
      }
  
      const message =
        error instanceof Error ? error.message : '새 도서 페이지 생성 중 오류가 발생했습니다.';
  
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

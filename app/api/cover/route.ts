import { Client } from '@notionhq/client';
import { NextRequest } from 'next/server';

type FileProperty = {
  type?: string;
  files?: Array<{
    type?: 'file' | 'external';
    file?: { url?: string };
    external?: { url?: string };
  }>;
};

function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return [
      'amazonaws.com',
      'notion-static.com',
      'notionusercontent.com',
      'notion.site',
    ].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function findCoverUrl(properties: Record<string, FileProperty>) {
  const entry = Object.entries(properties).find(([name, property]) => {
    const normalized = name.trim().toLocaleLowerCase('ko-KR');
    return property?.type === 'files' && ['cover', '표지', '커버'].includes(normalized);
  });
  const file = entry?.[1]?.files?.[0];
  if (file?.type === 'file') return file.file?.url ?? null;
  if (file?.type === 'external') return file.external?.url ?? null;
  return null;
}

async function getFreshCoverUrl(pageId: string) {
  const token = process.env.NOTION_TOKEN?.trim().replace(/^["']|["']$/g, '');
  if (!token) return null;

  const notion = new Client({ auth: token });
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!('properties' in page)) return null;
  return findCoverUrl(page.properties as unknown as Record<string, FileProperty>);
}

async function fetchImage(url: string) {
  if (!isAllowedImageUrl(url)) return null;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;
  return response;
}

export async function GET(request: NextRequest) {
  const pageId = request.nextUrl.searchParams.get('pageId')?.trim();
  const source = request.nextUrl.searchParams.get('source')?.trim();
  if (!pageId) return new Response('Missing pageId', { status: 400 });

  let image = source ? await fetchImage(source).catch(() => null) : null;

  if (!image) {
    const freshSource = await getFreshCoverUrl(pageId).catch(() => null);
    image = freshSource ? await fetchImage(freshSource).catch(() => null) : null;
  }

  if (!image) return new Response('Cover not found', { status: 404 });

  return new Response(await image.arrayBuffer(), {
    headers: {
      'Content-Type': image.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=31536000',
    },
  });
}

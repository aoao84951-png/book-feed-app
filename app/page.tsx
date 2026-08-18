'use client';

import { useEffect, useMemo, useState } from 'react';
import { Grid3X3, List, RefreshCw, Search, Star, X } from 'lucide-react';

type FeedBook = {
  id?: string | null;
  url?: string | null;
  title: string | null;
  cover: string | null;
  author: string | null;
  status: string | null;
  categoryLabels?: string[];
  primaryCategoryLabel?: string | null;
  rating?: number | null;
  liked?: string | null;
  disliked?: string | null;
  icon?: { type: 'emoji' | 'image'; value: string } | null;
};

type ViewMode = 'grid' | 'feed';

function Stars({ rating, compact = false }: { rating?: number | null; compact?: boolean }) {
  const value = typeof rating === 'number' ? Math.max(0, Math.min(5, rating)) : 0;
  return (
    <span className={`stars ${compact ? 'compact' : ''}`} aria-label={rating == null ? '평점 없음' : `평점 ${value}점`}>
      {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < value ? 'filled' : ''}>★</i>)}
    </span>
  );
}

function FeedRating({ rating }: { rating?: number | null }) {
  const value = typeof rating === 'number' ? Math.max(0, Math.min(5, rating)) : null;
  return (
    <span className="feedRating" aria-label={value == null ? '평점 없음' : `평점 ${value}점`}>
      <Star size={17} strokeWidth={1.7} fill={value == null ? 'none' : 'currentColor'} />
      <b>{value == null ? '—' : value.toFixed(value % 1 === 0 ? 0 : 1)}</b>
      <small>/ 5</small>
    </span>
  );
}

const CUSTOM_HEART_TOKEN = /:(?:하트-연핑크|깨진-하트-블루-2):/g;

function getReviewNotes(text?: string | null) {
  return (text ?? '')
    .split(CUSTOM_HEART_TOKEN)
    .map((note) => note.trim())
    .filter(Boolean);
}

function ReviewNotes({
  text,
  kind,
}: {
  text?: string | null;
  kind: 'liked' | 'disliked';
}) {
  const notes = getReviewNotes(text);

  if (notes.length === 0) return null;

  const isLiked = kind === 'liked';
  const iconSrc = isLiked ? '/feed-heart-pink.gif' : '/feed-heart-broken-blue.gif';
  const label = isLiked ? '좋았던 점' : '싫었던 점';

  return (
    <section className={`reviewNotes ${kind}`} aria-label={label}>
      <span className="reviewLabel">
        {isLiked ? 'LOVE NOTES' : 'NOPE NOTES'}
        <small>{String(notes.length).padStart(2, '0')}</small>
      </span>
      {notes.map((note, index) => (
        <div className="reviewNote" key={`${kind}-${index}`}>
          <img src={iconSrc} alt="" aria-hidden="true" />
          <p>{note}</p>
        </div>
      ))}
    </section>
  );
}

function Cover({ book, fit = 'cover' }: { book: FeedBook; fit?: 'cover' | 'contain' }) {
  if (book.cover) {
    return (
      <img
        src={book.cover}
        alt={`${book.title ?? '책'} 표지`}
        style={{ width: '100%', height: '100%', objectFit: fit, objectPosition: 'center' }}
      />
    );
  }
  return <div className="noCover"><span>▦</span><b>NO COVER</b></div>;
}

export default function FeedPage() {
  const [books, setBooks] = useState<FeedBook[]>([]);
  const [view, setView] = useState<ViewMode>('grid');
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadFeed() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/bookshelves?ts=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? '피드를 불러오지 못했습니다.');
      setBooks(Array.isArray(data?.items) ? data.items : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '피드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFeed(); }, []);

  const visibleBooks = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ko-KR');
    if (!query) return books;
    return books.filter((book) => (book.title ?? '').toLocaleLowerCase('ko-KR').includes(query));
  }, [books, searchQuery]);

  useEffect(() => {
    if (view !== 'feed' || !pendingPostId) return;
    requestAnimationFrame(() => {
      document.getElementById(pendingPostId)?.scrollIntoView({ block: 'start' });
    });
  }, [view, pendingPostId]);

  function openPost(book: FeedBook, index: number) {
    setPendingPostId(`feed-post-${book.id ?? index}`);
    setView('feed');
  }

  return (
    <main className="feedPage">
      <nav className="viewTabs" aria-label="피드 보기 방식">
        <button type="button" className={`searchToggle ${searchOpen ? 'on' : ''}`} onClick={() => setSearchOpen((open) => !open)} aria-label="책 제목 검색">
          <Search size={15} />
        </button>
        <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="표지 모아보기">
          <Grid3X3 size={18} strokeWidth={1.8} /><span>모아보기</span>
        </button>
        <button type="button" className={view === 'feed' ? 'active' : ''} onClick={() => setView('feed')} aria-label="피드 보기">
          <List size={19} strokeWidth={1.8} /><span>피드</span>
        </button>
        <button type="button" className="refresh" onClick={loadFeed} disabled={loading} aria-label="새로고침">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </nav>

      {searchOpen && (
        <div className="searchBar">
          <Search size={14} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="책 제목 검색"
            aria-label="책 제목 검색"
            autoFocus
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="검색어 지우기"><X size={13} /></button>
          )}
        </div>
      )}

      {loading && books.length === 0 ? (
        <div className="state">피드를 불러오는 중...</div>
      ) : error ? (
        <div className="state error">{error}</div>
      ) : visibleBooks.length === 0 ? (
        <div className="state">{searchQuery.trim() ? '일치하는 책이 없습니다.' : '표시할 책이 없습니다.'}</div>
      ) : view === 'grid' ? (
        <section className="bookGrid">
          {visibleBooks.map((book, index) => (
            <button key={book.id ?? `${book.title}-${index}`} type="button" className="gridItem" onClick={() => openPost(book, index)}>
              <span className="gridCover"><Cover book={book} /></span>
              <span className="gridInfo"><b>{book.title ?? '제목 없음'}</b><Stars rating={book.rating} compact /></span>
            </button>
          ))}
        </section>
      ) : (
        <section className="feedList">
          {visibleBooks.map((book, index) => {
            const category = book.primaryCategoryLabel ?? book.categoryLabels?.[0] ?? '미분류';
            return (
              <article id={`feed-post-${book.id ?? index}`} className="post" key={book.id ?? `${book.title}-${index}`}>
                <header className="postHead">
                  <span className="identity">
                    <span className="profileCover">
                      {book.cover ? <img src={book.cover} alt="" /> : <span>📖</span>}
                    </span>
                    <b>{book.title ?? '제목 없음'}</b>
                    <small>{book.author ?? '저자 미상'}</small>
                  </span>
                  <span className="postNumber">{String(index + 1).padStart(2, '0')}</span>
                </header>
                <div className="feedCover">
                  {book.cover && <img className="coverBackdrop" src={book.cover} alt="" aria-hidden="true" />}
                  <span className="coverWash" aria-hidden="true" />
                  <div className="coverMain">
                    {book.cover ? (
                      <div
                        className="frontCover"
                        role="img"
                        aria-label={`${book.title ?? '책'} 표지`}
                        style={{ backgroundImage: `url("${book.cover.replace(/"/g, '%22')}")` }}
                      />
                    ) : (
                      <Cover book={book} fit="contain" />
                    )}
                  </div>
                </div>
                <div className="postBody">
                  <div className="summary">
                    <div className="metaActions">
                      <span className={`genreText ${category === 'BL' ? 'bl' : category === '로맨스' ? 'romance' : category === '로맨스판타지' ? 'rofan' : 'books'}`}>#{category}</span>
                      <span className={`statusText ${book.status === '완독' ? 'done' : book.status === '읽는 중' ? 'reading' : book.status === '읽기 전' ? 'before' : book.status === '하차' ? 'paused' : 'basket'}`}>#{book.status ?? '상태없음'}</span>
                    </div>
                    <FeedRating rating={book.rating} />
                  </div>
                  <div className="caption">
                    <ReviewNotes text={book.liked} kind="liked" />
                    <ReviewNotes text={book.disliked} kind="disliked" />
                  </div>
                  {book.url && <a href={book.url} target="_blank" rel="noreferrer">기록 자세히 보기 ↗</a>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <style jsx>{`
        :global(html), :global(body) { margin: 0; background: #fff; }
        * { box-sizing: border-box; }
        .feedPage { width: min(100%, 760px); min-height: 100dvh; margin: 0 auto; background: #fff; color: #4c4c48; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', sans-serif; }
        .viewTabs { position: sticky; top: 0; z-index: 20; height: 54px; display: flex; justify-content: center; gap: 34px; border-bottom: 1px solid #e5e5e2; background: rgba(255,255,255,.94); backdrop-filter: blur(12px); }
        .viewTabs button { position: relative; width: 74px; height: 54px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0; border: 0; background: transparent; color: #aaa9a4; cursor: pointer; }
        .viewTabs button span { font-size: 9px; font-weight: 750; }
        .viewTabs button.active { color: #555550; }
        .viewTabs button.active::after { content: ''; position: absolute; inset: auto 4px 0; height: 2px; border-radius: 2px 2px 0 0; background: #6f6f6a; }
        .viewTabs .refresh { position: absolute; right: 10px; width: 36px; }
        .viewTabs .searchToggle { position: absolute; left: 14px; width: 28px; height: 28px; top: 13px; border-radius: 50%; }
        .viewTabs .searchToggle.on { background: #f2f2ef; color: #666661; }
        .searchBar { position: sticky; top: 62px; z-index: 19; height: 34px; display: flex; align-items: center; gap: 7px; margin: 8px 14px; padding: 0 7px; border: 0; border-radius: 12px; background: rgba(244,244,242,.96); color: #999994; backdrop-filter: blur(12px); }
        .searchBar input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #4d4d49; font: inherit; font-size: 10px; font-weight: 650; }
        .searchBar input::placeholder { color: #b1b1ac; }
        .searchBar button { width: 24px; height: 24px; display: grid; place-items: center; flex: 0 0 auto; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,.72); color: #999994; cursor: pointer; }
        .spin { animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .state { min-height: 420px; display: grid; place-items: center; padding: 30px; color: #aaa9a4; font-size: 12px; font-weight: 700; text-align: center; }
        .state.error { color: #aa737b; }
        .bookGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; padding-top: 1px; background: #fff; }
        .gridItem { min-width: 0; padding: 0 0 11px; overflow: hidden; border: 0; background: #fff; text-align: left; cursor: pointer; }
        .gridCover { width: 100%; aspect-ratio: 2 / 3; display: block; overflow: hidden; border-radius: 9px; background: #f2f2ef; }
        .gridCover :global(img) { width: 100%; height: 100%; display: block; object-fit: cover; }
        .gridInfo { min-width: 0; display: block; padding: 8px 9px 0; }
        .gridInfo b { display: block; overflow: hidden; color: #4d4d49; font-size: 10px; font-weight: 750; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
        :global(.stars) { display: inline-flex; align-items: center; gap: 1px; }
        :global(.stars i) { color: #dfdfdc; font-family: Arial, sans-serif; font-size: 13px; font-style: normal; }
        :global(.stars i.filled) { color: #ffc94a; }
        :global(.stars.compact) { margin-top: 3px; }
        :global(.stars.compact i) { font-size: 9px; }
        :global(.noCover) { width: 100%; height: 100%; display: grid; place-content: center; justify-items: center; gap: 7px; color: #b8b8b3; }
        :global(.noCover span) { font-size: 24px; }
        :global(.noCover b) { font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: .16em; }
        .feedList { width: min(100%, 520px); margin: 0 auto; }
        .post { padding: 20px 0 26px; border-bottom: 1px solid #e8e8e5; }
        .post:last-child { border-bottom: 0; }
        .postHead { min-height: 42px; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; padding: 0 12px 11px; }
        .profileCover { width: 38px; min-width: 38px; max-width: 38px; height: 38px; min-height: 38px; max-height: 38px; aspect-ratio: 1; display: grid; place-items: center; flex: 0 0 38px; padding: 2px; overflow: hidden; border-radius: 999px; background: conic-gradient(from 205deg, #ffd33d, #ff8a22 20%, #ff334f 43%, #ef168c 68%, #a62cdb 84%, #ffd33d); }
        .profileCover img { width: 34px; min-width: 34px; max-width: 34px; height: 34px; min-height: 34px; max-height: 34px; display: block; border: 2px solid #fff; border-radius: 999px; object-fit: cover; object-position: center; }
        .profileCover > span { width: 100%; height: 100%; display: grid; place-items: center; border: 2px solid #fff; border-radius: 50%; background: #f2f2ef; font-size: 15px; line-height: 1; }
        .identity { min-width: 0; display: grid; grid-template-columns: 38px minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 9px; row-gap: 1px; align-items: center; }
        .profileCover { grid-row: 1 / 3; }
        .identity b { grid-column: 2; align-self: end; min-width: 0; overflow: hidden; color: #41413d; font-size: 12px; font-weight: 800; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
        .identity small { grid-column: 2; align-self: start; color: #777772; font-size: 9px; font-weight: 650; line-height: 1.25; }
        .postNumber { color: #aaa9a4; font-family: 'Courier New', monospace; font-size: 9px; }
        .feedCover { position: relative; isolation: isolate; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 16px; background: #f7f7f5; }
        .feedCover :global(.coverBackdrop) { position: absolute; z-index: -2; inset: -30px; width: calc(100% + 60px); height: calc(100% + 60px); display: block; object-fit: cover; filter: blur(28px) saturate(.78); opacity: .56; transform: scale(1.08); }
        .coverWash { position: absolute; z-index: -1; inset: 0; background: rgba(255,255,255,.42); }
        .coverMain { position: absolute; inset: 0; display: grid; place-items: center; }
        .frontCover { position: absolute; inset: 0; width: 100%; height: 100%; background-position: center; background-repeat: no-repeat; background-size: contain; filter: drop-shadow(0 5px 14px rgba(45,43,38,.1)); }
        .postBody { padding: 12px 13px 0; }
        .summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .metaActions { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
        .genreText { font-size: 10px; font-weight: 750; letter-spacing: -.01em; }
        .genreText.bl { color: #738eb2; }
        .genreText.romance { color: #c98298; }
        .genreText.rofan { color: #d6a928; }
        .genreText.books { color: #9580b4; }
        .statusText { font-size: 10px; font-weight: 750; letter-spacing: -.01em; }
        .statusText.basket { color: #92928d; }
        .statusText.before { color: #6f9d7e; }
        .statusText.reading { color: #d6a928; }
        .statusText.done { color: #6f8fb9; }
        .statusText.paused { color: #c9787e; }
        :global(.feedRating) { display: inline-flex; align-items: center; gap: 4px; color: #ffbd32; }
        :global(.feedRating b) { color: #5d5d58; font-size: 11px; font-weight: 800; }
        :global(.feedRating small) { margin-left: -2px; color: #aaa9a4; font-size: 8px; font-weight: 650; }
        .caption { display: grid; gap: 16px; margin-top: 14px; }
        :global(.reviewNotes) { display: grid; gap: 9px; }
        :global(.reviewLabel) { display: flex; align-items: baseline; gap: 6px; margin-left: 0; font-family: 'Courier New', ui-monospace, monospace; font-size: 8px; font-weight: 700; letter-spacing: .12em; }
        :global(.reviewNotes.liked .reviewLabel) { color: #cf849f; }
        :global(.reviewNotes.disliked .reviewLabel) { color: #789fc7; }
        :global(.reviewLabel small) { color: #b8b8b3; font-size: 7px; letter-spacing: .04em; }
        :global(.reviewNote) { display: grid; grid-template-columns: 16px minmax(0, 1fr); align-items: start; gap: 6px; }
        :global(.reviewNote img) { width: 14px; height: 14px; display: block; margin-top: 2px; object-fit: contain; }
        :global(.reviewNote p) { margin: 0; color: #555551; font-size: 10.5px; font-weight: 550; line-height: 1.62; white-space: pre-wrap; word-break: keep-all; }
        .postBody > a { display: block; margin-top: 12px; color: #aaa9a4; font-family: 'Courier New', monospace; font-size: 8.5px; font-weight: 700; text-align: right; text-decoration: none; }
        @media (max-width: 520px) {
          .viewTabs { gap: 12px; }
          .viewTabs button { width: 66px; }
          .viewTabs button span { display: none; }
          .gridInfo { padding-inline: 6px; }
          .gridInfo b { font-size: 9px; }
          .post { padding-top: 16px; }
          .feedCover { border-radius: 13px; }
        }
      `}</style>
    </main>
  );
}

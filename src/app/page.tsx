import { getPublishedPosts, getCategories, type BlogPost } from '@/lib/db';
import Link from 'next/link';
import NewsletterSignup from '@/components/newsletter-signup';

export const revalidate = 60;

const POSTS_PER_PAGE = 12;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function estimateReadTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, '').length;
  return Math.max(1, Math.ceil(words / 800));
}

function FeaturedCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/posts/${post.slug}`} className="group block">
      <article className="h-full rounded-2xl border border-[var(--color-border)] bg-white p-6 hover:border-[var(--color-primary)] hover:shadow-lg transition-all duration-200">
        <div className="flex items-center gap-2 mb-4">
          {post.category && (
            <span className="inline-block text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-1 rounded-full">
              {post.category}
            </span>
          )}
          <span className="text-xs text-[var(--color-text-muted)]">
            {estimateReadTime(post.content)}분
          </span>
        </div>
        <h3 className="text-lg font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors mb-3 line-clamp-2 leading-snug">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4 line-clamp-2">
            {post.excerpt}
          </p>
        )}
        <time className="text-xs text-[var(--color-text-muted)]">
          {formatDate(post.publishedAt ?? post.createdAt)}
        </time>
      </article>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="group">
      <Link href={`/posts/${post.slug}`} className="block py-5 border-b border-[var(--color-border)]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {post.category && (
                <span className="inline-block text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-full">
                  {post.category}
                </span>
              )}
              <span className="text-xs text-[var(--color-text-muted)]">
                {estimateReadTime(post.content)}분 읽기
              </span>
            </div>
            <h2 className="text-base font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors mb-1.5 leading-snug">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                {post.excerpt}
              </p>
            )}
          </div>
          <time className="text-xs text-[var(--color-text-muted)] whitespace-nowrap pt-1 shrink-0">
            {formatDate(post.publishedAt ?? post.createdAt)}
          </time>
        </div>
      </Link>
    </article>
  );
}

function Pagination({
  currentPage,
  totalPages,
  category,
}: {
  currentPage: number;
  totalPages: number;
  category: string | null;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (category) params.set('category', category);
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-12">
      {currentPage > 1 && (
        <Link
          href={buildHref(currentPage - 1)}
          className="px-3.5 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          이전
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          className={`px-3.5 py-2 text-sm rounded-lg transition-colors ${
            p === currentPage
              ? 'bg-[var(--color-primary)] text-white font-semibold'
              : 'border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
          }`}
        >
          {p}
        </Link>
      ))}
      {currentPage < totalPages && (
        <Link
          href={buildHref(currentPage + 1)}
          className="px-3.5 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          다음
        </Link>
      )}
    </nav>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const { page: pageStr, category } = await searchParams;
  const currentPage = Math.max(1, Number(pageStr) || 1);

  const [allPosts, categories] = await Promise.all([
    getPublishedPosts(),
    getCategories(),
  ]);

  // Filter by category if specified
  const filteredPosts = category
    ? allPosts.filter((p) => p.category === category)
    : allPosts;

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));

  // Featured posts (only on first page, no category filter)
  const showFeatured = safePage === 1 && !category;
  const featuredPosts = showFeatured ? allPosts.slice(0, 3) : [];

  // Paginated posts
  const startIdx = (safePage - 1) * POSTS_PER_PAGE + (showFeatured ? 3 : 0);
  const paginatedPosts = filteredPosts.slice(startIdx, startIdx + POSTS_PER_PAGE);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      {/* Hero Section */}
      <section className="mb-14 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 leading-tight">
          AI로 비즈니스를 혁신하세요
        </h1>
        <p className="text-base sm:text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
          소상공인과 중소기업을 위한 실전 AI 활용 가이드.
          최신 트렌드부터 업종별 자동화 플레이북까지, 매주 새로운 인사이트를 전달합니다.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">{allPosts.length}</span>개 글
          <span>&middot;</span>
          <span className="font-semibold text-[var(--color-text)]">{categories.length}</span>개 카테고리
        </div>
      </section>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <section className="mb-10">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                !category
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
              }`}
            >
              전체
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.category}
                href={`/?category=${encodeURIComponent(cat.category)}`}
                className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                  category === cat.category
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                }`}
              >
                {cat.category}
                <span className="ml-1 text-xs opacity-70">{cat.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Posts (first page only) */}
      {showFeatured && featuredPosts.length > 0 && (
        <section className="mb-14">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-5">
            최신 포스트
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {featuredPosts.map((post) => (
              <FeaturedCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Post List */}
      {paginatedPosts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)] text-lg mb-2">
            {category
              ? `"${category}" 카테고리에 포스트가 없습니다.`
              : '아직 게시된 포스트가 없습니다.'}
          </p>
          {category && (
            <Link href="/" className="text-sm text-[var(--color-primary)] hover:underline">
              전체 포스트 보기
            </Link>
          )}
        </div>
      ) : (
        <section>
          {!showFeatured && category && (
            <h2 className="text-lg font-bold mb-2">
              {category}
              <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                {filteredPosts.length}개 글
              </span>
            </h2>
          )}
          {paginatedPosts.length > 0 && (
            <div>
              {paginatedPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>
      )}

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        category={category ?? null}
      />

      {/* AI Directory Crosslink */}
      <section className="mt-14 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">AI 도구 디렉토리</h2>
        <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
          80+ AI 도구를 카테고리별로 비교해보세요. 가격, 사용법, 대안까지 한눈에.
        </p>
        <a
          href="https://ai-directory-seven.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          AI 도구 디렉토리 바로가기 &rarr;
        </a>
      </section>

      <NewsletterSignup />
    </div>
  );
}

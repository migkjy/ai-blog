import { getPostBySlug, getAllSlugs, getRelatedPosts } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import NewsletterSignup from '@/components/newsletter-signup';
import ShareButtons from '@/components/share-buttons';

export const revalidate = 60;

const BASE_URL = 'https://content-pipeline-sage.vercel.app';

type Params = { slug: string };

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const canonical = `${BASE_URL}/posts/${slug}`;

  return {
    title: post.title,
    description: post.meta_description ?? post.excerpt ?? undefined,
    alternates: {
      canonical,
    },
    openGraph: {
      title: post.title,
      description: post.meta_description ?? post.excerpt ?? undefined,
      type: 'article',
      locale: 'ko_KR',
      url: canonical,
      publishedTime: post.published_at ?? undefined,
      authors: [post.author],
      siteName: 'AI AppPro',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.meta_description ?? post.excerpt ?? undefined,
    },
  };
}

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
  const chars = content.replace(/<[^>]*>/g, '').length;
  return Math.max(1, Math.ceil(chars / 800));
}

function extractHeadings(content: string): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = [];
  const regex = /^(#{2,3})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^가-힣a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);
    headings.push({ id, text, level: match[1].length });
  }
  return headings;
}

function TableOfContents({ headings }: { headings: { id: string; text: string; level: number }[] }) {
  if (headings.length < 3) return null;

  return (
    <nav className="mb-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-tag-bg)] p-5">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">목차</h2>
      <ul className="space-y-1.5">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? 'ml-4' : ''}>
            <a
              href={`#${h.id}`}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const readTime = estimateReadTime(post.content);
  const headings = extractHeadings(post.content);
  const relatedPosts = post.category
    ? await getRelatedPosts(slug, post.category, 3)
    : [];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.meta_description ?? post.excerpt ?? undefined,
    "author": { "@type": "Organization", "name": "AI AppPro" },
    "publisher": { "@type": "Organization", "name": "AI AppPro" },
    "datePublished": post.published_at ?? post.created_at,
    "dateModified": post.updated_at ?? post.published_at ?? post.created_at,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${BASE_URL}/posts/${slug}`,
    },
    "wordCount": post.content.replace(/<[^>]*>/g, '').length,
  };

  // Add heading IDs to content for TOC links
  let processedContent = post.content;
  for (const h of headings) {
    const regex = new RegExp(`^(#{2,3})\\s+(${h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`, 'm');
    processedContent = processedContent.replace(
      regex,
      `$1 <a id="${h.id}"></a>$2`
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-8">
        <Link
          href="/"
          className="hover:text-[var(--color-primary)] transition-colors"
        >
          블로그
        </Link>
        {post.category && (
          <>
            <span>/</span>
            <Link
              href={`/?category=${encodeURIComponent(post.category)}`}
              className="hover:text-[var(--color-primary)] transition-colors"
            >
              {post.category}
            </Link>
          </>
        )}
      </div>

      {/* Header */}
      <header className="mb-8">
        {post.category && (
          <Link
            href={`/?category=${encodeURIComponent(post.category)}`}
            className="inline-block text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-1 rounded-full mb-3 hover:opacity-80 transition-opacity"
          >
            {post.category}
          </Link>
        )}
        <h1 className="text-3xl font-extrabold leading-tight mb-4">{post.title}</h1>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>{post.author}</span>
            <span>&middot;</span>
            <time>{formatDate(post.published_at ?? post.created_at)}</time>
            <span>&middot;</span>
            <span>{readTime}분 읽기</span>
          </div>
          <ShareButtons
            title={post.title}
            url={`${BASE_URL}/posts/${slug}`}
          />
        </div>
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-[var(--color-tag-bg)] text-[var(--color-text-muted)] px-2.5 py-0.5 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Table of Contents */}
      <TableOfContents headings={headings} />

      {/* Content */}
      <div className="prose prose-lg prose-slate max-w-none">
        <Markdown remarkPlugins={[remarkGfm]}>{processedContent}</Markdown>
      </div>

      {/* AI Directory Banner */}
      <div className="mt-10 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">이 글에서 소개된 도구가 궁금하신가요?</p>
          <p className="text-xs text-gray-600 mt-1">
            AI 도구 디렉토리에서 80+ AI 서비스의 가격, 기능, 대안을 비교해보세요.
          </p>
        </div>
        <a
          href="https://ai-directory-seven.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          도구 비교하기 &rarr;
        </a>
      </div>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold mb-4">관련 포스트</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedPosts.map((rp) => (
              <Link
                key={rp.id}
                href={`/posts/${rp.slug}`}
                className="group block rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
              >
                <h3 className="text-sm font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors mb-2 line-clamp-2">
                  {rp.title}
                </h3>
                {rp.excerpt && (
                  <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                    {rp.excerpt}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <NewsletterSignup />

      {/* Footer nav */}
      <footer className="mt-8 pt-8 border-t border-[var(--color-border)]">
        <Link
          href="/"
          className="text-[var(--color-primary)] hover:underline text-sm"
        >
          &larr; 다른 포스트 보기
        </Link>
      </footer>
    </article>
  );
}

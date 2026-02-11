import { getPostBySlug, getAllSlugs } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

export const revalidate = 60;

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

  return {
    title: post.title,
    description: post.meta_description ?? post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.meta_description ?? post.excerpt ?? undefined,
      type: 'article',
      locale: 'ko_KR',
      publishedTime: post.published_at ?? undefined,
      authors: [post.author],
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

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors mb-8"
      >
        &larr; 블로그 홈
      </Link>

      <header className="mb-10">
        {post.category && (
          <span className="inline-block text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded mb-3">
            {post.category}
          </span>
        )}
        <h1 className="text-3xl font-bold leading-tight mb-4">{post.title}</h1>
        <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
          <span>{post.author}</span>
          <span>{'|'}</span>
          <time>{formatDate(post.published_at ?? post.created_at)}</time>
        </div>
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-[var(--color-tag-bg)] text-[var(--color-text-muted)] px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="prose prose-lg prose-slate max-w-none">
        <Markdown remarkPlugins={[remarkGfm]}>{post.content}</Markdown>
      </div>

      <footer className="mt-16 pt-8 border-t border-[var(--color-border)]">
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

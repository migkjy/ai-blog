import { getPublishedPosts, type BlogPost } from '@/lib/db';
import Link from 'next/link';

export const revalidate = 60;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="py-8 border-b border-[var(--color-border)] last:border-b-0">
      <Link href={`/posts/${post.slug}`} className="group block">
        {post.category && (
          <span className="inline-block text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded mb-2">
            {post.category}
          </span>
        )}
        <h2 className="text-xl font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors mb-2">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mb-3">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span>{post.author}</span>
          <span>{'|'}</span>
          <time>{formatDate(post.published_at ?? post.created_at)}</time>
        </div>
      </Link>
    </article>
  );
}

export default async function HomePage() {
  const posts = await getPublishedPosts();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <section className="mb-12">
        <h1 className="text-3xl font-bold mb-3">AI 비즈니스 블로그</h1>
        <p className="text-[var(--color-text-muted)] text-lg">
          소상공인과 중소기업을 위한 실전 AI 활용 가이드
        </p>
      </section>

      {posts.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-center py-12">
          아직 게시된 포스트가 없습니다.
        </p>
      ) : (
        <section>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      )}
    </div>
  );
}

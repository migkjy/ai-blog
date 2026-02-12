export default function PostLoading() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex gap-2">
        <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-4 rounded bg-gray-100" />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
      </div>
      <header className="mb-8">
        <div className="mb-3 h-6 w-24 animate-pulse rounded-full bg-gray-200" />
        <div className="mb-4 h-10 w-full animate-pulse rounded bg-gray-200" />
        <div className="flex gap-3">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      </header>
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-gray-100" />
        ))}
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
      </div>
    </article>
  );
}

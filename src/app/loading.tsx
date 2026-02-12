export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12 text-center">
        <div className="mx-auto mb-4 h-10 w-72 animate-pulse rounded bg-gray-200" />
        <div className="mx-auto h-5 w-96 max-w-full animate-pulse rounded bg-gray-100" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse border-b border-gray-100 pb-6">
            <div className="mb-2 flex gap-2">
              <div className="h-5 w-16 rounded-full bg-gray-200" />
              <div className="h-5 w-12 rounded bg-gray-100" />
            </div>
            <div className="mb-2 h-5 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

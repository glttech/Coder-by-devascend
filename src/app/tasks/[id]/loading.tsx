export default function TaskDetailLoading() {
  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      {/* Title skeleton */}
      <div className="h-8 w-1/2 bg-gray-200 rounded-lg animate-pulse mb-4" />
      {/* Meta row skeleton */}
      <div className="flex gap-3 mb-6">
        <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
      </div>
      {/* Content skeletons */}
      <div className="flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

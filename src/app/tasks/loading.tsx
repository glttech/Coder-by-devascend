export default function TasksLoading() {
  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

export default function AuditLoading() {
  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-3">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-10 bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

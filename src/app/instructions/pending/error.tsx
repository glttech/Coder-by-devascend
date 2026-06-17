'use client';

export default function PendingInstructionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <h2 className="text-xl font-semibold text-red-600 mb-2">Failed to load pending instructions</h2>
      <p className="text-gray-500 mb-6">
        {error.message || 'An unexpected error occurred while fetching pending instructions.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

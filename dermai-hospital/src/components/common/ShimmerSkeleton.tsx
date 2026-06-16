export function ShimmerSkeleton({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div
      className={`shimmer-bg rounded animate-shimmer ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

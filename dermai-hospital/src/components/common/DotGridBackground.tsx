export function DotGridBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    >
      <svg className="w-full h-full opacity-40">
        <defs>
          <pattern
            id="dot-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="2"
              cy="2"
              r="1"
              fill="hsl(var(--border-subtle))"
              className="animate-dotPulse"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>
      <div
        className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full opacity-[0.04] blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

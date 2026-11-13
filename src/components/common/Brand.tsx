import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        className="size-9 shrink-0"
        aria-hidden="true"
      >
        <rect
          width="40"
          height="40"
          rx="12"
          fill="currentColor"
          className="text-primary"
        />
        <path
          d="M27 13a10 10 0 1 0 0 14"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="24" cy="20" r="3" fill="white" />
      </svg>
      <span className="text-2xl font-semibold tracking-[-0.06em]">
        core<span className="text-primary">.</span>
      </span>
    </div>
  );
}

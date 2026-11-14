import { cn } from "@/lib/utils";

export function Brand({
  className,
  markOnly = false,
}: {
  className?: string;
  markOnly?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 40 44"
        fill="none"
        className="size-9 shrink-0"
        aria-hidden="true"
      >
        <path
          d="m21 2 17 10-8 5-9-5-10 6v11l10 6 9-5 8 5-17 9L2 33V13Z"
          fill="currentColor"
          className="text-primary"
        />
        <path d="m2 13 9 5v11l10 6v9L2 33Z" fill="#bd2938" />
        <path d="m21 2 17 10-8 5-9-5-10 6-9-5Z" fill="#f04450" />
      </svg>
      {!markOnly && (
        <span className="text-2xl font-semibold tracking-[-0.06em]">
          Core<span className="text-primary">.</span>
        </span>
      )}
    </div>
  );
}

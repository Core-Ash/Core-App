import type { PreviewCommunity } from "@/features/community/preview/types";

export function CommunityEmblem({
  emblem,
}: {
  emblem: PreviewCommunity["emblem"];
}) {
  return (
    <svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true">
      {emblem === "gamepad" ? (
        <>
          <path d="M11 10c-5 0-8 16-8 21 0 3 4 4 7 1l5-6h10l5 6c3 3 7 2 7-1 0-5-3-21-8-21l-6 3h-6z" />
          <path
            d="M12 16v9m-4-4.5h8"
            fill="none"
            stroke="var(--community-icon-cutout)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="27" cy="18" r="1.8" fill="var(--community-icon-cutout)" />
          <circle cx="31" cy="23" r="1.8" fill="var(--community-icon-cutout)" />
        </>
      ) : emblem === "mountain" ? (
        <path d="m2 30 9-18 6 9 8-15 13 24h-8l-6-12-7 13-6-9-4 8z" />
      ) : (
        <path d="m2 20 10-8-4-4 10 2 5-5 1 7 12 5-8 2 7 7-10-3 5 10-7-3-3-10-6 3 3 4-7-1 4-7-7 3 3-6zm21-5 2 2 2-2z" />
      )}
    </svg>
  );
}

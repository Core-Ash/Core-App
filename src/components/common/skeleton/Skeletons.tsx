import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function FriendListSkeleton({ count = 6, showSearch = true }: { count?: number; showSearch?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading friends…"
      className="friends-list-section w-full animate-fade-in"
    >
      <span className="sr-only">Loading friends…</span>
      {showSearch && (
        <div className="friends-search">
          <Skeleton className="h-9 w-full bg-white/[0.05]" />
        </div>
      )}
      <div className="friends-list-heading">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width={110} height={14} />
          <Skeleton variant="text" width={32} height={14} />
        </div>
      </div>
      <div className="space-y-1 mt-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-transparent"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton variant="circular" width={36} height={36} />
              <div className="space-y-1.5">
                <Skeleton
                  variant="text"
                  width={i % 3 === 0 ? 120 : i % 3 === 1 ? 95 : 140}
                  height={14}
                />
                <Skeleton variant="text" width={60} height={11} className="bg-white/[0.04]" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" width={32} height={32} className="bg-white/[0.04]" />
              <Skeleton variant="circular" width={32} height={32} className="bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading conversations…"
      className="space-y-1 px-1.5 py-1"
    >
      <span className="sr-only">Loading conversations…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-2 py-2 rounded-md"
        >
          <Skeleton variant="circular" width={32} height={32} />
          <div className="space-y-1.5 flex-1 min-w-0">
            <Skeleton
              variant="text"
              width={i % 2 === 0 ? "70%" : "55%"}
              height={13}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChannelSidebarSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading channels…"
      className="p-3 space-y-6"
    >
      <span className="sr-only">Loading channels…</span>
      {/* Category 1 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <Skeleton variant="text" width={12} height={10} className="bg-white/[0.05]" />
          <Skeleton variant="text" width={75} height={11} className="bg-white/[0.08]" />
        </div>
        <div className="space-y-1 pl-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <Skeleton variant="text" width={14} height={14} className="bg-white/[0.05]" />
              <Skeleton
                variant="text"
                width={i % 2 === 0 ? 110 : 80}
                height={13}
                className="bg-white/[0.06]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Category 2 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <Skeleton variant="text" width={12} height={10} className="bg-white/[0.05]" />
          <Skeleton variant="text" width={90} height={11} className="bg-white/[0.08]" />
        </div>
        <div className="space-y-1 pl-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <Skeleton variant="text" width={14} height={14} className="bg-white/[0.05]" />
              <Skeleton
                variant="text"
                width={i % 2 === 0 ? 95 : 125}
                height={13}
                className="bg-white/[0.06]"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MemberSidebarSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading members…"
      className="space-y-4 p-2"
    >
      <span className="sr-only">Loading members…</span>
      <div className="space-y-2">
        <Skeleton variant="text" width={80} height={11} className="px-2 bg-white/[0.07]" />
        <div className="space-y-1">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
              <Skeleton variant="circular" width={32} height={32} />
              <div className="space-y-1 flex-1">
                <Skeleton
                  variant="text"
                  width={i % 3 === 0 ? 100 : i % 3 === 1 ? 75 : 120}
                  height={13}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatMessageSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading message history…"
      className="flex-1 p-4 space-y-6 overflow-hidden select-none"
    >
      <span className="sr-only">Loading message history…</span>
      {Array.from({ length: count }).map((_, i) => {
        const lineCount = (i % 3) + 1;
        return (
          <div key={i} className="flex gap-4 items-start">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <Skeleton variant="text" width={90} height={14} className="bg-white/[0.09]" />
                <Skeleton variant="text" width={45} height={11} className="bg-white/[0.04]" />
              </div>
              <div className="space-y-1.5 pt-0.5">
                <Skeleton
                  variant="text"
                  width={i % 2 === 0 ? "75%" : "85%"}
                  height={13}
                  className="bg-white/[0.06]"
                />
                {lineCount > 1 && (
                  <Skeleton
                    variant="text"
                    width={i % 2 === 0 ? "50%" : "65%"}
                    height={13}
                    className="bg-white/[0.05]"
                  />
                )}
                {lineCount > 2 && (
                  <Skeleton
                    variant="text"
                    width="40%"
                    height={13}
                    className="bg-white/[0.04]"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UserProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading profile…"
      className="w-full select-none"
    >
      <span className="sr-only">Loading profile…</span>
      {/* Banner */}
      <Skeleton className="h-20 w-full rounded-t-xl bg-white/[0.07]" />
      
      {/* Overlapping Avatar Circle */}
      <div className="px-4 relative pb-4">
        <div className="-mt-10 mb-3 inline-block rounded-full p-1 bg-background">
          <Skeleton variant="circular" width={72} height={72} />
        </div>
        
        {/* Name and Handle */}
        <div className="space-y-1.5 mb-4">
          <Skeleton variant="text" width={130} height={18} className="bg-white/[0.09]" />
          <Skeleton variant="text" width={80} height={13} className="bg-white/[0.05]" />
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06] my-3" />

        {/* Roles Section */}
        <div className="space-y-2">
          <Skeleton variant="text" width={50} height={11} className="bg-white/[0.06]" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton variant="rounded" width={65} height={22} className="rounded-md bg-white/[0.06]" />
            <Skeleton variant="rounded" width={80} height={22} className="rounded-md bg-white/[0.06]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemberTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading members…"
      className="w-full"
    >
      <span className="sr-only">Loading members…</span>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border/80 bg-neutral-900/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="py-3 px-4">Member</th>
            <th className="py-3 px-4">Roles</th>
            <th className="py-3 px-4">Joined</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40 text-sm">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="hover:bg-surface-hover/30 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" width={32} height={32} />
                  <div className="space-y-1.5">
                    <Skeleton
                      variant="text"
                      width={i % 2 === 0 ? 110 : 85}
                      height={14}
                    />
                    <Skeleton variant="text" width={65} height={11} className="bg-white/[0.04]" />
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <Skeleton variant="rounded" width={60} height={20} className="rounded bg-white/[0.06]" />
                  {i % 2 === 0 && (
                    <Skeleton variant="rounded" width={50} height={20} className="rounded bg-white/[0.05]" />
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <Skeleton variant="text" width={80} height={13} className="bg-white/[0.05]" />
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Skeleton variant="circular" width={28} height={28} className="bg-white/[0.04]" />
                  <Skeleton variant="circular" width={28} height={28} className="bg-white/[0.04]" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoleListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading roles…"
      className="space-y-1"
    >
      <span className="sr-only">Loading roles…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-4 py-3 border-b border-border/40"
        >
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" width={12} height={12} className="bg-white/[0.08]" />
            <Skeleton
              variant="text"
              width={i % 2 === 0 ? 110 : 80}
              height={14}
            />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton variant="text" width={24} height={13} className="bg-white/[0.05]" />
            <Skeleton variant="circular" width={28} height={28} className="bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}


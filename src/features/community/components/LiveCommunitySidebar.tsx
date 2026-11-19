import { useState, useRef, useMemo } from "react";
import { CalendarDays, Hash, Plus, Volume2 } from "lucide-react";
import { Link } from "react-router";
import { ApiNotice } from "@/components/common/ApiNotice";
import { ChannelSidebarSkeleton } from "@/components/common/skeleton/Skeletons";
import { Tooltip } from "@/components/ui/tooltip";
import { CreateChannelDialog } from "@/features/community/components/CreateResourceDialog";
import { ChannelCategory as ChannelCategorySection } from "@/features/community/components/ChannelCategory";
import { ServerDropdown } from "@/features/community/components/ServerDropdown";
import { InviteDialog } from "@/features/invites/InviteDialog";
import { useCurrentUser } from "@/features/community/api/hooks";
import { useInvitePermissions } from "@/features/invites/api";
import {
  useCategories,
  useReorderCategories,
  useReorderChannels,
  useSetCommunityPreferences,
  useSetCategoryCollapse,
  useSetCategoryMute,
} from "@/features/community/categories/api";
import { SidebarContextMenu } from "@/features/community/categories/SidebarContextMenu";
import { CategoryContextMenu } from "@/features/community/categories/CategoryContextMenu";
import {
  CreateCategoryDialog,
  EditCategoryDialog,
  DeleteCategoryDialog,
} from "@/features/community/categories/CategoryDialogs";
import type { ContextMenuPosition } from "@/features/community/categories/types";
import {
  communityHref,
  useCommunitySelection,
} from "@/features/community/api/use-community-selection";
import type { Channel, ChannelCategory } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function LiveCommunitySidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { community, communities, channels, channel, channelItems, view } =
    useCommunitySelection();
  const permissions = useInvitePermissions(community?.id ?? "");
  const profile = useCurrentUser();
  const owner = Boolean(
    community && profile.isSuccess && community.owner_id === profile.data.id,
  );
  const canManage =
    owner || Boolean(permissions.isSuccess && permissions.data.manage_channels);

  const categoriesQuery = useCategories(community?.id);
  const categories = useMemo(
    () => categoriesQuery.data?.items ?? [],
    [categoriesQuery.data?.items],
  );
  const hideMuted = Boolean(categoriesQuery.data?.hide_muted_channels);

  const reorderCategories = useReorderCategories(community?.id);
  const reorderChannels = useReorderChannels(community?.id);
  const setPreferences = useSetCommunityPreferences(community?.id);
  const setCategoryCollapse = useSetCategoryCollapse(undefined, community?.id);
  const setCategoryMute = useSetCategoryMute(undefined, community?.id);

  // Dialog states
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState<string | undefined>(undefined);
  const [targetKind, setTargetKind] = useState<"text" | "voice">("text");
  const createChannelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ChannelCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ChannelCategory | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Context menu states
  const [sidebarMenuPos, setSidebarMenuPos] = useState<ContextMenuPosition | null>(null);
  const [categoryMenu, setCategoryMenu] = useState<{
    category: ChannelCategory;
    position: ContextMenuPosition;
  } | null>(null);

  // Collapse states per category (persisted in local storage and backend)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const effectiveCollapsedMap = useMemo(() => {
    if (!community) return {};
    const map: Record<string, boolean> = {};
    for (const cat of categories) {
      if (cat.id in collapsedMap) {
        map[cat.id] = collapsedMap[cat.id]!;
      } else {
        const stored = localStorage.getItem(`core:category-collapsed:${community.id}:${cat.id}`);
        map[cat.id] = stored !== null ? stored === "true" : cat.is_collapsed;
      }
    }
    return map;
  }, [community, categories, collapsedMap]);

  function handleToggleCollapse(categoryId: string) {
    if (!community?.id) return;
    const current = Boolean(effectiveCollapsedMap[categoryId]);
    const next = !current;
    localStorage.setItem(
      `core:category-collapsed:${community.id}:${categoryId}`,
      String(next),
    );
    void setCategoryCollapse.mutateAsync(next);
    setCollapsedMap((prev) => ({ ...prev, [categoryId]: next }));
  }

  // Drag and drop states
  const [dragItem, setDragItem] = useState<{
    type: "channel" | "category";
    id: string;
    sourceCategoryId?: string | null;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    type: "channel" | "category";
    id: string;
    placement: "before" | "after";
  } | null>(null);

  // Filter channels based on hide_muted preference
  const visibleChannels = useMemo(() => {
    return channelItems.filter((ch) => {
      if (hideMuted && ch.is_muted) return false;
      return true;
    });
  }, [channelItems, hideMuted]);

  // Group channels by category
  const uncategorizedTextChannels = useMemo(
    () => visibleChannels.filter((ch) => !ch.category_id && ch.kind !== "voice"),
    [visibleChannels],
  );
  const uncategorizedVoiceChannels = useMemo(
    () => visibleChannels.filter((ch) => !ch.category_id && ch.kind === "voice"),
    [visibleChannels],
  );

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.position - b.position);
  }, [categories]);

  // Handle Drag & Drop operations
  async function handleDropOnChannel(targetChannel: Channel, placement: "before" | "after") {
    if (!dragItem || dragItem.type !== "channel" || dragItem.id === targetChannel.id) {
      setDragItem(null);
      setDragOverTarget(null);
      return;
    }

    const currentChannels = [...channelItems];
    const sourceIdx = currentChannels.findIndex((c) => c.id === dragItem.id);
    if (sourceIdx === -1) return;

    const [moving] = currentChannels.splice(sourceIdx, 1);
    if (!moving) return;

    moving.category_id = targetChannel.category_id ?? null;

    const targetIdx = currentChannels.findIndex((c) => c.id === targetChannel.id);
    const insertIdx = placement === "before" ? targetIdx : targetIdx + 1;
    currentChannels.splice(insertIdx, 0, moving);

    // Reassign positions within each category
    const items = currentChannels.map((ch, idx) => ({
      id: ch.id,
      category_id: ch.category_id ?? null,
      position: idx,
    }));

    try {
      await reorderChannels.mutateAsync(items);
    } catch {
      // Rollback managed by react-query invalidation
    } finally {
      setDragItem(null);
      setDragOverTarget(null);
    }
  }

  async function handleDropOnCategory(targetCat: ChannelCategory) {
    if (!dragItem) return;

    if (dragItem.type === "category") {
      if (dragItem.id === targetCat.id) {
        setDragItem(null);
        setDragOverTarget(null);
        return;
      }
      const list = [...sortedCategories];
      const sourceIdx = list.findIndex((c) => c.id === dragItem.id);
      if (sourceIdx === -1) return;

      const [moving] = list.splice(sourceIdx, 1);
      if (!moving) return;

      const targetIdx = list.findIndex((c) => c.id === targetCat.id);
      list.splice(targetIdx, 0, moving);

      try {
        await reorderCategories.mutateAsync(list.map((c) => c.id));
      } catch {
        // Rollback managed by query invalidation
      }
    } else if (dragItem.type === "channel") {
      // Move channel to this category at the bottom
      const channelsInCat = channelItems.filter((c) => c.category_id === targetCat.id);
      const nextPos = channelsInCat.length;

      try {
        await reorderChannels.mutateAsync([
          { id: dragItem.id, category_id: targetCat.id, position: nextPos },
        ]);
      } catch {
        // handled
      }
    }

    setDragItem(null);
    setDragOverTarget(null);
  }

  return (
    <>
      <ServerDropdown
        key={community?.id ?? "none"}
        community={community}
        canCreateChannel={canManage}
        onNavigate={onNavigate}
      />

      <div
        className="sidebar-scroll relative"
        onContextMenu={(e) => {
          // If right-clicked on an interactive element, do not open the empty space menu
          if (
            (e.target as HTMLElement).closest(
              ".channel-link, .channel-category-header, button, a",
            )
          ) {
            return;
          }
          e.preventDefault();
          setCategoryMenu(null);
          setSidebarMenuPos({ x: e.clientX, y: e.clientY });
        }}
      >
        {community && (
          <nav className="community-navigation" aria-label="Server events">
            <Link
              className={cn("sidebar-link", view === "events" && "is-active")}
              to={communityHref(community.id, undefined, "events")}
              aria-current={view === "events" ? "page" : undefined}
              onClick={onNavigate}
            >
              <CalendarDays size={18} aria-hidden="true" />
              <span>Events</span>
            </Link>
          </nav>
        )}

        {communities.error && (
          <ApiNotice
            compact
            error={communities.error}
            onRetry={() => {
              void communities.refetch();
            }}
          />
        )}

        {community && (
          <>
            {channels.isPending && <ChannelSidebarSkeleton />}
            {channels.error && (
              <ApiNotice
                compact
                error={channels.error}
                onRetry={() => {
                  void channels.refetch();
                }}
              />
            )}

            {/* Default Uncategorized Text Channels (or standard Text Channels section when no custom categories) */}
            {(sortedCategories.length === 0 || uncategorizedTextChannels.length > 0) && (
              <ChannelCategorySection
                key={`${community.id}-uncategorized-text`}
                name="Text Channels"
                action={
                  canManage && (
                    <Tooltip content="Create Channel">
                      <button
                        type="button"
                        className="icon-button channel-category-add"
                        aria-label="Create Channel"
                        onClick={(e) => {
                          createChannelTriggerRef.current = e.currentTarget;
                          setTargetCategoryId(undefined);
                          setTargetKind("text");
                          setCreateChannelOpen(true);
                        }}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  )
                }
              >
                <nav aria-label="Text channels">
                  {uncategorizedTextChannels.map((item) => (
                    <div
                      key={item.id}
                      draggable={canManage}
                      onDragStart={() =>
                        setDragItem({
                          type: "channel",
                          id: item.id,
                          sourceCategoryId: null,
                        })
                      }
                      onDragOver={(e) => {
                        if (!canManage || dragItem?.type !== "channel") return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const placement =
                          e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                        setDragOverTarget({ type: "channel", id: item.id, placement });
                      }}
                      onDragLeave={() => setDragOverTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragOverTarget?.id === item.id) {
                          void handleDropOnChannel(item, dragOverTarget.placement);
                        }
                      }}
                      className={cn(
                        "relative",
                        dragOverTarget?.id === item.id &&
                          dragOverTarget.placement === "before" &&
                          "border-t-2 border-primary",
                        dragOverTarget?.id === item.id &&
                          dragOverTarget.placement === "after" &&
                          "border-b-2 border-primary",
                        dragItem?.id === item.id && "opacity-40",
                      )}
                    >
                      <Link
                        to={communityHref(community.id, item.id)}
                        onClick={onNavigate}
                        className={cn(
                          "sidebar-link channel-link",
                          view === "channel" &&
                            channel?.id === item.id &&
                            "is-active",
                        )}
                        aria-current={
                          view === "channel" && channel?.id === item.id
                            ? "page"
                            : undefined
                        }
                        title={item.name}
                      >
                        <Hash size={18} aria-hidden="true" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </div>
                  ))}
                </nav>
              </ChannelCategorySection>
            )}

            {/* Custom Categories Tree */}
            {sortedCategories.map((cat) => {
              const channelsInCat = visibleChannels.filter(
                (ch) => ch.category_id === cat.id,
              );
              const isCollapsed = Boolean(effectiveCollapsedMap[cat.id]);

              return (
                <div
                  key={cat.id}
                  draggable={canManage}
                  onDragStart={() => setDragItem({ type: "category", id: cat.id })}
                  onDragOver={(e) => {
                    if (!canManage) return;
                    e.preventDefault();
                    setDragOverTarget({
                      type: "category",
                      id: cat.id,
                      placement: "before",
                    });
                  }}
                  onDragLeave={() => setDragOverTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    void handleDropOnCategory(cat);
                  }}
                  className={cn(
                    "relative mt-1",
                    dragOverTarget?.id === cat.id &&
                      dragItem?.type === "category" &&
                      "border-t-2 border-primary",
                    dragOverTarget?.id === cat.id &&
                      dragItem?.type === "channel" &&
                      "bg-primary/5 rounded-md",
                    dragItem?.id === cat.id && "opacity-40",
                  )}
                >
                  <ChannelCategorySection
                    name={cat.name}
                    isPrivate={cat.is_private}
                    isMuted={cat.is_muted}
                    expanded={!isCollapsed}
                    onToggleExpanded={() => handleToggleCollapse(cat.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSidebarMenuPos(null);
                      setCategoryMenu({
                        category: cat,
                        position: { x: e.clientX, y: e.clientY },
                      });
                    }}
                    action={
                      canManage && (
                        <Tooltip content="Create Channel">
                          <button
                            type="button"
                            className="icon-button channel-category-add"
                            aria-label="Create Channel"
                            onClick={(e) => {
                              e.stopPropagation();
                              createChannelTriggerRef.current = e.currentTarget;
                              setTargetCategoryId(cat.id);
                              setTargetKind("text");
                              setCreateChannelOpen(true);
                            }}
                          >
                            <Plus size={16} aria-hidden="true" />
                          </button>
                        </Tooltip>
                      )
                    }
                  >
                    <nav aria-label={`${cat.name} channels`}>
                      {channelsInCat.map((item) => (
                        <div
                          key={item.id}
                          draggable={canManage}
                          onDragStart={() =>
                            setDragItem({
                              type: "channel",
                              id: item.id,
                              sourceCategoryId: cat.id,
                            })
                          }
                          onDragOver={(e) => {
                            if (!canManage || dragItem?.type !== "channel") return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const placement =
                              e.clientY < rect.top + rect.height / 2
                                ? "before"
                                : "after";
                            setDragOverTarget({
                              type: "channel",
                              id: item.id,
                              placement,
                            });
                          }}
                          onDragLeave={() => setDragOverTarget(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragOverTarget?.id === item.id) {
                              void handleDropOnChannel(item, dragOverTarget.placement);
                            }
                          }}
                          className={cn(
                            "relative",
                            dragOverTarget?.id === item.id &&
                              dragOverTarget.placement === "before" &&
                              "border-t-2 border-primary",
                            dragOverTarget?.id === item.id &&
                              dragOverTarget.placement === "after" &&
                              "border-b-2 border-primary",
                            dragItem?.id === item.id && "opacity-40",
                          )}
                        >
                          <Link
                            to={communityHref(community.id, item.id)}
                            onClick={onNavigate}
                            className={cn(
                              "sidebar-link channel-link",
                              view === "channel" &&
                                channel?.id === item.id &&
                                "is-active",
                            )}
                            aria-current={
                              view === "channel" && channel?.id === item.id
                                ? "page"
                                : undefined
                            }
                            title={item.name}
                          >
                            {item.kind === "voice" ? (
                              <Volume2 size={18} aria-hidden="true" />
                            ) : (
                              <Hash size={18} aria-hidden="true" />
                            )}
                            <span className="truncate">{item.name}</span>
                          </Link>
                        </div>
                      ))}
                    </nav>
                  </ChannelCategorySection>
                </div>
              );
            })}

            {/* Uncategorized Voice Channels Section */}
            {(sortedCategories.length === 0 || uncategorizedVoiceChannels.length > 0) && (
              <ChannelCategorySection name="Voice Channels">
                {uncategorizedVoiceChannels.length > 0 ? (
                  <nav aria-label="Voice channels">
                    {uncategorizedVoiceChannels.map((item) => (
                      <Link
                        key={item.id}
                        to={communityHref(community.id, item.id)}
                        onClick={onNavigate}
                        className={cn(
                          "sidebar-link channel-link",
                          view === "channel" &&
                            channel?.id === item.id &&
                            "is-active",
                        )}
                        title={item.name}
                      >
                        <Volume2 size={18} aria-hidden="true" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    ))}
                  </nav>
                ) : (
                  <button className="sidebar-link voice-channel" disabled>
                    <Volume2 size={18} aria-hidden="true" />
                    <span>Voice unavailable</span>
                  </button>
                )}
              </ChannelCategorySection>
            )}
          </>
        )}
      </div>

      {/* Floating Context Menus */}
      {sidebarMenuPos && (
        <SidebarContextMenu
          position={sidebarMenuPos}
          hideMutedChannels={hideMuted}
          canManage={canManage}
          onToggleHideMuted={() => {
            void setPreferences.mutateAsync({
              hide_muted_channels: !hideMuted,
            });
          }}
          onCreateChannel={() => {
            setTargetCategoryId(undefined);
            setTargetKind("text");
            setCreateChannelOpen(true);
          }}
          onCreateCategory={() => {
            setCreateCategoryOpen(true);
          }}
          onInvitePeople={() => {
            setInviteOpen(true);
          }}
          onDismiss={() => setSidebarMenuPos(null)}
        />
      )}

      {categoryMenu && (
        <CategoryContextMenu
          category={categoryMenu.category}
          position={categoryMenu.position}
          canManage={canManage}
          isCollapsed={Boolean(collapsedMap[categoryMenu.category.id])}
          onToggleCollapse={() => {
            handleToggleCollapse(categoryMenu.category.id);
          }}
          onToggleMute={() => {
            void setCategoryMute.mutateAsync(!categoryMenu.category.is_muted);
          }}
          onCreateChannel={() => {
            setTargetCategoryId(categoryMenu.category.id);
            setTargetKind("text");
            setCreateChannelOpen(true);
          }}
          onEditCategory={() => {
            setEditingCategory(categoryMenu.category);
          }}
          onDeleteCategory={() => {
            setDeletingCategory(categoryMenu.category);
          }}
          onDismiss={() => setCategoryMenu(null)}
        />
      )}

      {/* Dialog Modals */}
      {community && (
        <>
          <CreateChannelDialog
            communityId={community.id}
            defaultCategoryId={targetCategoryId}
            defaultKind={targetKind}
            open={createChannelOpen}
            onOpenChange={setCreateChannelOpen}
            returnFocusRef={createChannelTriggerRef}
          />

          <CreateCategoryDialog
            communityId={community.id}
            open={createCategoryOpen}
            onOpenChange={setCreateCategoryOpen}
          />

          {editingCategory && (
            <EditCategoryDialog
              communityId={community.id}
              category={editingCategory}
              open={Boolean(editingCategory)}
              onOpenChange={(open) => {
                if (!open) setEditingCategory(null);
              }}
            />
          )}

          {deletingCategory && (
            <DeleteCategoryDialog
              communityId={community.id}
              category={deletingCategory}
              open={Boolean(deletingCategory)}
              onOpenChange={(open) => {
                if (!open) setDeletingCategory(null);
              }}
            />
          )}

          <InviteDialog
            community={community}
            open={inviteOpen}
            onOpenChange={setInviteOpen}
          />
        </>
      )}
    </>
  );
}

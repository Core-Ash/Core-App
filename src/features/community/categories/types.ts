import type { ChannelCategory } from "@/lib/api/types";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface DragState {
  type: "channel" | "category";
  id: string;
  sourceCategoryId?: string | null;
}

export interface DropTarget {
  type: "channel" | "category";
  id: string;
  placement: "before" | "after" | "inside";
}

export type CategoryAction =
  | { type: "create-channel"; categoryId?: string }
  | { type: "create-category" }
  | { type: "edit-category"; category: ChannelCategory }
  | { type: "delete-category"; category: ChannelCategory };

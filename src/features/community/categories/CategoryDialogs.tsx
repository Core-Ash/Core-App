import { useState, useRef, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FolderPlus, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useServerRoles } from "@/features/community/server-settings/api";
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "./api";
import type { ChannelCategory } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/api/errors";

export function CreateCategoryDialog({
  communityId,
  open,
  onOpenChange,
  onCreated,
}: {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (category: ChannelCategory) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog max-w-md w-full bg-popover text-popover-foreground p-6 rounded-xl shadow-2xl border border-border">
          {open && (
            <CreateCategoryDialogContent
              communityId={communityId}
              onClose={() => onOpenChange(false)}
              onCreated={onCreated}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CreateCategoryDialogContent({
  communityId,
  onClose,
  onCreated,
}: {
  communityId: string;
  onClose: () => void;
  onCreated?: (category: ChannelCategory) => void;
}) {
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createMutation = useCreateCategory(communityId);
  const rolesQuery = useServerRoles(communityId);
  const roles = rolesQuery.data?.items ?? [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Category name must not exceed 100 characters.");
      return;
    }

    try {
      setError(null);
      const created = await createMutation.mutateAsync({
        name: trimmed,
        is_private: isPrivate,
        roles: isPrivate ? selectedRoles : undefined,
      });
      onClose();
      onCreated?.(created);
    } catch (err) {
      setError(apiErrorMessage(err) || "Failed to create category");
    }
  }

  function toggleRole(roleId: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId],
    );
  }

  return (
    <>
      <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
        <div className="flex items-center gap-2">
          <FolderPlus className="size-5 text-primary" />
          <Dialog.Title className="text-lg font-bold text-foreground">
            Create Category
          </Dialog.Title>
        </div>
        <Dialog.Close asChild>
          <button
            type="button"
            className="icon-button text-muted-foreground hover:text-foreground"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </Dialog.Close>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="create-category-name"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Category Name
          </label>
          <Input
            ref={inputRef}
            id="create-category-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            maxLength={100}
            placeholder="new-category"
            required
            disabled={createMutation.isPending}
            className="bg-background text-foreground"
          />
        </div>

        <div className="rounded-lg border border-border p-3.5 bg-background/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                <Lock className="size-3.5 text-muted-foreground" />
                <span>Private Category</span>
              </div>
              <p className="text-xs text-muted-foreground">
                By making a category private, only selected roles and members will be able to view it.
              </p>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={createMutation.isPending}
            />
          </div>

          {isPrivate && roles.length > 0 && (
            <div className="pt-2 border-t border-border space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Who can access this category?
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: role.color || "#94a3b8" }}
                      />
                      <span className="font-medium text-foreground">{role.name}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="size-4 rounded border-border accent-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive font-medium">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
          >
            {createMutation.isPending ? "Creating..." : "Create Category"}
          </Button>
        </div>
      </form>
    </>
  );
}

export function EditCategoryDialog({
  communityId,
  category,
  open,
  onOpenChange,
}: {
  communityId: string;
  category: ChannelCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog max-w-md w-full bg-popover text-popover-foreground p-6 rounded-xl shadow-2xl border border-border">
          {open && (
            <EditCategoryDialogContent
              key={category.id}
              communityId={communityId}
              category={category}
              onClose={() => onOpenChange(false)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditCategoryDialogContent({
  communityId,
  category,
  onClose,
}: {
  communityId: string;
  category: ChannelCategory;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [isPrivate, setIsPrivate] = useState(category.is_private);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateCategory(communityId);
  const rolesQuery = useServerRoles(communityId);
  const roles = rolesQuery.data?.items ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }

    try {
      setError(null);
      await updateMutation.mutateAsync({
        categoryId: category.id,
        name: trimmed,
        is_private: isPrivate,
        roles: isPrivate ? selectedRoles : undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err) || "Failed to update category");
    }
  }

  function toggleRole(roleId: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId],
    );
  }

  return (
    <>
      <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
        <Dialog.Title className="text-lg font-bold text-foreground">
          Edit Category
        </Dialog.Title>
        <Dialog.Close asChild>
          <button
            type="button"
            className="icon-button text-muted-foreground hover:text-foreground"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </Dialog.Close>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="edit-category-name"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Category Name
          </label>
          <Input
            id="edit-category-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            maxLength={100}
            required
            disabled={updateMutation.isPending}
            className="bg-background text-foreground"
          />
        </div>

        <div className="rounded-lg border border-border p-3.5 bg-background/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                <Lock className="size-3.5 text-muted-foreground" />
                <span>Private Category</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Only selected roles and members will be able to view this category.
              </p>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={updateMutation.isPending}
            />
          </div>

          {isPrivate && roles.length > 0 && (
            <div className="pt-2 border-t border-border space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Role Access Overrides
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: role.color || "#94a3b8" }}
                      />
                      <span className="font-medium text-foreground">{role.name}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="size-4 rounded border-border accent-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive font-medium">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateMutation.isPending || !name.trim()}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </>
  );
}

export function DeleteCategoryDialog({
  communityId,
  category,
  open,
  onOpenChange,
}: {
  communityId: string;
  category: ChannelCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const deleteMutation = useDeleteCategory(communityId);

  async function handleDelete() {
    try {
      setError(null);
      await deleteMutation.mutateAsync(category.id);
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err) || "Failed to delete category");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog max-w-sm w-full bg-popover text-popover-foreground p-6 rounded-xl shadow-2xl border border-border space-y-4">
          <Dialog.Title className="text-lg font-bold text-foreground">
            Delete Category
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to delete <strong className="text-foreground">{category.name}</strong>? This cannot be undone. Contained channels will not be deleted and will move to the uncategorized channels list.
          </Dialog.Description>

          {error && (
            <p role="alert" className="text-xs text-destructive font-medium">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Category"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

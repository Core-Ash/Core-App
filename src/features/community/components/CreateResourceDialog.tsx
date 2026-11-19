import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Hash, Link2, Volume2, X } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateChannel,
  useCreateCommunity,
} from "@/features/community/api/hooks";
import { useCategories } from "@/features/community/categories/api";
import { communityHref } from "@/features/community/api/use-community-selection";
import { inviteDestination } from "@/features/invites/invite-link";
import { apiErrorMessage } from "@/lib/api/errors";

function CreateDialog({
  kind,
  children,
  create,
  pending,
  error,
  open: controlledOpen,
  onOpenChange,
  returnFocusRef,
  onBack,
  onSwitchToJoin,
}: {
  kind: "community" | "channel";
  children?: ReactElement;
  create: (name: string) => Promise<void>;
  pending: boolean;
  error: unknown;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  onBack?: () => void;
  onSwitchToJoin?: () => void;
}) {
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
    if (!value) {
      setMode("create");
      setJoinLink("");
      setJoinError("");
    }
  };
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [validation, setValidation] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [joinError, setJoinError] = useState("");
  const submitting = useRef(false);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      {children && <Dialog.Trigger asChild>{children}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog create-resource-dialog" onCloseAutoFocus={(event) => {
          if (returnFocusRef?.current) { event.preventDefault(); returnFocusRef.current.focus(); }
        }}>
          {mode === "join" ? (
            <>
              <Dialog.Title className="text-xl font-semibold">
                Join a server
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                Have an invite? Paste it below to see where you're headed.
              </Dialog.Description>
              <form
                aria-label="Join a server"
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const destination = inviteDestination(joinLink);
                  if (!destination) {
                    setJoinError("Enter a valid Core invite link or invitation code.");
                    return;
                  }
                  setOpen(false);
                  navigate(destination);
                }}
              >
                <div>
                  <label htmlFor="join-invite-input" className="block text-sm">
                    Invite link or code
                  </label>
                  <Input
                    id="join-invite-input"
                    value={joinLink}
                    maxLength={2048}
                    required
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Paste your invite link"
                    aria-invalid={Boolean(joinError)}
                    aria-describedby={joinError ? "join-invite-error" : undefined}
                    onChange={(event) => {
                      setJoinLink(event.target.value);
                      setJoinError("");
                    }}
                  />
                  {Boolean(joinError) && (
                    <p
                      id="join-invite-error"
                      role="alert"
                      className="mt-1 text-sm text-destructive"
                    >
                      {joinError}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMode("create");
                      setJoinError("");
                    }}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back to create
                  </Button>
                  <Button type="submit">
                    Continue to invite
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <Dialog.Title className="text-xl font-semibold">
                Create a {kind === "community" ? "server" : kind}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                {kind === "community"
                  ? "Start a place for your squad."
                  : "Add a text channel. The community owner or a member with channel management permission can do this."}
              </Dialog.Description>
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (pending || submitting.current) return;
                  const value = name.trim();
                  if (
                    !value ||
                    Array.from(value).length > 100 ||
                    value.includes("\0")
                  ) {
                    setValidation("Enter a name with 1–100 characters.");
                    return;
                  }
                  setValidation("");
                  submitting.current = true;
                  void create(value)
                    .then(() => {
                      setName("");
                      setOpen(false);
                    })
                    .catch(() => {})
                    .finally(() => {
                      submitting.current = false;
                    });
                }}
              >
                <label htmlFor={`create-${kind}-name`} className="block text-sm">
                  Name
                </label>
                <Input
                  id={`create-${kind}-name`}
                  value={name}
                  maxLength={200}
                  required
                  disabled={pending}
                  aria-invalid={Boolean(validation)}
                  aria-describedby={
                    validation || error ? `create-${kind}-error` : undefined
                  }
                  onChange={(event) => {
                    setName(event.target.value);
                    setValidation("");
                  }}
                />
                {Boolean(validation || error) && (
                  <p
                    id={`create-${kind}-error`}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {validation || apiErrorMessage(error)}
                  </p>
                )}
                <div className="flex items-center justify-between gap-3">
                  {onBack ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      onClick={onBack}
                    >
                      <ArrowLeft size={16} aria-hidden="true" />
                      Back
                    </Button>
                  ) : <div />}
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creating…" : `Create ${kind === "community" ? "server" : kind}`}
                  </Button>
                </div>
                {kind === "community" && (
                  <div className="create-community-switch">
                    <p>Have an invite already?</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={pending}
                      onClick={() => {
                        if (onSwitchToJoin) onSwitchToJoin();
                        else setMode("join");
                      }}
                    >
                      <Link2 size={15} aria-hidden="true" className="mr-1.5" />
                      Join an existing server with an invite link
                    </Button>
                  </div>
                )}
              </form>
            </>
          )}
          <Dialog.Close asChild>
            <button
              className="icon-button dialog-close"
              aria-label="Close"
              disabled={pending}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CreateCommunityDialog({
  children,
  open,
  onOpenChange,
  returnFocusRef,
  onBack,
  onSwitchToJoin,
}: {
  children?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  onBack?: () => void;
  onSwitchToJoin?: () => void;
}) {
  const mutation = useCreateCommunity();
  const navigate = useNavigate();
  return (
    <CreateDialog
      kind="community"
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      onBack={onBack}
      onSwitchToJoin={onSwitchToJoin}
      pending={mutation.isPending}
      error={mutation.error}
      create={async (name) => {
        const community = await mutation.mutateAsync(name);
        navigate(communityHref(community.id));
      }}
    >
      {children}
    </CreateDialog>
  );
}
export function CreateChannelDialog({
  communityId,
  defaultCategoryId,
  defaultKind = "text",
  children,
  open: controlledOpen,
  onOpenChange,
  returnFocusRef,
}: {
  communityId: string;
  defaultCategoryId?: string;
  defaultKind?: "text" | "voice";
  children?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const mutation = useCreateChannel(communityId);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const categoriesQuery = useCategories(open ? communityId : undefined);
  const categories = categoriesQuery.data?.items ?? [];
  const navigate = useNavigate();
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
    if (!value) {
      setName("");
      setValidation("");
      setKind(defaultKind);
      setSelectedCategory(defaultCategoryId ?? "");
    }
  };

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"text" | "voice">(defaultKind);
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategoryId ?? "");
  const [validation, setValidation] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    if (defaultCategoryId) setSelectedCategory(defaultCategoryId);
  }, [defaultCategoryId]);

  useEffect(() => {
    if (defaultKind) setKind(defaultKind);
  }, [defaultKind]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) setOpen(value);
      }}
    >
      {children && <Dialog.Trigger asChild>{children}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="standard-dialog create-resource-dialog"
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
        >
          <Dialog.Title className="text-xl font-semibold">
            Create a channel
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Configure your new channel. Choose between text or voice, and select its category.
          </Dialog.Description>

          <form
            aria-label="Create a channel"
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (mutation.isPending || submitting.current) return;
              const value = name.trim();
              if (!value || Array.from(value).length > 100 || value.includes("\0")) {
                setValidation("Enter a name with 1–100 characters.");
                return;
              }
              setValidation("");
              submitting.current = true;
              const payload = selectedCategory || kind !== "text"
                ? { name: value, category_id: selectedCategory || null, kind }
                : value;
              void mutation
                .mutateAsync(payload)
                .then((channel) => {
                  setName("");
                  setOpen(false);
                  navigate(communityHref(communityId, channel.id));
                })
                .catch(() => {})
                .finally(() => {
                  submitting.current = false;
                });
            }}
          >
            {/* Channel Type Choice */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Channel Type
              </label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Channel type">
                <button
                  type="button"
                  role="radio"
                  aria-checked={kind === "text"}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                    kind === "text"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:bg-surface-hover text-muted-foreground"
                  }`}
                  onClick={() => setKind("text")}
                >
                  <Hash className="size-5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Text</div>
                    <div className="text-[11px] text-muted-foreground">Post messages, links, emojis</div>
                  </div>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={kind === "voice"}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                    kind === "voice"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:bg-surface-hover text-muted-foreground"
                  }`}
                  onClick={() => setKind("voice")}
                >
                  <Volume2 className="size-5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Voice</div>
                    <div className="text-[11px] text-muted-foreground">Hang out and chat in voice</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Channel Name */}
            <div>
              <label htmlFor="create-channel-name" className="block text-sm">
                Name
              </label>
              <Input
                id="create-channel-name"
                value={name}
                maxLength={100}
                required
                disabled={mutation.isPending}
                aria-invalid={Boolean(validation)}
                aria-describedby={
                  validation || mutation.error ? "create-channel-error" : undefined
                }
                onChange={(event) => {
                  setName(event.target.value);
                  setValidation("");
                }}
                placeholder={kind === "voice" ? "General Voice" : "new-channel"}
              />
            </div>

            {/* Category Selection */}
            {categories.length > 0 && (
              <div>
                <label
                  htmlFor="create-channel-category"
                  className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  Category
                </label>
                <select
                  id="create-channel-category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={mutation.isPending}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">(None / Uncategorized)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {Boolean(validation || mutation.error) && (
              <p id="create-channel-error" role="alert" className="text-sm text-destructive">
                {validation || apiErrorMessage(mutation.error)}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating..." : "Create channel"}
              </Button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button className="icon-button dialog-close" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

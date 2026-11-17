import { useRef, useState, type ReactElement, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Link2, X } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateChannel,
  useCreateCommunity,
} from "@/features/community/api/hooks";
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
  children,
  open,
  onOpenChange,
  returnFocusRef,
}: {
  communityId: string;
  children?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const mutation = useCreateChannel(communityId);
  const navigate = useNavigate();
  return (
    <CreateDialog
      kind="channel"
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      pending={mutation.isPending}
      error={mutation.error}
      create={async (name) => {
        const channel = await mutation.mutateAsync(name);
        navigate(communityHref(communityId, channel.id));
      }}
    >
      {children}
    </CreateDialog>
  );
}

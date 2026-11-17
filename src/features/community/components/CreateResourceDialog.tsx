import { useRef, useState, type ReactElement, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateChannel,
  useCreateCommunity,
} from "@/features/community/api/hooks";
import { communityHref } from "@/features/community/api/use-community-selection";
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
}: {
  kind: "community" | "channel";
  children?: ReactElement;
  create: (name: string) => Promise<void>;
  pending: boolean;
  error: unknown;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => { setInternalOpen(value); onOpenChange?.(value); };
  const [name, setName] = useState("");
  const [validation, setValidation] = useState("");
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
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : `Create ${kind === "community" ? "server" : kind}`}
            </Button>
          </form>
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
}: {
  children?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const mutation = useCreateCommunity();
  const navigate = useNavigate();
  return (
    <CreateDialog
      kind="community"
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
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

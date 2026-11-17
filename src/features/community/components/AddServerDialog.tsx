import { useId, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Link2, Plus, X } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateCommunityDialog } from "@/features/community/components/CreateResourceDialog";
import { inviteDestination } from "@/features/invites/invite-link";

export function AddServerDialog({ children }: { children: ReactElement }) {
  const id = useId(), navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "create" | "join">("choose");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null), joinChoice = useRef<HTMLButtonElement>(null);
  const previous = useRef(step);
  useLayoutEffect(() => {
    if (step === "join") input.current?.focus();
    else if (step === "choose" && previous.current === "join") joinChoice.current?.focus();
    previous.current = step;
  }, [step]);
  return <>
    <Dialog.Root open={open && step !== "create"} onOpenChange={(value) => {
      if (value) { setStep("choose"); setLink(""); setError(""); }
      setOpen(value);
    }}>
      <Dialog.Trigger asChild ref={trigger}>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="standard-dialog add-server-dialog" onCloseAutoFocus={(event) => {
          if (step === "create") event.preventDefault();
        }}>
          <header className="add-server-heading">
            <Dialog.Title className="text-xl font-bold">{step === "join" ? "Join a server" : "Add a server"}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step === "join" ? "Have an invite? Paste it below to see where you're headed." : "Start a space of your own, or find your people in an existing server."}
            </Dialog.Description>
          </header>
          {step === "join" ? <form aria-label="Join a server" onSubmit={(event) => {
            event.preventDefault();
            const destination = inviteDestination(link);
            if (!destination) { setError("Enter a valid Core invite link or invitation code."); input.current?.focus(); return; }
            setOpen(false);
            navigate(destination);
          }}>
            <div className="add-server-body space-y-3">
              <label className="invite-field-label" htmlFor={`${id}-invite`}>Invite link or code</label>
              <Input ref={input} id={`${id}-invite`} value={link} required maxLength={2048} autoComplete="off" autoCapitalize="none" spellCheck={false}
                placeholder="Paste your invite link" aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
                onChange={(event) => { setLink(event.target.value); setError(""); }} />
              <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">You'll see the server's invitation first. Joining is your choice.</p>
              {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
            <footer className="add-server-footer">
              <Button variant="ghost" onClick={() => { setStep("choose"); setError(""); }}><ArrowLeft size={16} aria-hidden="true" />Back</Button>
              <Button type="submit">Continue to invite<ArrowRight size={16} aria-hidden="true" /></Button>
            </footer>
          </form> : <div className="add-server-body add-server-choices">
            <button type="button" className="add-server-choice" aria-label="Create a server" onClick={() => setStep("create")}>
              <span className="add-server-choice-icon"><Plus size={24} aria-hidden="true" /></span>
              <span><strong>Create a server</strong><span>A fresh start for your community.</span></span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" ref={joinChoice} className="add-server-choice" aria-label="Join a server" onClick={() => setStep("join")}>
              <span className="add-server-choice-icon"><Link2 size={23} aria-hidden="true" /></span>
              <span><strong>Join a server</strong><span>Already have an invite? Come on in.</span></span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>}
          <Dialog.Close asChild><button className="icon-button dialog-close" aria-label="Close add server dialog"><X size={21} aria-hidden="true" /></button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <CreateCommunityDialog open={open && step === "create"} onOpenChange={setOpen} returnFocusRef={trigger} />
  </>;
}

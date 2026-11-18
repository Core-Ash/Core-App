import { useRef, type ComponentProps } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// Controlled dialogs opened without Dialog.Trigger still restore their opener.
// Radix owns the portal, focus trap, dismissals, and background scroll lock.
export function ModalContent({ className, onCloseAutoFocus, ...props }: ComponentProps<typeof Dialog.Content>) {
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return <Dialog.Content {...props} className={cn("standard-dialog", className)} onCloseAutoFocus={(event) => {
    onCloseAutoFocus?.(event);
    if (!event.defaultPrevented && opener.current?.isConnected) {
      event.preventDefault();
      opener.current.focus();
    }
  }} />;
}

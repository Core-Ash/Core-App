import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fullUsername } from "@/lib/display-name";
import type { PublicProfile } from "@/lib/api/types";

export function CopyUsername({ profile }: { profile: PublicProfile }) {
  const [notice, setNotice] = useState("");
  const tag = fullUsername(profile);
  if (!tag) return null;
  return <div className="space-y-1">
    <Button variant="ghost" size="sm" onClick={() => {
      void (async () => {
        try { await navigator.clipboard.writeText(tag); setNotice("Username copied."); }
        catch { setNotice("Couldn't copy. Select and copy your username manually."); }
      })();
    }}><Copy size={14} aria-hidden="true" />Copy Username</Button>
    <p role="status" className="text-xs text-muted-foreground">{notice}</p>
  </div>;
}

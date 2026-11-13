import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-context";

export function LogoutButton() {
  const { client, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (!client || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await client.signOut();
      if (result.error) {
        setError("Couldn't sign out. Please try again.");
        return;
      }
      await refresh();
      navigate("/login", { replace: true });
    } catch {
      setError("Couldn't reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        variant="ghost"
        className="w-full justify-start"
        disabled={busy}
        onClick={() => {
          void signOut();
        }}
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <LogOut aria-hidden="true" />
        )}
        {busy ? "Signing out…" : "Sign out"}
      </Button>
      {error && (
        <p
          role="alert"
          className="px-3 pt-2 text-xs leading-relaxed text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

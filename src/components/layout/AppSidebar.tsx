import { UserPanel } from "@/components/layout/UserPanel";
import { CommunitySidebar } from "@/features/community/components/CommunitySidebar";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="app-sidebar">
      <CommunitySidebar onNavigate={onNavigate} />
      <UserPanel onNavigate={onNavigate} />
    </div>
  );
}

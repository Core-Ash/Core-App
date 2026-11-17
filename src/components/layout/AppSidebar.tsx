import { UserPanel } from "@/components/layout/UserPanel";
import { CommunitySidebar } from "@/features/community/components/CommunitySidebar";
import { NavLink, useLocation } from "react-router";
import { MessageSquare, Plus, Users } from "lucide-react";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <div className="app-sidebar">
      {pathname === "/app/friends" || pathname === "/app/messages" ? <>
        <div className="personal-search"><button disabled title="Direct messages are not available yet">Find or start a conversation</button></div>
        <div className="sidebar-scroll personal-sidebar">
          <nav aria-label="Personal navigation">
            <NavLink to="/app/friends" className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`} onClick={onNavigate}><Users size={21} aria-hidden="true" /><span>Friends</span></NavLink>
            <NavLink to="/app/messages" className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`} onClick={onNavigate}><MessageSquare size={21} aria-hidden="true" /><span>Messages</span><span className="personal-soon">Soon</span></NavLink>
          </nav>
          <div className="personal-dm-heading"><h2>Direct Messages</h2><button className="icon-button" disabled aria-label="New direct message unavailable" title="Direct messages are not available yet"><Plus size={16} aria-hidden="true" /></button></div>
          <p className="personal-dm-empty">Your conversations will appear here when direct messages are available.</p>
        </div>
      </> : <CommunitySidebar onNavigate={onNavigate} />}
      <UserPanel onNavigate={onNavigate} />
    </div>
  );
}

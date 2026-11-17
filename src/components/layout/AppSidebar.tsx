import { UserPanel } from "@/components/layout/UserPanel";
import { Tooltip } from "@/components/ui/tooltip";
import { CommunitySidebar } from "@/features/community/components/CommunitySidebar";
import { NavLink, useLocation } from "react-router";
import { MessageSquare, Plus, Search, Users } from "lucide-react";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <div className="app-sidebar">
      {pathname === "/app/friends" || pathname === "/app/messages" ? <>
        <div className="personal-search">
          <NavLink to="/app/friends?search=1" title="Search friends. Conversations are not available yet." onClick={onNavigate}>
            <Search size={14} aria-hidden="true" />
            <span>Find or start a conversation</span>
          </NavLink>
        </div>
        <div className="sidebar-scroll personal-sidebar">
          <nav aria-label="Personal navigation">
            <NavLink to="/app/friends" className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`} onClick={onNavigate}><Users size={20} aria-hidden="true" /><span>Friends</span></NavLink>
            <NavLink to="/app/messages" className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`} onClick={onNavigate}><MessageSquare size={20} aria-hidden="true" /><span>Messages</span><span className="personal-soon">Soon</span></NavLink>
          </nav>
          <div className="personal-dm-heading">
            <h2>Direct Messages</h2>
            <Tooltip content="Create DM · Direct messages are not available yet">
              <button type="button" className="icon-button" disabled aria-label="Create direct message unavailable">
                <Plus size={15} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
          <p className="personal-dm-empty">No conversations yet.</p>
        </div>
      </> : <CommunitySidebar onNavigate={onNavigate} />}
      <UserPanel onNavigate={onNavigate} />
    </div>
  );
}

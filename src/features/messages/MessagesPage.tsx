import { Menu, MessageSquare, Plus } from "lucide-react";
import { Link, useOutletContext } from "react-router";
import type { WorkspaceNavigation } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

export function MessagesPage() {
  const navigation = useOutletContext<WorkspaceNavigation | undefined>();
  return <div className="friends-page messages-page">
    <header className="friends-header">
      {navigation && <button className="icon-button community-menu-toggle" aria-label="Open navigation" onClick={navigation.openNavigation}><Menu size={20} aria-hidden="true" /></button>}
      <h1><MessageSquare size={20} aria-hidden="true" />Direct messages</h1>
      <span className="personal-soon">Coming soon</span>
    </header>
    <div className="messages-workspace">
      <div className="messages-empty"><MessageSquare size={48} aria-hidden="true" /><h2>A place for your conversations</h2><p>Direct messages aren’t available yet. You can already find your people and manage friend requests.</p><Button asChild variant="outline"><Link to="/app/friends">Go to Friends</Link></Button></div>
      <div className="messages-composer" aria-label="Direct messaging unavailable"><Plus size={20} aria-hidden="true" /><span>Direct messages are not available yet</span></div>
    </div>
  </div>;
}

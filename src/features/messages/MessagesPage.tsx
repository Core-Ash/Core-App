import { useState } from "react";
import { MessageSquare, Plus, Users } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { CreateGroupDmDialog } from "@/features/conversations/components/CreateGroupDmDialog";
import { ConversationView } from "@/features/conversations/components/ConversationView";

export function MessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [createDmOpen, setCreateDmOpen] = useState(false);

  if (conversationId) {
    return <ConversationView conversationId={conversationId} />;
  }

  return (
    <div className="friends-page messages-page">
      <header className="friends-header">
        <h1>
          <MessageSquare size={20} aria-hidden="true" />
          Direct messages
        </h1>
      </header>
      <div className="messages-workspace">
        <div className="messages-empty">
          <MessageSquare size={48} aria-hidden="true" />
          <h2>A place for your conversations</h2>
          <p>
            Direct Messages and Group DMs give you private spaces to talk with
            your friends outside of servers.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setCreateDmOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Start Conversation
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/friends">
                <Users size={16} className="mr-1.5" />
                Go to Friends
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <CreateGroupDmDialog
        open={createDmOpen}
        onOpenChange={setCreateDmOpen}
      />
    </div>
  );
}

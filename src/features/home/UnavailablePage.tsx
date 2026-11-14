import { ArrowRight, MessageSquare, Users } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export function UnavailablePage({
  feature,
}: {
  feature: "friends" | "messages";
}) {
  const friends = feature === "friends";
  const Icon = friends ? Users : MessageSquare;
  return (
    <div className="page-scroll unavailable-page">
      <header className="page-header">
        <Icon size={18} aria-hidden="true" />
        <h1>{friends ? "Friends" : "Direct messages"}</h1>
        <span className="sample-tag ml-auto">COMING LATER</span>
      </header>
      <EmptyState
        icon={Icon}
        title={
          friends
            ? "Good company starts somewhere."
            : "Every conversation starts with a hello."
        }
        description={
          friends
            ? "No friends to show yet. Friend requests and online presence aren’t available in this preview."
            : "No conversations yet. Direct messages aren’t available in this preview."
        }
      >
        <Button variant="outline" asChild>
          <Link to="/app/communities">
            Explore a sample community
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </EmptyState>
    </div>
  );
}

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
            ? "Friend requests and online presence aren't available yet."
            : "Direct messages aren't available yet."
        }
      >
        <Button variant="outline" asChild>
          <Link to="/app/communities">
            Explore your communities
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </EmptyState>
    </div>
  );
}

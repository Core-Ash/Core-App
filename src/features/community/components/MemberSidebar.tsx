import { useState } from "react";
import { Gamepad2, Smartphone } from "lucide-react";
import { previewMembers } from "@/features/community/preview/preview-data";
import type {
  PreviewCommunity,
  PreviewMember,
} from "@/features/community/preview/types";
import { MemberAvatar } from "@/features/community/components/MemberAvatar";

function MemberGroup({
  title,
  members,
  category,
}: {
  title: string;
  members: readonly PreviewMember[];
  category: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!members.length) return null;
  const offline = category === "offline";
  const shown = offline && !expanded ? members.slice(0, 3) : members;
  return (
    <section
      className={`member-group member-group-${category}`}
      aria-label={`${title} sample members`}
    >
      <h3>
        {title} <span>— {members.length}</span>
      </h3>
      <ul>
        {shown.map((member) => (
          <li
            key={member.id}
            className={offline ? "member-row member-offline" : "member-row"}
          >
            <MemberAvatar member={member} presence={!offline} />
            <div className="member-details">
              <p>{member.name}</p>
              {member.game && (
                <span className="member-game">
                  {member.mobile ? (
                    <Smartphone size={13} aria-hidden="true" />
                  ) : (
                    <Gamepad2 size={15} aria-hidden="true" />
                  )}
                  Playing {member.game}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {offline && members.length > 3 && (
        <button
          className="more-members"
          aria-expanded={expanded}
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? "Show fewer" : `+${members.length - 3} more`}
        </button>
      )}
    </section>
  );
}

export function MemberList({ community }: { community: PreviewCommunity }) {
  const members = previewMembers.filter((member) =>
    community.memberIds.includes(member.id),
  );
  return (
    <div className="member-list">
      <MemberGroup
        title="Playing"
        category="playing"
        members={members.filter((member) => member.status === "playing")}
      />
      <MemberGroup
        title="Online"
        category="online"
        members={members.filter((member) => member.status === "online")}
      />
      <MemberGroup
        title="Offline"
        category="offline"
        members={members.filter((member) => member.status === "offline")}
      />
    </div>
  );
}

export function MemberSidebar({ community }: { community: PreviewCommunity }) {
  return (
    <div className="member-sidebar-content" id="community-members">
      <h2 className="sr-only">Sample members and game activity</h2>
      <div className="member-sidebar-scroll">
        <MemberList community={community} />
      </div>
    </div>
  );
}

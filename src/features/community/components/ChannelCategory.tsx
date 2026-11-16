import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function ChannelCategory({ name, action, children }: {
  name: string; action?: ReactNode; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return (
    <section className="channel-section" aria-label={name}>
      <div className="channel-category-header">
        <button className="channel-category-toggle" aria-expanded={expanded} aria-controls={id}
          onClick={() => setExpanded((value) => !value)}>
          <ChevronDown size={14} aria-hidden="true" />
          <span>{name}</span>
        </button>
        {action}
      </div>
      <div id={id} hidden={!expanded}>{children}</div>
    </section>
  );
}

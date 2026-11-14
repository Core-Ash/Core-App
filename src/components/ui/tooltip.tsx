import type { ReactNode } from "react";

export function Tooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: string;
}) {
  return (
    <span className="tooltip-anchor">
      {children}
      <span className="tooltip-content" role="tooltip">
        {content}
      </span>
    </span>
  );
}

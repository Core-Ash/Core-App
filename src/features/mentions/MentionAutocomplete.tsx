import type { MentionSuggestion } from "@/features/mentions/model";

export function MentionAutocomplete({ items, selected, loading, onSelect, onHighlight, id }: {
  items: MentionSuggestion[]; selected: number; loading?: boolean;
  onSelect: (item: MentionSuggestion) => void; onHighlight: (index: number) => void; id: string;
}) {
  return <div id={id} role="listbox" aria-label="Mention suggestions" className="absolute bottom-full left-0 z-40 mb-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-xl">
    <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">Members and mentions</div>
    {!items.length && <div role="status" className="p-3 text-sm text-muted-foreground">{loading ? "Searching…" : "No matching mentions"}</div>}
    {items.map((item, index) => <button key={`${item.kind}:${item.id ?? item.kind}`} id={`${id}-${index}`} type="button" role="option" aria-selected={index === selected}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${index === selected ? "bg-accent text-accent-foreground" : "text-popover-foreground hover:bg-accent/60"}`}
      onMouseEnter={() => onHighlight(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)}>
      {item.profile?.avatar_url ? <img alt="" src={item.profile.avatar_url} className="h-8 w-8 rounded-full object-cover" /> : <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted" style={{ color: item.color ?? undefined }}>{item.kind === "user" ? item.label[0] : "@"}</span>}
      <span className="min-w-0 flex-1"><span className="block truncate font-medium" style={{ color: item.color ?? undefined }}>{item.label}</span><span className="block truncate text-xs text-muted-foreground">{item.detail ?? (item.kind === "role" ? "Role" : item.kind === "here" ? "Online alerts unavailable" : "Mass mention")}</span></span>
    </button>)}
  </div>;
}

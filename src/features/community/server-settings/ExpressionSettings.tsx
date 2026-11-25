import { useState } from "react";
import { Smile, Image, Volume2, Plus, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useServerEmojis,
  useCreateServerEmoji,
  useDeleteServerEmoji,
  useServerStickers,
  useCreateServerSticker,
  useDeleteServerSticker,
  useServerSoundboard,
  useCreateServerSoundboard,
  useDeleteServerSoundboard,
} from "./api";
import type { ServerSettingsData } from "./types";

export function EmojiSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const canCreate = canManage || Boolean(settings.permissions.effective_permissions?.includes("expressions.create"));
  const emojis = useServerEmojis(settings.id);
  const createEmoji = useCreateServerEmoji(settings.id);
  const deleteEmoji = useDeleteServerEmoji(settings.id);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const items = emojis.data?.items ?? [];
  const maxSlots = 50;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !url.trim()) {
      setError("Name and URL are required");
      return;
    }
    createEmoji.mutate(
      { name: name.trim(), url: url.trim() },
      {
        onSuccess: () => {
          setName("");
          setUrl("");
          setShowAdd(false);
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to add emoji");
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Smile className="size-5 text-primary" /> Emojis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload custom emojis that community members can use in text channels.
          </p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {items.length} / {maxSlots} Slots Available
        </div>
      </div>

      {canCreate && (
        <div>
          {!showAdd ? (
            <Button
              type="button"
              disabled={items.length >= maxSlots}
              onClick={() => setShowAdd(true)}
            >
              <Plus className="size-4 mr-1.5" /> Upload Emoji
            </Button>
          ) : (
            <form onSubmit={handleCreate} className="p-4 rounded-lg border border-border bg-card space-y-4">
              <div className="text-sm font-semibold text-foreground">Add Custom Emoji</div>
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Name</label>
                  <Input
                    placeholder="my_emoji"
                    maxLength={32}
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase())}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Image URL</label>
                  <Input
                    placeholder="https://.../emoji.png"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={createEmoji.isPending}>
                  Save Emoji
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Grid of emojis */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
        {items.map((emoji) => (
          <div
            key={emoji.id}
            className="group relative p-2.5 rounded-lg border border-border bg-card/50 flex flex-col items-center gap-1.5 hover:border-primary/50 transition-colors"
          >
            <img src={emoji.url} alt={emoji.name} className="size-8 object-contain" />
            <span className="text-[10px] text-muted-foreground truncate max-w-full font-mono">
              :{emoji.name}:
            </span>
            {canManage && (
              <button
                type="button"
                aria-label={`Delete ${emoji.name}`}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded transition-opacity"
                onClick={() => deleteEmoji.mutate(emoji.id)}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No custom emojis yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function StickerSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const canCreate = canManage || Boolean(settings.permissions.effective_permissions?.includes("expressions.create"));
  const stickers = useServerStickers(settings.id);
  const createSticker = useCreateServerSticker(settings.id);
  const deleteSticker = useDeleteServerSticker(settings.id);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const items = stickers.data?.items ?? [];
  const maxSlots = 30;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !url.trim()) {
      setError("Name and URL are required");
      return;
    }
    createSticker.mutate(
      { name: name.trim(), description: desc.trim() || undefined, url: url.trim() },
      {
        onSuccess: () => {
          setName("");
          setDesc("");
          setUrl("");
          setShowAdd(false);
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to add sticker");
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Image className="size-5 text-primary" /> Stickers
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create high-expression stickers unique to your community.
          </p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {items.length} / {maxSlots} Slots Available
        </div>
      </div>

      {canCreate && (
        <div>
          {!showAdd ? (
            <Button
              type="button"
              disabled={items.length >= maxSlots}
              onClick={() => setShowAdd(true)}
            >
              <Plus className="size-4 mr-1.5" /> Upload Sticker
            </Button>
          ) : (
            <form onSubmit={handleCreate} className="p-4 rounded-lg border border-border bg-card space-y-4">
              <div className="text-sm font-semibold text-foreground">Add Custom Sticker</div>
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Name</label>
                  <Input
                    placeholder="Super GG"
                    maxLength={32}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Image URL</label>
                  <Input
                    placeholder="https://.../sticker.png"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Description (Optional)</label>
                  <Input
                    placeholder="An epic celebration sticker"
                    maxLength={100}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={createSticker.isPending}>
                  Save Sticker
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Grid of stickers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((stk) => (
          <div
            key={stk.id}
            className="group relative p-3 rounded-lg border border-border bg-card/50 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors"
          >
            <img src={stk.url} alt={stk.name} className="size-20 object-contain" />
            <div className="text-center w-full">
              <div className="text-xs font-semibold text-foreground truncate">{stk.name}</div>
              {stk.description && (
                <div className="text-[10px] text-muted-foreground truncate">{stk.description}</div>
              )}
            </div>
            {canManage && (
              <button
                type="button"
                aria-label={`Delete ${stk.name}`}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded transition-opacity"
                onClick={() => deleteSticker.mutate(stk.id)}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No custom stickers yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function SoundboardSettings({
  settings,
  canManage,
}: {
  settings: ServerSettingsData;
  canManage: boolean;
}) {
  const canCreate = canManage || Boolean(settings.permissions.effective_permissions?.includes("expressions.create"));
  const sounds = useServerSoundboard(settings.id);
  const createSound = useCreateServerSoundboard(settings.id);
  const deleteSound = useDeleteServerSoundboard(settings.id);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🔊");
  const [url, setUrl] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const items = sounds.data?.items ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !url.trim()) {
      setError("Name and sound URL are required");
      return;
    }
    createSound.mutate(
      { name: name.trim(), emoji: emoji.trim() || undefined, sound_url: url.trim() },
      {
        onSuccess: () => {
          setName("");
          setUrl("");
          setShowAdd(false);
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to add sound");
        },
      }
    );
  };

  const togglePlay = (id: string, soundUrl: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      const audio = new Audio(soundUrl);
      setPlayingId(id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      void audio.play();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Volume2 className="size-5 text-primary" /> Soundboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage audio clips and reaction sounds for your server.
          </p>
        </div>
      </div>

      {canCreate && (
        <div>
          {!showAdd ? (
            <Button type="button" onClick={() => setShowAdd(true)}>
              <Plus className="size-4 mr-1.5" /> Upload Sound Clip
            </Button>
          ) : (
            <form onSubmit={handleCreate} className="p-4 rounded-lg border border-border bg-card space-y-4">
              <div className="text-sm font-semibold text-foreground">Add Sound Clip</div>
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Sound Name</label>
                  <Input
                    placeholder="Victory Horn"
                    maxLength={32}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Emoji</label>
                  <Input
                    placeholder="🎺"
                    maxLength={8}
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                  />
                </div>
                <div className="space-y-1 col-span-3">
                  <label className="text-xs font-bold text-muted-foreground">Audio URL (https://...)</label>
                  <Input
                    placeholder="https://.../sound.mp3"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={createSound.isPending}>
                  Save Sound
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Sound list */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((sound) => (
          <div
            key={sound.id}
            className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60 hover:bg-card transition-colors"
          >
            <div className="flex items-center gap-2.5 truncate">
              <button
                type="button"
                aria-label={`Play ${sound.name}`}
                className="size-8 rounded-full bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center shrink-0 transition-colors"
                onClick={() => togglePlay(sound.id, sound.sound_url)}
              >
                {playingId === sound.id ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
              </button>
              <div className="truncate">
                <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                  <span>{sound.emoji || "🔊"}</span>
                  <span className="truncate">{sound.name}</span>
                </div>
              </div>
            </div>

            {canManage && (
              <button
                type="button"
                aria-label={`Delete ${sound.name}`}
                className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                onClick={() => deleteSound.mutate(sound.id)}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No soundboard clips configured yet.
          </div>
        )}
      </div>

      <div className="p-3 rounded-lg border border-border/80 bg-neutral-900/60 text-xs text-muted-foreground">
        <strong>Voice Integration Notice:</strong> Sound clips are persisted and previewable here. Direct live voice channel broadcast requires the voice streaming pipeline.
      </div>
    </div>
  );
}

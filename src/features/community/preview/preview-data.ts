import type {
  PreviewCommunity,
  PreviewMember,
  PreviewMessage,
} from "@/features/community/preview/types";

// Visual samples from the supplied design reference, never live API or presence data.
// Authentication and the profile panel always use the real Better Auth session.
export const previewMembers: readonly PreviewMember[] = [
  {
    id: "sample-lira",
    name: "Lira",
    initials: "LI",
    avatar: "/avatars/lira.png",
    activityAvatar: "/avatars/lira-activity.png",
    tone: "rose",
    status: "playing",
    game: "Counter-Strike 2",
  },
  {
    id: "sample-vex",
    name: "Vex",
    initials: "VE",
    avatar: "/avatars/vex.png",
    activityAvatar: "/avatars/vex-activity.png",
    tone: "rose",
    status: "playing",
    game: "Valorant",
    mobile: true,
  },
  {
    id: "sample-kael",
    name: "Kael",
    initials: "KA",
    avatar: "/avatars/kael.png",
    activityAvatar: "/avatars/kael-activity.png",
    tone: "slate",
    status: "playing",
    game: "Elden Ring",
  },
  {
    id: "sample-nex",
    name: "Nex",
    initials: "NE",
    avatar: "/avatars/nex.png",
    activityAvatar: "/avatars/nex-activity.png",
    tone: "rose",
    status: "online",
  },
  {
    id: "sample-mira",
    name: "Mira",
    initials: "MI",
    avatar: "/avatars/mira.png",
    tone: "teal",
    status: "online",
    mobile: true,
  },
  {
    id: "sample-seth",
    name: "Seth",
    initials: "SE",
    avatar: "/avatars/seth.png",
    tone: "rose",
    status: "online",
  },
  {
    id: "sample-aron",
    name: "Aron",
    initials: "AR",
    avatar: "/avatars/aron.png",
    tone: "teal",
    status: "online",
  },
  {
    id: "sample-dax",
    name: "Dax",
    initials: "DA",
    avatar: "/avatars/dax.png",
    tone: "slate",
    status: "offline",
  },
  {
    id: "sample-iris",
    name: "Iris",
    initials: "IR",
    avatar: "/avatars/iris.png",
    tone: "slate",
    status: "offline",
  },
  {
    id: "sample-leon",
    name: "Leon",
    initials: "+5",
    tone: "slate",
    status: "offline",
  },
  ...["Nova", "Rowan", "Jules", "Echo", "Ash"].map(
    (name): PreviewMember => ({
      id: `sample-${name.toLowerCase()}`,
      name,
      initials: name.slice(0, 2).toUpperCase(),
      tone: "slate",
      status: "offline",
    }),
  ),
];

const channels = [
  {
    id: "general",
    name: "general",
    description: "A place for the whole squad.",
  },
  {
    id: "looking-for-group",
    name: "looking-for-group",
    description: "Find your next game together.",
  },
  {
    id: "clips",
    name: "clips",
    description: "Share the moments worth keeping.",
  },
  {
    id: "off-topic",
    name: "off-topic",
    description: "Between games and everything else.",
  },
] as const;

const emptyVoiceChannels = [
  { id: "lobby", name: "Lobby", sampleMemberIds: [] },
  { id: "game-1", name: "Game 1", sampleMemberIds: [] },
  { id: "game-2", name: "Game 2", sampleMemberIds: [] },
  { id: "afk", name: "AFK", sampleMemberIds: [] },
] as const;

export const previewCommunities: readonly PreviewCommunity[] = [
  {
    id: "core-gaming",
    name: "Core Gaming",
    initials: "CG",
    tone: "rose",
    emblem: "gamepad",
    tagline: "Your people. Your next game.",
    description: "A sample community for your next squad.",
    memberIds: previewMembers.map((member) => member.id),
    channels,
    voiceChannels: [
      { id: "lobby", name: "Lobby", sampleMemberIds: [] },
      {
        id: "game-1",
        name: "Game 1",
        sampleMemberIds: ["sample-lira", "sample-vex", "sample-kael"],
      },
      { id: "game-2", name: "Game 2", sampleMemberIds: [] },
      { id: "afk", name: "AFK", sampleMemberIds: [] },
    ],
  },
  {
    id: "dragon-den",
    name: "Dragon’s Den",
    initials: "DD",
    tone: "violet",
    emblem: "dragon",
    tagline: "Adventure awaits.",
    description: "A sample space for co-op adventures.",
    memberIds: ["sample-nex", "sample-lira", "sample-aron"],
    channels,
    voiceChannels: emptyVoiceChannels,
  },
  {
    id: "outpost",
    name: "The Outpost",
    initials: "OP",
    tone: "teal",
    emblem: "mountain",
    tagline: "New worlds. Familiar voices.",
    description: "A sample base camp for explorers.",
    memberIds: ["sample-kael", "sample-iris", "sample-leon"],
    channels,
    voiceChannels: emptyVoiceChannels,
  },
];

function member(id: string): PreviewMember {
  const found = previewMembers.find((item) => item.id === `sample-${id}`);
  if (!found) throw new Error("Unknown visual sample member.");
  return found;
}

export const previewMessages: Readonly<
  Record<string, readonly PreviewMessage[]>
> = {
  "core-gaming/general": [
    {
      id: "sample-1",
      author: member("nex"),
      body: "Anyone up for some ranked later?",
      createdAt: "2026-11-14T17:24:00Z",
      timestampLabel: "Today at 18:24",
    },
    {
      id: "sample-2",
      author: member("lira"),
      body: "I'm in 🎮",
      createdAt: "2026-11-14T17:26:00Z",
      timestampLabel: "Today at 18:26",
    },
    {
      id: "sample-3",
      author: member("vex"),
      body: "We can run around 8?",
      createdAt: "2026-11-14T17:27:00Z",
      timestampLabel: "Today at 18:27",
    },
    {
      id: "sample-4",
      author: member("nex"),
      body: "Sounds good!",
      createdAt: "2026-11-14T17:28:00Z",
      timestampLabel: "Today at 18:28",
    },
    {
      id: "sample-5",
      author: member("kael"),
      body: "New map looks insane",
      createdAt: "2026-11-14T17:35:00Z",
      timestampLabel: "Today at 18:35",
      attachment: {
        src: "/artwork/core-gaming-landscape.png",
        alt: "A watchtower above a pine forest and mountain valley beneath a crimson sunset.",
      },
      reactions: [
        { emoji: "🔥", label: "Fire", count: 5 },
        { emoji: "🎮", label: "Game controller", count: 3 },
      ],
    },
  ],
};

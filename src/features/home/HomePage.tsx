import {
  ArrowUpRight,
  AudioLines,
  Compass,
  Hash,
  Home,
  MessageCircle,
  Server,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";

const upcomingFeatures = [
  {
    title: "Your servers",
    icon: Server,
    description:
      "A home for every community. Gather your people in spaces that feel like yours.",
    detail: "Find your community",
  },
  {
    title: "Direct messages",
    icon: MessageCircle,
    description:
      "Keep the conversation going. A place for quick hellos and the longer catch-ups.",
    detail: "Start a conversation",
  },
  {
    title: "Friends",
    icon: Users,
    description:
      "Good company, always close. Stay connected with the people who make your day.",
    detail: "Keep your people close",
  },
  {
    title: "Explore Core",
    icon: Compass,
    description:
      "There’s more around the corner. New ways to connect will take shape here.",
    detail: "Discover what’s next",
  },
];

function ConnectionArtwork() {
  return (
    <div
      aria-hidden="true"
      className="connection-art relative hidden h-48 w-64 shrink-0 items-center justify-center lg:flex"
    >
      <div className="absolute size-44 rounded-full border border-primary/15" />
      <div className="absolute size-64 rounded-full border border-primary/8" />
      <div className="absolute h-px w-52 -rotate-35 bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <div className="relative z-10 flex size-20 -rotate-8 items-center justify-center rounded-[22px] border border-primary/30 bg-[#29233e] shadow-[0_16px_50px_#0005]">
        <Hash className="size-9 text-primary" strokeWidth={1.5} />
      </div>
      <div className="absolute right-2 top-2 z-20 flex size-14 rotate-12 items-center justify-center rounded-2xl border border-primary/20 bg-[#211e2e]">
        <MessageCircle className="size-6 text-primary/75" strokeWidth={1.5} />
      </div>
      <div className="absolute bottom-2 left-4 z-20 flex size-14 rotate-6 items-center justify-center rounded-2xl border border-primary/20 bg-[#211e2e]">
        <AudioLines className="size-6 text-primary/75" strokeWidth={1.5} />
      </div>
      <span className="absolute bottom-7 right-10 size-2 rounded-full bg-primary/50" />
      <span className="absolute left-11 top-7 size-1.5 rounded-full bg-primary/35" />
    </div>
  );
}

export function HomePage() {
  const { session } = useAuth();
  if (!session) return null;
  const { user } = session;
  const firstName = user.name.trim().split(/\s+/)[0] || "friend";

  return (
    <>
      <header className="hidden h-18 shrink-0 items-center gap-2 border-b border-border px-8 text-sm text-muted-foreground md:flex">
        <Home className="size-4" aria-hidden="true" />
        <span className="ml-1">Home</span>
        <span className="mx-2 text-border">/</span>
        <span className="text-foreground">Overview</span>
        <span className="ml-auto rounded-md border border-border px-2 py-1 text-[10px] tracking-wide">
          THE BEGINNING OF SOMETHING GOOD
        </span>
      </header>
      <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-12 lg:py-11">
        <div className="mb-8">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" /> YOUR SPACE,
            ALL TOGETHER
          </p>
          <h1 className="break-words text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-3 break-words text-sm text-muted-foreground">
            You’re signed in as{" "}
            <span className="text-foreground/80">{user.email}</span>
          </p>
        </div>

        <section
          aria-labelledby="welcome-title"
          className="welcome-panel relative flex items-center justify-between gap-6 overflow-hidden rounded-2xl border border-primary/20 px-6 py-8 sm:px-9"
        >
          <div className="relative z-10 max-w-lg">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
              <Sparkles className="size-3" aria-hidden="true" /> Welcome to Core
            </span>
            <h2
              id="welcome-title"
              className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
            >
              A place to belong.
              <br />
              <span className="text-primary">A space to be you.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              The best things start with a conversation. We’re building a space
              for yours — and this is just the beginning.
            </p>
          </div>
          <ConnectionArtwork />
        </section>

        <section aria-labelledby="upcoming-title" className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2
                id="upcoming-title"
                className="text-lg font-semibold tracking-tight"
              >
                Make room for what’s next
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                A first look at the spaces we’re building.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Coming soon to Core
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcomingFeatures.map(
              ({ title, icon: Icon, description, detail }) => (
                <Card
                  key={title}
                  className="group transition-colors hover:border-primary/25"
                >
                  <CardHeader className="gap-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-accent/65">
                        <Icon
                          className="size-[19px] text-primary/90"
                          strokeWidth={1.6}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground">
                        Coming soon
                      </span>
                    </div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground/80">
                      <span>{detail}</span>
                      <ArrowUpRight
                        className="size-3.5 opacity-50"
                        aria-hidden="true"
                      />
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            These are previews of future features. Servers, messaging, and
            friends aren’t available yet.
          </p>
        </section>
        <footer className="mt-10 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
          <span className="size-1 rounded-full bg-primary/60" /> Less noise.
          More connection.
        </footer>
      </div>
    </>
  );
}

import type { ReactNode } from "react";
import { ArrowUpRight, Gamepad2 } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Brand } from "@/components/common/Brand";
import { cn } from "@/lib/utils";
import { getReturnPath } from "@/features/auth/return-path";

export function AuthLayout({
  title,
  description,
  children,
  footer,
  mode,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  mode: "login" | "register";
}) {
  const location = useLocation();
  return (
    <div className="auth-page">
      <aside className="auth-brand-panel" aria-label="About Core">
        <Brand className="auth-brand" />
        <div className="auth-brand-copy">
          <span className="auth-eyebrow">
            <span /> A SPACE FOR YOUR PEOPLE
          </span>
          <h2>
            Communicate.
            <br />
            Play.
            <br />
            <span>Together.</span>
          </h2>
          <p>
            For the late nights. The close games.
            <br />
            The people who make it worth playing.
          </p>
        </div>
        <div className="auth-brand-footer">
          <span>
            <Gamepad2 size={17} strokeWidth={1.5} aria-hidden="true" /> Good
            company. Every game.
          </span>
          <span>
            CORE / 01 <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </div>
      </aside>
      <main className="auth-form-panel" id="main-content">
        <div className="auth-mobile-brand">
          <Brand />
          <span>Communicate. Play. Together.</span>
        </div>
        <div className="auth-form-content">
          <nav aria-label="Authentication" className="auth-tabs">
            {[
              { to: "/login", label: "Sign in", id: "login" },
              { to: "/register", label: "Sign up", id: "register" },
            ].map((item) => (
              <Link
                key={item.id}
                to={item.to}
                state={{ from: getReturnPath(location.state) }}
                aria-label={`${item.label} screen`}
                aria-current={mode === item.id ? "page" : undefined}
                className={cn(mode === item.id && "is-active")}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="auth-form-heading">
            <p className="eyebrow">
              {mode === "login" ? "Back in the game" : "Your next chapter"}
            </p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
          <div className="auth-form-footer">{footer}</div>
        </div>
        <footer className="auth-page-footer">
          <span>Made for the way you play.</span>
          <span>Core · Your gaming community</span>
        </footer>
      </main>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";

const features = [
  {
    emoji: "⏱️",
    title: "Practice Timer",
    description:
      "Full-featured timer with scrambles for every WCA event. Track your times, see your averages, and watch yourself improve.",
    screenshot: "/screenshots/timer.png",
  },
  {
    emoji: "🏆",
    title: "Daily Tournaments",
    description:
      "A new tournament drops every day with multiple events. Compete on the same scrambles as everyone else and see where you rank.",
    screenshot: "/screenshots/tourney.png",
  },
  {
    emoji: "📣",
    title: "Share Sessions",
    description:
      "Post your practice sessions to a feed your friends can see. Celebrate PBs, track streaks, and stay motivated together.",
  },
  {
    emoji: "🏅",
    title: "Medals & Rankings",
    description:
      "Earn gold, silver, and bronze in daily tournaments. Build up your medal collection and climb the all-time leaderboard.",
  },
  {
    emoji: "🏁",
    title: "Live Race Rooms",
    description:
      "Head-to-head racing with friends in real time. Same scramble, same countdown — pure speed.",
    comingSoon: true,
  },
  {
    emoji: "👥",
    title: "Clubs",
    description:
      "Form a club with your cubing crew. Compete as a team, compare stats, and climb club leaderboards.",
    comingSoon: true,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-full bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-4xl mx-auto">
        <span className="text-lg font-extrabold tracking-tight">
          twenty moves
        </span>
        <Link
          href="/login"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4">
          The social platform
          <br />
          for speedcubers.
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
          Practice with a built-in timer, compete in daily tournaments, share
          your sessions, and see how you stack up. Free and open to all skill
          levels.
        </p>
        <Link
          href="/login"
          className="inline-flex text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-6 py-3 shadow-[0_2px_0_0_theme(colors.blue.800)] transition-colors"
        >
          Get Started
        </Link>
      </section>

      {/* Feature sections with screenshots */}
      {features.map((feature, i) => (
        <section key={feature.title} className="max-w-4xl mx-auto px-6 py-16 border-t border-border">
          <div className={`flex flex-col ${feature.screenshot ? "gap-8" : ""}`}>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl leading-none">{feature.emoji}</span>
                <h2 className="text-xl font-bold">{feature.title}</h2>
                {feature.comingSoon && (
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </div>
              <p className="text-muted-foreground leading-relaxed max-w-xl">
                {feature.description}
              </p>
            </div>
            {feature.screenshot && (
              <div className="rounded-xl border border-border overflow-hidden">
                <Image
                  src={feature.screenshot}
                  alt={`${feature.title} screenshot`}
                  width={1200}
                  height={700}
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-t border-border">
        <h2 className="text-2xl font-extrabold tracking-tight mb-3">
          Ready to start?
        </h2>
        <p className="text-muted-foreground mb-6">
          Create an account and start timing. It&apos;s free.
        </p>
        <Link
          href="/login"
          className="inline-flex text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-6 py-3 shadow-[0_2px_0_0_theme(colors.blue.800)] transition-colors"
        >
          Create Account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-6 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} twenty moves
        </div>
      </footer>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";

const features = [
  {
    emoji: "🏆",
    title: "Daily Tournaments",
    description:
      "Compete in live tournaments with shared scrambles to climb the leaderboard.",
    details: [
      "Same scrambles for everyone",
      "Earn medals on your profile",
      "Link your WCA account to show up on the leaderboard",
    ],
    screenshot: "/tourneypic.png",
  },
  {
    emoji: "📣",
    title: "Share Sessions",
    description:
      "Share your practice sessions with friends and celebrate PBs.",
    details: [
      "See what your friends are practicing",
      "Follow famous cubers",
    ],
    screenshot: "/timerpic.png",
  },
  {
    emoji: "🏁",
    title: "Live Race Rooms",
    description:
      "Head-to-head racing with friends in real time.",
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
    <div className="min-h-full bg-background text-foreground font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-1">
          <img
            src="/tm_logo_ccw.svg"
            alt="twenty moves"
            className="w-32 h-auto"
          />
          <span className="text-lg font-extrabold tracking-tight">
            twenty moves
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg px-4 py-2 shadow-[0_2px_0_0_theme(colors.amber.800)] active:shadow-none active:translate-y-[2px] transition-all"
          >
            Sign up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-5">
            The social platform
            <br />
            <span className="text-amber-400">for speedcubers.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
            Share your times, compete in tournaments, earn medals, and more.
          </p>
        </div>
      </section>

      {features.map((feature, i) => {
        const isReversed = i % 2 === 1;
        const hasScreenshot = !!feature.screenshot;

        return (
          <section
            key={feature.title}
            className="max-w-5xl mx-auto px-6 pb-20"
          >
            <div
              className={`flex flex-col ${
                hasScreenshot ? "lg:flex-row lg:items-center" : ""
              } gap-8 lg:gap-12 ${isReversed && hasScreenshot ? "lg:flex-row-reverse" : ""}`}
            >
              {/* Text */}
              <div className={hasScreenshot ? "lg:w-5/12" : "max-w-xl"}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="text-2xl leading-none">{feature.emoji}</span>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  {feature.comingSoon && (
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {feature.description}
                </p>
                {feature.details && (
                  <ul className="space-y-2">
                    {feature.details.map((d) => (
                      <li
                        key={d}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Screenshot */}
              {hasScreenshot && (
                <div className="lg:w-7/12">
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Image
                      src={feature.screenshot!}
                      alt={`${feature.title} screenshot`}
                      width={1200}
                      height={750}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <img
            src="/tm_logo_ccw.svg"
            alt=""
            className="w-48 h-auto mx-auto mb-6"
          />
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-8">
            Ready to start cubing?
          </h2>
          <Link
            href="/login"
            className="inline-flex text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg px-8 py-3.5 shadow-[0_3px_0_0_theme(colors.amber.800)] active:shadow-none active:translate-y-[3px] transition-all"
          >
            Let&apos;s cube!
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} twenty moves
          </div>
        </div>
      </footer>
    </div>
  );
}

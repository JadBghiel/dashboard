/** the privacy notice, shown at the bottom of settings & privacy and on its own at /privacy, the 1
 * page a visitor can read before registering. kept in plain words, and in sync w/
 * what the app actually stores and sends */

import Link from "next/link";

const UPDATED = "October 11, 2026";

// every cookie the app sets, kept in sync w/ server/api/routes/games.ts and lib/auth.ts
const COOKIES = [
  [
    "dash_game_wordle, dash_game_flags, dash_game_bee",
    "Your progress in today's puzzles",
    "1 year",
  ],
  // better-auth's defaults: 7 days, pushed back at most once a day while the app is used
  [
    "Session cookie",
    "Keeps you signed in, once you have an account",
    "7 days after your last visit, or until you sign out",
  ],
];

// fetched by our server: they see our server, never you
const SERVER_SIDE = [
  ["Open-Meteo", "weather and city search"],
  ["Finnhub", "stock prices"],
  ["GitHub", "your notifications and public repositories, only once you connect your account"],
  ["Finnhub and CoinGecko", "company and coin logos, sent to you from our server"],
  ["CoinGecko", "crypto prices"],
  ["Frankfurter (European Central Bank rates)", "currency rates"],
  ["Nager.Date", "public holidays"],
  ["MyMemory", "translations, it receives the text you type in the translator"],
  ["Wikipedia", "on this day"],
  ["Google News", "headlines"],
  ["USGS and NASA EONET", "earthquakes and natural events"],
  ["flagcdn, CountriesNow and Datamuse", "the daily games"],
];

// loaded straight by your browser, like any image or video on a website
const BROWSER_SIDE = [
  ["Google", "the small icons of news sites"],
  ["YouTube (privacy enhanced mode)", "the live news player, only after you press play"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
      <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

// the notice is also the public /privacy page, so it points to settings instead of "above"
const SettingsLink = ({ hash, children }: { hash?: string; children: React.ReactNode }) => (
  <Link
    href={hash ? `/settings#${hash}` : "/settings"}
    className="text-foreground underline underline-offset-4"
  >
    {children}
  </Link>
);

const List = ({ items }: { items: string[][] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map(([who, what]) => (
      <li key={who}>
        <span className="text-foreground font-medium">{who}</span>: {what}
      </li>
    ))}
  </ul>
);

export function PrivacyNotice() {
  return (
    <article
      id="privacy"
      aria-labelledby="privacy-title"
      className="max-w-3xl scroll-mt-20 space-y-8"
    >
      <div className="space-y-1">
        <h2 id="privacy-title" className="font-heading text-xl font-semibold tracking-tight">
          Privacy
        </h2>
        <p className="text-muted-foreground text-sm">Last updated {UPDATED}</p>
      </div>

      <Section title="In short">
        <p>
          We keep only what the dashboard needs to work: your account, your settings and your
          widgets. No ads, no analytics, no tracking, and nothing is sold or shared.
        </p>
      </Section>

      <Section title="What we store">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="text-foreground font-medium">Your account</span>: name, email and
            username. Your password is stored as a hash, never in plain text.
          </li>
          <li>
            <span className="text-foreground font-medium">Your profile picture</span>: the one from
            your Google account, saved when you sign in with Google or connect it, if you had none.
          </li>
          <li>
            <span className="text-foreground font-medium">Your sign in sessions</span>: for each
            device you&apos;re signed in on, its IP address and browser (user agent), kept until the
            session expires or you log out.
          </li>
          <li>
            <span className="text-foreground font-medium">Your settings</span>: your city, your
            location answer, the text size, the theme and your best 2048 scores.
          </li>
          <li>
            <span className="text-foreground font-medium">Your widgets</span>: which ones you use,
            their options, refresh rate and order.
          </li>
          <li>
            <span className="text-foreground font-medium">A connected GitHub account</span>: the
            access token GitHub gives us, encrypted. It can only read your notifications and public
            data, and disconnecting GitHub on the Services page deletes it.
          </li>
          <li>
            <span className="text-foreground font-medium">Your own API keys</span>, if you save any:
            encrypted (AES-256-GCM), only their last 4 characters are ever shown back, and you can
            remove them at any time.
          </li>
        </ul>
        <p>
          Our emails (confirming your address, changing it, resetting your password, deleting your
          account) are sent by SendGrid, which receives your email address to deliver them.
        </p>
        <p>
          Your progress in today&apos;s puzzles stays in cookies in your browser, never on our side.
        </p>
      </Section>

      <Section title="Your location">
        <p>
          Your location is only used to show the weather, the public holidays and the news for where
          you are. We guess your city from your connection only if you say yes, and you can change
          that answer at any time in <SettingsLink>Settings & privacy</SettingsLink>. Until then,
          the dashboard uses Madrid, or the city you pick yourself.
        </p>
        <p>
          “Use my current location” asks your browser for your position once, saves it as your city,
          and counts as a yes.
        </p>
      </Section>

      <Section title="Cookies">
        <p>Every cookie we set is needed for the dashboard to work. None of them track you.</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Cookie</th>
                <th className="px-3 py-2 font-medium">What for</th>
                <th className="px-3 py-2 font-medium">Kept</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {COOKIES.map(([name, what, kept]) => (
                <tr key={name}>
                  <td className="px-3 py-2 font-mono text-xs">{name}</td>
                  <td className="px-3 py-2">{what}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{kept}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="The services behind the widgets">
        <p>
          Our server fetches the data for you, so these services see our server and never you, your
          address or your account:
        </p>
        <List items={SERVER_SIDE} />
        <p>A few things load straight in your browser, so their providers see your IP address:</p>
        <List items={BROWSER_SIDE} />
        <p>The app runs on Vercel, the database on Neon, and our emails go through SendGrid.</p>
      </Section>

      <Section title="How long">
        <p>
          Your account data stays until you delete your account. Cookies last a year at most, and
          you can clear them from your browser at any time.
        </p>
      </Section>

      <Section title="Your rights">
        <p>Under the GDPR you can at any time:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>see and change your settings and widgets</li>
          <li>
            change your name, username and email, in{" "}
            <SettingsLink hash="profile">Settings → Profile</SettingsLink>
          </li>
          <li>
            remove a saved API key or a connected account, in{" "}
            <SettingsLink hash="connections">Settings → Keys and connected accounts</SettingsLink>
          </li>
          <li>
            withdraw your location answer in <SettingsLink>Settings</SettingsLink>
          </li>
          <li>
            download your data, with “Download my data” in <SettingsLink>Settings</SettingsLink>
          </li>
          <li>
            delete your account in <SettingsLink>Settings</SettingsLink>, which deletes everything
            linked to it
          </li>
        </ul>
      </Section>
    </article>
  );
}

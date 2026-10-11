/** the privacy notice, shown at the bottom of settings & privacy and on its own at /privacy, the 1
 * page a visitor can read before registering. kept in plain words, and in sync w/
 * what the app actually stores and sends */

const UPDATED = "October 11, 2026";

// every cookie the app sets, kept in sync w/ server/location.ts and server/api/routes/games.ts
const COOKIES = [
  ["dash_location", "The city you picked, when you're not signed in", "1 year"],
  ["dash_location_consent", "Your answer to “guess my city from my connection?”", "1 year"],
  [
    "dash_game_wordle, dash_game_flags, dash_game_bee",
    "Your progress in today's puzzles",
    "1 year",
  ],
  ["dash_game_2048", "Your best 2048 score", "1 year"],
  ["Session cookie", "Keeps you signed in, once you have an account", "Until you sign out"],
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
            <span className="text-foreground font-medium">Your settings</span>: your city, your
            location answer, the text size and the theme.
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
        </ul>
        <p>Your game progress stays in cookies in your browser, never on our side.</p>
      </Section>

      <Section title="Your location">
        <p>
          Your location is only used to show the weather, the public holidays and the news for where
          you are. We guess your city from your connection only if you say yes, and you can change
          that answer at any time in Settings & privacy. Until then, the dashboard uses Madrid, or
          the city you pick yourself.
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
        <p>The app runs on Vercel and the database on Neon.</p>
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
          <li>change your name, username and email, in Profile above</li>
          <li>
            remove a saved API key or a connected account, in Keys and connected accounts above
          </li>
          <li>withdraw your location answer in Settings</li>
          <li>download your data, from the button above</li>
          <li>delete your account, which deletes everything linked to it</li>
        </ul>
      </Section>
    </article>
  );
}

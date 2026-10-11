/** the front half of the widget registry: which card renders each widget, in which dashboard section.
 * keyed "service/widget" like the server registry, so a saved widget maps straight to its card. a new
 * widget is 1 entry here + its defineWidget on the server */

import type { ExtraSettings } from "./instance-context";

import { BeeCard } from "./games/bee-card";
import { FlagCard } from "./games/flag-card";
import { Game2048Card } from "./games/game-2048-card";
import { WordleCard } from "./games/wordle-card";
import { NotificationsCard } from "./github/notifications-card";
import { ReposCard } from "./github/repos-card";
import { CryptoCard } from "./market/crypto-card";
import { CurrencyCard } from "./market/currency-card";
import { StockCard } from "./market/stock-card";
import { LiveTvCard } from "./news/live-tv-card";
import { NewsCard } from "./news/news-card";
import { NewsSettings } from "./news/news-settings";
import { WorldMapCard } from "./news/world-map-card";
import { HolidaysCard } from "./tools/holidays-card";
import { OnThisDayCard } from "./tools/on-this-day-card";
import { TranslatorCard } from "./tools/translator-card";
import { CurrentWeatherCard } from "./weather/current-weather-card";

export type SectionId = "utility" | "news" | "games";

// the dashboard sections, in order
export const SECTIONS: { id: SectionId; title: string; description: string; grid?: string }[] = [
  { id: "utility", title: "Utility", description: "Weather, markets and everyday tools" },
  {
    id: "news",
    title: "News",
    description: "What's happening, live, and the headlines you follow",
    // the map and live tv side by side on a wide screen, the headlines under them
    grid: "grid grid-cols-1 items-start gap-4 lg:grid-cols-5",
  },
  {
    id: "games",
    title: "Games",
    description: "Daily puzzles, the same for everyone, new ones at midnight UTC",
  },
];

// what a card gets from the dashboard. onChange saves a change made inside the card (a heart, a
// currency) to the user's widget, a no-op when nobody is signed in
type Ctx = { locationKey: string; onChange: (patch: Record<string, unknown>) => void };
// the saved options, already parsed by the widget schema on the server
type P = Record<string, unknown>;

type CardDef = {
  section: SectionId;
  // grid placement inside its section, like "lg:col-span-3"
  className?: string;
  // options the card has its own control for, the settings window leaves them out
  notInSettings?: readonly string[];
  ExtraSettings?: ExtraSettings;
  render: (params: P, ctx: Ctx) => React.ReactNode;
};

const str = (v: unknown) => v as string;
const num = (v: unknown) => v as number;
const bool = (v: unknown) => v as boolean;

export const CARDS: Record<string, CardDef> = {
  "weather/current_weather": {
    section: "utility",
    render: (p, { locationKey }) => (
      <CurrentWeatherCard
        city={str(p.city)}
        units={p.units as "metric" | "imperial"}
        showWind={bool(p.show_wind)}
        days={num(p.days)}
        locationKey={locationKey}
      />
    ),
  },
  "market/stock_watchlist": {
    section: "utility",
    notInSettings: ["tickers"],
    render: (p, { onChange }) => (
      <StockCard
        tickers={str(p.tickers)}
        change={p.change as "percent" | "amount"}
        onChange={onChange}
      />
    ),
  },
  "currencies/crypto_prices": {
    section: "utility",
    notInSettings: ["coins"],
    render: (p, { onChange }) => (
      <CryptoCard
        coins={str(p.coins)}
        currency={p.currency as "usd" | "eur" | "gbp"}
        onChange={onChange}
      />
    ),
  },
  "currencies/currency_converter": {
    section: "utility",
    notInSettings: ["from", "to", "amount"],
    render: (p, { onChange }) => (
      <CurrencyCard from={str(p.from)} to={str(p.to)} amount={num(p.amount)} onChange={onChange} />
    ),
  },
  "github/notifications": {
    section: "utility",
    render: (p) => (
      <NotificationsCard count={num(p.count)} onlyParticipating={bool(p.only_participating)} />
    ),
  },
  "github/repositories": {
    section: "utility",
    render: (p) => (
      <ReposCard count={num(p.count)} sort={p.sort as "pushed" | "created" | "full_name"} />
    ),
  },
  "tools/public_holidays": {
    section: "utility",
    render: (p, { locationKey }) => (
      <HolidaysCard country={str(p.country)} count={num(p.count)} locationKey={locationKey} />
    ),
  },
  "tools/translator": {
    section: "utility",
    notInSettings: ["from", "to"],
    render: (p, { onChange }) => (
      <TranslatorCard
        from={p.from as Parameters<typeof TranslatorCard>[0]["from"]}
        to={p.to as Parameters<typeof TranslatorCard>[0]["to"]}
        onChange={onChange}
      />
    ),
  },
  "tools/on_this_day": {
    section: "utility",
    notInSettings: ["type"],
    render: (p, { onChange }) => (
      <OnThisDayCard
        type={p.type as Parameters<typeof OnThisDayCard>[0]["type"]}
        count={num(p.count)}
        language={p.language as Parameters<typeof OnThisDayCard>[0]["language"]}
        onChange={onChange}
      />
    ),
  },
  // the news section is a 5 column grid on wide screens: map 3, live tv 2, headlines the full row
  "news/world_events": {
    section: "news",
    className: "lg:col-span-3",
    notInSettings: ["window"],
    render: (p, { onChange }) => (
      <WorldMapCard
        range={p.window as "day" | "week"}
        minMagnitude={num(p.min_magnitude)}
        showNatural={bool(p.show_natural)}
        onChange={onChange}
      />
    ),
  },
  "news/live_tv": {
    section: "news",
    // as tall as the player, not stretched to the map's height
    className: "lg:col-span-2 h-auto",
    notInSettings: ["channel"],
    render: (p, { onChange }) => <LiveTvCard channel={str(p.channel)} onChange={onChange} />,
  },
  "news/headlines": {
    section: "news",
    className: "lg:col-span-5",
    // the news settings section renders these: topics and keywords as chips, country and language
    // from short lists
    notInSettings: ["topics", "keywords", "country", "language"],
    ExtraSettings: NewsSettings,
    render: (p, { locationKey }) => (
      <NewsCard
        topics={str(p.topics)}
        keywords={str(p.keywords)}
        country={str(p.country)}
        language={p.language as string | undefined}
        count={p.count as number | undefined}
        locationKey={locationKey}
      />
    ),
  },
  "games/wordle": {
    section: "games",
    render: (p) => <WordleCard length={num(p.length)} hardMode={bool(p.hard_mode)} />,
  },
  "games/flag_guesser": {
    section: "games",
    render: (p) => <FlagCard tries={num(p.tries)} hints={bool(p.hints)} />,
  },
  "games/spelling_bee": {
    section: "games",
    render: (p) => <BeeCard minLength={num(p.min_length)} />,
  },
  "games/game_2048": {
    section: "games",
    render: (p) => (
      <Game2048Card size={num(p.size)} target={p.target as "1024" | "2048" | "4096"} />
    ),
  },
};

export const cardKey = (serviceId: string, widgetId: string) => `${serviceId}/${widgetId}`;

/** the log in and register background: real widget cards, rendered once from the app (public/auth-wall),
 * in tilted columns drifting up and down. a light and a dark set, the browser only loads the one
 * of the theme (lazy images in a display none set never load). still for reduced motion, and left
 * out on phones where the form takes the screen. no github cards, the page is public */

const CARDS = [
  "weather",
  "stocks",
  "crypto",
  "currency",
  "holidays",
  "translator",
  "on-this-day",
  "world-map",
  "live-tv",
  "wordle",
  "flags",
  "spelling-bee",
  "2048",
];

// 10 columns of 6 cards, enough to reach the edges of a wide screen once tilted. each column
// starts further down the list so no 2 neighbours match
const COLUMNS = Array.from({ length: 10 }, (_, c) =>
  Array.from({ length: 6 }, (_, i) => CARDS[(c * 4 + i * 2) % CARDS.length]),
);

/* eslint-disable @next/next/no-img-element -- already sized webp, decorative, the optimizer would only
   proxy them */
function Card({ name }: { name: string }) {
  return (
    <>
      <img src={`/auth-wall/light/${name}.webp`} alt="" loading="lazy" className="dark:hidden" />
      <img
        src={`/auth-wall/dark/${name}.webp`}
        alt=""
        loading="lazy"
        className="hidden dark:block"
      />
    </>
  );
}

export function WidgetWall() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block"
    >
      <div className="auth-wall">
        {COLUMNS.map((cards, c) => (
          // each column its own speed, 38 to 74 s a loop, so they never move in step
          <div
            key={c}
            className="auth-wall-col"
            style={{ "--wall-loop": `${38 + (c % 7) * 6}s` } as React.CSSProperties}
          >
            {/* the cards twice, the loop goes back to the start where the 2nd copy began */}
            <div className="auth-wall-track">
              {[...cards, ...cards].map((name, i) => (
                <Card key={i} name={name} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="auth-wall-dim" />
    </div>
  );
}

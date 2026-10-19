# world of scorsby

the front door of scorsby.us: a small planet with ears, where everyone here is a scorsby. the rest of the site (peace, love, joy, the books, the experiments) lives behind it as before; the world is `home.html`; `index.html` just walks you there. the previous home page and landing page are archived as `archive/home_24cell.html` and `archive/index_champ.html`.

- **the world is scorsby.** a planet the color of everyone living on it (everyone arrives classic blue, so it starts classic blue), drawn in the logo's own proportions, with a living face. its eyes follow you; when it blinks, its closed eyes are smiles (like `scorsbyface_big_blink.png`). every few seconds it becomes something stranger: a grin, teeth, a tongue, an O, a wink, kissing lips, odd eyes, melting, many eyes, heart eyes, cyclops, crossed eyes, a blush, eyes on stalks, eyes orbiting its nose, a scramble with its mouth on its forehead, upside down, tears, a mustache, tall, spinning, a third eye. its mood follows the crowd: alone it looks around and gets shy, with friends it grins. tap its nose to honk; tap an eye and it winks. **pull its features** like the face on the mario 64 title screen: eyes, nose, mouth, ears (and antennae, when it has them) stretch like taffy and spring back. the face fades as you zoom in, gone by the second zoom.
- **you are a scorsby.** a blinking face on the world near where you are (rounded to ~100 km and jittered). drag yourself anywhere. in **you.exe** pick a color (or any color, with the eyedropper) and a name: hover over anyone to see "plonko scorsby".
- **♥ love everyone** (or hold your own face): a rainbow rolls over the whole world, land and sea, then ripples out across the universe. every scorsby gets heart eyes. plus one bonus each time: a heart fountain, sparkles, confetti of tiny scorsbys, or a flight of angel eyes.
- **touch the world or another scorsby** and a ring of hearts rolls out. it is contagious: every scorsby it reaches sends out its own.
- **holding hands**: scorsbys close together reach out; where their hands meet is a heart in a mix of both their colors.
- **the world sings along**: when two or more people sing, it opens its mouth and hums the note between them. your mic is analysed on your device; only pitch and loudness travel.
- **plant.exe**: plant a cactus, blue flower, tree, house, mushroom, heart, scorsby pyramid, eye, lips or scorsby. everyone sees it when they zoom in, for six hours.
- **love today / record**: each love for everyone counts one point, plus one for every scorsby you're holding hands with. the hearth keeps the count each day (albuquerque time) and remembers the best day, shown in rainbow letters.
- **the sky**: angel eyes with white feathered wings and halos, lips, scorsbys on springs, a golden bell that rings out loud, an umbrella scorsby, and friends from the books: yolksby, blocksby, the many-eyed one, the dreamer bug. **sunsby** sits where the light comes from; **moonsby** orbits and sleeps (tap to wake it).
- **omens** every minute or two, for everyone at once: moonsby hugging sunsby, a flock of glongingstons, a sneeze, raining hearts, a colorstorm, unison, ears, the heartstar rising, the third eye, raining gold, wings.
- **whispers** type themselves in above the world: what's happening, lines from the blog (click to read the post), sayings from the books, and the scorsby times.
- **peace · love · joy · shop** lead to the blog, the works, the about page and shop.scorsby.us. **join the dream district** opens the discord.
- **white paper**, with color blooming only when something happens. night on the world is ballpoint cross-hatching.

the header uses **Scheme** if it's installed, or if you drop `Scheme.woff2` / `.otf` / `.ttf` into `fonts/`.

no cookies, no analytics, no accounts. the hearth forgets you the moment you leave.

## how it's built

- `home.html`, `heartstar/heartstar.js`, `heartstar/heartstar.css`: the world itself (github pages); `index.html` redirects to it
- `heartstar/land.js`: 6,866 dots of land, built by `tools/build_land.mjs`
- `heartstar/quotes.js`: lines from the blog, built by `python tools/build_quotes.py` (run it after new posts)
- `hearth/`: a cloudflare worker with one durable object. it holds who is here in memory, relays love, blinks, pokes and songs over websockets, rate-limits everything, and stores only daily love counts, the last 24 hours of fuzzy points where love for everyone came from, and markers for six hours.

### run it locally

```bash
cd hearth && npm install && npx wrangler dev --port 8787
```

then serve the repo root (e.g. `python -m http.server 8642`) and open `http://127.0.0.1:8642/`. open a second tab to be two scorsbys. `?dream=6` adds six imaginary scorsbys to keep you company. `?debug` exposes `window.heartstar`.

### deploy the hearth (and preview the whole site on cloudflare)

1. from `hearth/`: `npx wrangler login` once, then `npx wrangler deploy` (or connect this repo in the cloudflare dashboard: workers & pages → create → import a repository)
2. worker name `scorsby-hearth`, **root directory** `hearth`, deploy command `npx wrangler deploy`
3. the worker serves the whole site and the hearth at `https://scorsby-hearth.samrobertsbaca.workers.dev` (what it leaves out is in `.assetsignore`)
4. for github pages / scorsby.us, put the worker's address in `home.html`: `<meta name="hearth" content="wss://scorsby-hearth.<your-subdomain>.workers.dev/hearth">`

running the hearth locally on windows: give it a short state path, e.g. `npx wrangler dev --persist-to C:/Users/<you>/AppData/Local/hearthdev` (long paths break its storage).

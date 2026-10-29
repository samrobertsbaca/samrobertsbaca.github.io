// the chance trigger: the clock for Impermanence Series A. every hour it looks at the time in mountain time.
// every hour it asks GitHub to listen to the world for a while (about fifteen moments of radio, kept for the
// evening); at 9 pm it asks for tomorrow's album to be made from the day's listening (it then waits, unheard,
// as a draft); at midnight it asks for the album that was waiting to be released. GitHub's own schedule is
// the backup.

const REPO = 'samrobertsbaca/samrobertsbaca.github.io';
const WORKFLOW = 'daily_chance.yml';
const CLOSE = 21;   // 9 pm: the day's listening ends and the album is made, in good time for midnight

// the day and hour in mountain time (daylight or standard, as it falls)
function mountain(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

function nextDay(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// the album an hour's listening is for: the one released at the coming midnight, or, from 9 pm, the one after
function listeningFor(day, hour) {
  return hour < CLOSE ? nextDay(day) : nextDay(nextDay(day));
}

async function ask(env, inputs) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'scorsby-chance-trigger',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs }),
  });
  const what = `${inputs.mode} ${inputs.day}${inputs.hour ? ` (${inputs.hour}:00)` : ''}`;
  if (!r.ok) throw new Error(`GitHub said ${r.status} to "${what}": ${await r.text()}`);
  console.log(`asked GitHub to ${what}`);
}

export default {
  async scheduled(controller, env) {
    const { day, hour } = mountain(new Date(controller.scheduledTime));
    const asks = [];
    if (hour === 0) asks.push({ mode: 'release', day });                          // midnight: today's album comes out
    if (hour === CLOSE) asks.push({ mode: 'compose', day: nextDay(day) });        // 9 pm: tomorrow's is made
    asks.push({ mode: 'gather', day: listeningFor(day, hour), hour: String(hour) });   // and every hour, a listen
    const failed = [];
    for (const a of asks) {                     // one failing doesn't stop the others
      try { await ask(env, a); } catch (e) { failed.push(e.message); }
    }
    if (failed.length) throw new Error(failed.join('; '));
  },

  // a glance at the clock, nothing more (no secrets): what this hour's listening is for
  async fetch() {
    const { day, hour } = mountain(new Date());
    const album = listeningFor(day, hour);
    return new Response(
      `it is ${day}, ${hour}:00 mountain time.\n` +
      `this hour the world is listened to for the album that comes out at midnight on ${album}; ` +
      `its day of listening ends at 9 pm the night before, when the album is made.\n`,
      { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};

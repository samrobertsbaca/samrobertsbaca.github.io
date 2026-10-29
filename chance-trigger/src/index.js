// the chance trigger: the clock for Impermanence Series A. every hour it looks at the time in mountain time.
// at the day's chance hour it asks GitHub to make tomorrow's album (it then waits, unheard, as a draft);
// at midnight it asks GitHub to release the album that was waiting. GitHub's own schedule is the backup.

const REPO = 'samrobertsbaca/samrobertsbaca.github.io';
const WORKFLOW = 'daily_chance.yml';
const LATEST_HOUR = 20;   // the album is begun by 8 pm at the latest, so it is surely ready for midnight

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

// the hour (0-20) the world is listened to on a given day: drawn by chance from the date itself, so it
// can't drift, and no one chooses it
async function chanceHour(day) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`scorsbt4 listens ${day}`));
  return new Uint8Array(h)[0] % (LATEST_HOUR + 1);
}

async function ask(env, mode, day) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'scorsby-chance-trigger',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { mode, day } }),
  });
  if (!r.ok) throw new Error(`GitHub said ${r.status} to "${mode} ${day}": ${await r.text()}`);
  console.log(`asked GitHub to ${mode} the album for ${day}`);
}

export default {
  async scheduled(controller, env) {
    const { day, hour } = mountain(new Date(controller.scheduledTime));
    if (hour === 0) await ask(env, 'release', day);                        // midnight: today's album comes out
    if (hour === await chanceHour(day)) await ask(env, 'make', nextDay(day));   // tomorrow's is made now
  },

  // a glance at the clock, nothing more (no secrets): when today's listening happens
  async fetch() {
    const { day, hour } = mountain(new Date());
    const h = await chanceHour(day);
    return new Response(
      `it is ${day}, ${hour}:00 mountain time.\n` +
      `today the world is listened to at ${h}:00; that album comes out at midnight, on ${nextDay(day)}.\n`,
      { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};

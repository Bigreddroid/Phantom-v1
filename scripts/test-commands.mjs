/**
 * Phantom Bot Command Tester
 * Fires every command at the live webhook and reports results.
 * Run: node scripts/test-commands.mjs
 */

const WEBHOOK = "https://phantom-beige.vercel.app/api/telegram";
const BOT_TOKEN = "8393530168:AAEvro4Pctj0z9gmE_QTS1Tc05yKfk8DqBQ";
const CHAT_ID = "6061651803";

const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const YELLOW= "\x1b[33m";
const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";

let msgId = 9000;

async function sendCommand(text, label) {
  const payload = {
    message: {
      message_id: msgId++,
      from: { id: Number(CHAT_ID), first_name: "Varun", is_bot: false },
      chat: { id: Number(CHAT_ID), type: "private" },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };

  const start = Date.now();
  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    return { ok: res.status === 200 && body.ok !== false, status: res.status, elapsed, body };
  } catch (e) {
    return { ok: false, status: 0, elapsed: Date.now() - start, error: String(e) };
  }
}

async function tgSend(text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  }).catch(() => null);
}

// Commands to test — [command, display label, skip real-action?]
const COMMANDS = [
  // ── Safe read-only ────────────────────────────────────────────────────────
  ["/help",                   "help",            false],
  ["/status",                 "status",          false],
  ["/activity",               "activity",        false],
  ["/queue",                  "queue",           false],
  ["/schedule",               "schedule",        false],
  ["/setup",                  "setup",           false],
  // ── Content generation (Claude) ───────────────────────────────────────────
  ["/tweet",                  "tweet (menu)",    false],
  ["/thread",                 "thread (menu)",   false],
  ["/article",                "article (random topic)", false],
  ["/article Claude AI tips for founders", "article (custom topic)", false],
  ["/resurface",              "resurface",       false],
  ["/rt AI automation",       "rt keyword",      false],
  // ── Engagement (X API) ────────────────────────────────────────────────────
  ["/engage",                 "engage",          false],
  ["/topic building in public","topic keyword",  false],
  ["/goout",                  "goout",           false],
  ["/mentions",               "mentions",        false],
  ["/inbox",                  "inbox",           false],
  ["/follow",                 "follow",          false],
  // ── Manual post ──────────────────────────────────────────────────────────
  ["/post TEST — ignore this tweet from Phantom bot testing", "post (manual)", false],
  ["/blast TEST — ignore this blast from bot testing", "blast",           false],
  // ── LinkedIn ─────────────────────────────────────────────────────────────
  ["/linkedin",               "linkedin (menu)", false],
  // ── Utility ──────────────────────────────────────────────────────────────
  ["/dm @test context: just testing bot",  "dm",        false],
  ["/blacklist testbot999",   "blacklist",       false],
  ["/test",                   "test (X connectivity)", false],
  // ── Control ──────────────────────────────────────────────────────────────
  ["/pause",                  "pause",           false],
  ["/resume",                 "resume",          false],
];

async function main() {
  console.log(`\n${BOLD}Phantom Bot — Command Test Suite${RESET}`);
  console.log(`Webhook: ${WEBHOOK}`);
  console.log(`Commands to test: ${COMMANDS.length}\n`);
  console.log("─".repeat(60));

  await tgSend(`🧪 Starting command test suite — ${COMMANDS.length} commands. Check responses below.`);

  const results = [];
  for (const [cmd, label] of COMMANDS) {
    process.stdout.write(`  ${label.padEnd(30)} `);
    const r = await sendCommand(cmd, label);
    results.push({ cmd, label, ...r });

    if (r.ok) {
      console.log(`${GREEN}✓ ${r.status} (${r.elapsed}ms)${RESET}`);
    } else {
      const detail = r.error ?? JSON.stringify(r.body).slice(0, 80);
      console.log(`${RED}✗ ${r.status} (${r.elapsed}ms) — ${detail}${RESET}`);
    }
    // Pause between commands so the bot isn't flooded
    await new Promise(r => setTimeout(r, 2500));
  }

  // Summary
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log("\n" + "─".repeat(60));
  console.log(`${BOLD}Results: ${GREEN}${passed} passed${RESET}${BOLD}, ${failed.length > 0 ? RED : GREEN}${failed.length} failed${RESET}`);

  if (failed.length > 0) {
    console.log(`\n${BOLD}${RED}Failed commands:${RESET}`);
    for (const f of failed) {
      console.log(`  ${RED}✗ ${f.label}${RESET} — ${f.error ?? JSON.stringify(f.body).slice(0, 120)}`);
    }
  }

  const summary = passed === results.length
    ? `✅ All ${passed} commands passed webhook delivery.`
    : `⚠️ ${passed}/${results.length} passed. Failed: ${failed.map(f => f.label).join(", ")}`;
  await tgSend(`🧪 Test complete.\n\n${summary}\n\nCheck above for bot responses to each command.`);

  console.log("\n✅ Summary sent to Telegram.\n");
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

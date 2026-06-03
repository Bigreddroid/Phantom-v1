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

// Commands to test — [command, display label]
const COMMANDS = [
  // ── Safe read-only ────────────────────────────────────────────────────────
  ["/help",                   "help"],
  ["/status",                 "status"],
  ["/activity",               "activity"],
  ["/queue",                  "queue"],
  ["/schedule",               "schedule"],
  ["/setup",                  "setup"],
  // ── Content generation (Claude) ───────────────────────────────────────────
  ["/tweet",                  "tweet (menu)"],
  ["/thread",                 "thread (menu)"],
  ["/article",                "article (random topic)"],
  ["/article Claude AI tips for founders", "article (custom topic)"],
  ["/resurface",              "resurface"],
  ["/rt AI automation",       "rt keyword"],
  // ── Engagement (X API) ────────────────────────────────────────────────────
  ["/engage",                 "engage"],
  ["/topic building in public","topic keyword"],
  ["/goout",                  "goout"],
  ["/mentions",               "mentions"],
  ["/inbox",                  "inbox"],
  ["/follow",                 "follow"],
  // ── Manual post ──────────────────────────────────────────────────────────
  ["/post BOT-TEST ignore", "post (manual)"],
  ["/blast BOT-TEST ignore", "blast"],
  // ── LinkedIn ─────────────────────────────────────────────────────────────
  ["/linkedin",               "linkedin (menu)"],
  // ── Utility ──────────────────────────────────────────────────────────────
  ["/dm @test context: testing", "dm"],
  ["/blacklist testbot999",   "blacklist"],
  ["/test",                   "test (X connectivity)"],
  // ── Control ──────────────────────────────────────────────────────────────
  ["/pause",                  "pause"],
  ["/resume",                 "resume"],
];

async function sendCallback(data, label) {
  const payload = {
    callback_query: {
      id: String(msgId++),
      from: { id: Number(CHAT_ID), first_name: "Varun", is_bot: false },
      message: {
        message_id: msgId++,
        chat: { id: Number(CHAT_ID), type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "test",
      },
      data,
    },
  };
  const start = Date.now();
  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    return { ok: res.status === 200, status: res.status, elapsed, body };
  } catch (e) {
    return { ok: false, status: 0, elapsed: Date.now() - start, error: String(e) };
  }
}

async function main() {
  console.log(`\n${BOLD}Phantom Bot — Full Test Suite${RESET}`);
  console.log(`Webhook: ${WEBHOOK}\n`);
  console.log("─".repeat(60));

  await tgSend(`🧪 Starting full test — ${COMMANDS.length} commands + image style callbacks`);

  const results = [];

  // ── Phase 1: Commands ─────────────────────────────────────────────────────
  console.log(`\n${BOLD}Phase 1: Commands (${COMMANDS.length})${RESET}`);
  for (const [cmd, label] of COMMANDS) {
    process.stdout.write(`  ${label.padEnd(35)} `);
    const r = await sendCommand(cmd, label);
    results.push({ label, ...r });
    if (r.ok) {
      console.log(`${GREEN}✓ ${r.status} (${r.elapsed}ms)${RESET}`);
    } else {
      console.log(`${RED}✗ ${r.status} (${r.elapsed}ms) — ${r.error ?? JSON.stringify(r.body).slice(0, 60)}${RESET}`);
    }
    await new Promise(r => setTimeout(r, 2500));
  }

  // ── Phase 2: Image style picker flow ─────────────────────────────────────
  console.log(`\n${BOLD}Phase 2: Image styles — tweet_image callback + all 6 styles${RESET}`);
  await tgSend("🎨 Testing image style picker...");

  // Trigger tweet_image to create a pending item and get the style picker
  const tweepImgResult = await sendCallback("tweet_image:", "tweet_image callback");
  process.stdout.write(`  ${"tweet_image (generate + style picker)".padEnd(35)} `);
  if (tweepImgResult.ok) {
    console.log(`${GREEN}✓ ${tweepImgResult.status} (${tweepImgResult.elapsed}ms)${RESET}`);
  } else {
    console.log(`${RED}✗ ${tweepImgResult.elapsed}ms${RESET}`);
  }
  results.push({ label: "tweet_image callback", ...tweepImgResult });
  await new Promise(r => setTimeout(r, 8000)); // wait for tweet to generate

  // Fetch the latest pending item to get its ID for style testing
  const pendingRes = await fetch(`https://phantom-beige.vercel.app/api/queue`, {
    headers: { "Authorization": `Bearer d67ac898555ced8eb7052213daa508b04b61232479b8c7478839a2823d488b8e` }
  }).catch(() => null);

  let testItemId = null;
  if (pendingRes?.ok) {
    const data = await pendingRes.json().catch(() => ({}));
    testItemId = data?.items?.[0]?.id ?? null;
  }

  if (testItemId) {
    for (const style of ["dark", "light", "branded", "article", "data", "auto"]) {
      process.stdout.write(`  ${"img_style:" + style + " callback".padEnd(35)} `);
      const r = await sendCallback(`img_style:${style}:${testItemId}`, `img_style:${style}`);
      results.push({ label: `img_style:${style}`, ...r });
      if (r.ok) {
        console.log(`${GREEN}✓ ${r.status} (${r.elapsed}ms)${RESET}`);
      } else {
        console.log(`${RED}✗ ${r.elapsed}ms${RESET}`);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    // Clean up: reject the test item
    await sendCallback(`reject:${testItemId}`, "reject test item");
  } else {
    console.log(`  ${YELLOW}⚠ Could not fetch pending item ID — skipping style sub-tests${RESET}`);
  }

  // ── Phase 3: Thread image styles ──────────────────────────────────────────
  console.log(`\n${BOLD}Phase 3: Thread image menu callbacks${RESET}`);
  for (const [cb, label] of [["tweet_plain:", "tweet_plain"], ["thread_plain:", "thread_plain"], ["thread_img_first:", "thread_img_first"], ["thread_img_all:", "thread_img_all"], ["tweet_image_only:", "tweet_image_only"]]) {
    process.stdout.write(`  ${label.padEnd(35)} `);
    const r = await sendCallback(cb, label);
    results.push({ label, ...r });
    if (r.ok) {
      console.log(`${GREEN}✓ ${r.status} (${r.elapsed}ms)${RESET}`);
    } else {
      console.log(`${RED}✗ ${r.elapsed}ms${RESET}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log("\n" + "─".repeat(60));
  console.log(`${BOLD}Results: ${GREEN}${passed} passed${RESET}${BOLD}, ${failed.length > 0 ? RED : GREEN}${failed.length} failed${RESET}`);
  if (failed.length) {
    console.log(`\n${RED}${BOLD}Failed:${RESET}`);
    for (const f of failed) console.log(`  ${RED}✗ ${f.label}${RESET} — ${f.error ?? ""}`);
  }

  const summary = passed === results.length
    ? `✅ All ${passed}/${results.length} tests passed.`
    : `⚠️ ${passed}/${results.length} passed. Failed: ${failed.map(f => f.label).join(", ")}`;
  await tgSend(`🧪 Full test complete.\n\n${summary}`);
  console.log("\n✅ Done.\n");
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

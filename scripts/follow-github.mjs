// Key people to follow in AI, automation, founders, Next.js, open source
const toFollow = [
  // AI / LLM
  "karpathy",       // Andrej Karpathy
  "simonw",         // Simon Willison
  "yoheinakajima",  // BabyAGI / agent pioneer
  "hwchase17",      // LangChain
  "ggerganov",      // llama.cpp

  // Vercel / Next.js
  "rauchg",         // Vercel CEO
  "leerob",         // Vercel VP
  "shadcn",         // shadcn/ui
  "timer",          // Next.js core
  "shuding",        // Vercel

  // Indie hackers / building in public
  "levelsio",       // Pieter Levels

  // Anthropic
  "anthropics",

  // Notable open source devs
  "sindresorhus",
  "antfu",          // Anthony Fu
  "gaearon",        // Dan Abramov
  "kentcdodds",
  "evan-you",       // Vue creator
  "nicolo-ribaudo",

  // Founders / builders
  "dhh",            // Rails / 37signals
  "torvalds",       // Linux

  // Supabase
  "kiwicopple",     // Supabase CEO
  "soedirgo",
];

const token = process.env.GITHUB_TOKEN;

let followed = 0;
let failed = 0;

for (const username of toFollow) {
  try {
    const res = await fetch(`https://api.github.com/user/following/${username}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.status === 204) {
      console.log(`✅ Following ${username}`);
      followed++;
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`⚠️  ${username}: ${res.status} — ${data.message ?? ""}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${username}: ${e.message}`);
    failed++;
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n✅ Followed: ${followed} | ⚠️ Failed: ${failed}`);

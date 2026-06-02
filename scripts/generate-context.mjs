import PDFDocument from "pdfkit";
import fs from "fs";

const doc = new PDFDocument({ margin: 50, size: "A4" });
doc.pipe(fs.createWriteStream("context.pdf"));

const h1 = (text) => doc.fontSize(22).font("Helvetica-Bold").fillColor("#000").text(text).moveDown(0.5);
const h2 = (text) => doc.fontSize(15).font("Helvetica-Bold").fillColor("#222").text(text).moveDown(0.3);
const h3 = (text) => doc.fontSize(12).font("Helvetica-Bold").fillColor("#444").text(text).moveDown(0.2);
const p  = (text) => doc.fontSize(10).font("Helvetica").fillColor("#333").text(text, { lineGap: 4 }).moveDown(0.3);
const li = (text) => doc.fontSize(10).font("Helvetica").fillColor("#333").text(`• ${text}`, { lineGap: 3 });
const divider = () => doc.moveDown(0.5).moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ccc").stroke().moveDown(0.5);

// HEADER
doc.fontSize(28).font("Helvetica-Bold").fillColor("#000").text("PHANTOM", { align: "center" });
doc.fontSize(12).font("Helvetica").fillColor("#666").text("Project Context & Build Log", { align: "center" });
doc.fontSize(10).fillColor("#999").text("Generated: June 2, 2026", { align: "center" });
doc.moveDown(1.5);
divider();

// THE IDEA
h1("The Big Idea — Project Z");
p("Project Z is a platform housing 90+ AI-powered automation services, each built for a specific niche audience. The strategy: launch one focused product per niche, validate traction independently, then consolidate everything into a single unified platform.");
p("Think how HubSpot started with just email tools, or how Atlassian built Jira before the suite. Each niche product is both a revenue stream and a validation signal.");
doc.moveDown(0.5);

h2("The Platform Strategy");
li("Phase 1 — Pick 1 niche. Go deep. Get 10 paying customers.");
li("Phase 2 — Pick 2nd niche. Reuse 80% of the infra. Get 10 more.");
li("Phase 3 — By niche #5, a pattern emerges. That pattern = the platform.");
p("The platform isn't built — it emerges from the pattern across niches.");
doc.moveDown(0.5);

// FIRST PRODUCT — PHANTOM
divider();
h1("First Product: Phantom");
p("Niche: Personal brand + lead gen automation on autopilot → for founders & creators");
p("The insight: Founders know their personal brand should generate leads — but it doesn't, because they don't have time to be consistent. Phantom is personal brand infrastructure as a service.");

doc.moveDown(0.3);
h2("The 3-Layer Stack");
li("Layer 1 — STORY: Positioning, narrative, content pillars");
li("Layer 2 — CONTENT: AI-assisted creation + publishing on autopilot");
li("Layer 3 — SYSTEMS: Lead capture → follow-up → booked calls");
doc.moveDown(0.5);

h2("Service Model");
li("DFY (Done For You) — retainer model for founders who want to not think about it");
li("Eventually: self-serve platform for those who can't afford DFY but want the systems");
li("Pricing target: $500–1,000/month per client");
doc.moveDown(0.5);

h2("Distribution Strategy");
li("Step 1 — Build for self first. Your own X account is the MVP.");
li("Step 2 — Open source the core on GitHub (open-core model like Cal.com, Supabase)");
li("Step 3 — Build in public on X — every GitHub push auto-posts a thread");
li("Step 4 — LinkedIn is where you close. Pitch founders with your own results as proof.");
p("The system is literally posting about itself being built. You're not just selling automation — you're proving it works in public, automatically, while building it.");
doc.moveDown(0.5);

// X AUTOMATION
divider();
h1("X (Twitter) Automation — Full Feature Set");

h2("Posting");
li("Original tweets in your voice (AI-generated from content pillars)");
li("Threads on topics you care about");
li("Quote tweets with commentary");
li("Scheduled at peak hours, varied timing so it feels human");
doc.moveDown(0.3);

h2("Engagement");
li("Auto-like tweets from target accounts in your niche");
li("Reply to tweets from relevant people (thoughtful, not generic)");
li("Retweet with commentary");
li("Jump into trending conversations in your niche");
doc.moveDown(0.3);

h2("Networking");
li("Follow relevant accounts automatically (founders, creators, your niche)");
li("DM new followers with a warm intro");
li("Follow up with people who engage with your tweets");
li("Cold DM outreach to potential leads/collaborators");
doc.moveDown(0.3);

h2("Mentions & Replies");
li("Reads every mention → Claude drafts reply → posts or queues for approval");
li("Never leaves a mention unanswered");
doc.moveDown(0.3);

h2("Intelligence Layer");
li("Learns which content gets the most engagement");
li("Doubles down on what works");
li("Avoids repetitive patterns that feel bot-like");
li("Randomizes timing and tone variation");
doc.moveDown(0.3);

h2("Approval Gate (Telegram)");
li("Anything sensitive → Telegram for your approval");
li("Everything routine → fully automatic");
li("One-tap Approve / Edit / Reject from your phone");
doc.moveDown(0.5);

// TECH STACK
divider();
h1("Tech Stack");
h2("Core");
li("Next.js 16 (App Router) — frontend + API routes");
li("TypeScript — type safety throughout");
li("Tailwind CSS — styling");
li("Prisma 7 — ORM");
li("Supabase (PostgreSQL) — database");
doc.moveDown(0.3);

h2("Integrations");
li("X API v2 (OAuth 1.0a + 2.0) — twitter-api-v2 library");
li("Anthropic Claude API (claude-sonnet-4-6) — content generation & reasoning");
li("Telegram Bot API — approval notifications");
li("Make.com — automation workflows (future)");
doc.moveDown(0.3);

h2("Infrastructure");
li("Vercel — hosting (main → production, staging → preview)");
li("GitHub — version control + open source");
li("3 environments: development / staging / production");
doc.moveDown(0.5);

// WHAT WE BUILT
divider();
h1("What's Been Built (Session 1)");
li("Next.js 16 app scaffolded at C:\\Users\\Varun\\project Z\\phantom");
li("Prisma initialized + connected to Supabase (phantom-dev project)");
li("3-environment setup: .env.local / .env.staging / .env.production");
li("Git repo: main (prod) / staging / dev/setup branches");
li("All API credentials configured in .env.local");
li("X API fully tested — auth, read, post, delete all working");
li("Telegram approval bot live — @phantomioBot connected");
li("Database connection live — Supabase PostgreSQL");
doc.moveDown(0.5);

h2("Credentials Set Up");
li("X API: OAuth 1.0a (Consumer Key, Access Token) + OAuth 2.0 (Client ID, Secret)");
li("Anthropic API: Claude API key configured");
li("Telegram: @phantomioBot token + Chat ID 6061651803");
li("Supabase: phantom-dev project, PostgreSQL connected");
doc.moveDown(0.5);

// NEXT STEPS
divider();
h1("What's Next");
li("Build the X automation engine (posting, engagement, networking, DMs)");
li("Build the Claude content generation pipeline (voice training, content pillars)");
li("Build the Telegram approval system (inline keyboards, approve/reject/edit)");
li("Build the scheduling system (cron jobs, peak-hour posting)");
li("Push to GitHub (public repo for open-source traction)");
li("Deploy to Vercel (production + staging)");
li("Build the landing page (phantom.so)");
li("Get first client");
doc.moveDown(0.5);

// FIRST DECISION
divider();
h1("First Decision Made");
doc.fontSize(13).font("Helvetica-Bold").fillColor("#000")
  .text("Start with the personal brand niche — build Phantom for yourself first.", { lineGap: 6 });
p("Your own @BigRedDr0id account on X is the MVP and the live demo. The results you generate for yourself become the case study that sells it to clients on LinkedIn.");

doc.moveDown(1);
divider();
doc.fontSize(9).font("Helvetica").fillColor("#999").text("Phantom — Project Z | Context generated June 2, 2026", { align: "center" });

doc.end();
console.log("✅ context.pdf generated");

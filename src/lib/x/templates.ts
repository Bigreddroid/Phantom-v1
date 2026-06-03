import fs from "fs";
import path from "path";

// Map content keywords → preferred template filenames (partial match)
const TOPIC_TEMPLATES: Array<{ keywords: string[]; files: string[] }> = [
  {
    keywords: ["claude", "anthropic", "ai generation", "ai writes"],
    files: [
      "BigRedDroid_Claude_article_cover.jpg",
      "BigRedDroid_x_Claude_cover.jpg",
      "BigRedDroid_Claude_logo_charcoal.jpg",
    ],
  },
  {
    keywords: ["notion", "second brain", "knowledge base"],
    files: [
      "BigRedDroid_x_Notion_cover.jpg",
    ],
  },
  {
    keywords: ["obsidian", "pkm", "notes", "vault"],
    files: [
      "Twitter_article_cover_Obsidian_logo.jpg",
    ],
  },
  {
    keywords: ["phantom", "automation system", "personal brand system", "what i built"],
    files: [
      "Software_UI_frame_BigRedDroid_br….jpg",
      "Twitter_post_BigRedDroid_UI_show….jpg",
      "Tech_announcement_BigRedDroid_br….jpg",
      "Tech_announcement_card_BigRedDro….jpg",
    ],
  },
  {
    keywords: ["shipped", "update", "release", "just launched", "new feature", "what shipped"],
    files: [
      "Software_update_template_Dark_Mode.jpg",
      "Software_update_template_Light_Mode.jpg",
      "Milestone_Achieved_template_ligh….jpg",
    ],
  },
  {
    keywords: ["thread", "here's how", "breakdown", "step by step", "full stack"],
    files: [
      "Minimalist_Twitter_thread_header.jpg",
      "Twitter_thread_header_white_back….jpg",
      "Minimalist_Twitter_thread_starte….jpg",
    ],
  },
  {
    keywords: ["building in public", "project z", "92 products", "indie", "solo founder"],
    files: [
      "BigRedDroid_branding_code_snippet.jpg",
      "Red_robot_connecting_information….jpg",
      "Robot_organizing_productivity_board.jpg",
    ],
  },
  {
    keywords: ["data", "stats", "numbers", "followers", "growth"],
    files: [
      "Data_visualization_template_Twit….jpg",
      "Red_grid_minimalist_line_chart.jpg",
      "Red_minimalist_bar_chart.jpg",
    ],
  },
];

// Fallback pool — generic BigRedDroid branded templates
const GENERIC_POOL = [
  "Abstract_red_geometric_lines.jpg",
  "Glowing_red_01_tech_header.jpg",
  "Red_tech_rocket_icon_white.jpg",
  "Minimalist_card_BigRedDroid_bran….jpg",
  "Quote_card_template_Twitter_theme.jpg",
  "Secondary_Quote_card_template.jpg",
  "Twitter_article_cover_white_red.jpg",
  "Minimalist_Twitter_quote_card_white.jpg",
  "Minimalist_Twitter_quote_card_da….jpg",
  "Red_minimalist_frame_robot.jpg",
  "Tip_of_the_Day_card.jpg",
  "Code_snippet_background_white_red.jpg",
];

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");

function exists(filename: string): boolean {
  return fs.existsSync(path.join(TEMPLATES_DIR, filename));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickTemplate(tweetText: string): Buffer | null {
  const lower = tweetText.toLowerCase();

  // Find best matching topic
  for (const { keywords, files } of TOPIC_TEMPLATES) {
    if (keywords.some(k => lower.includes(k))) {
      const available = files.filter(exists);
      if (available.length > 0) {
        const chosen = pick(available);
        return fs.readFileSync(path.join(TEMPLATES_DIR, chosen));
      }
    }
  }

  // Fallback to generic pool
  const available = GENERIC_POOL.filter(exists);
  if (available.length > 0) {
    const chosen = pick(available);
    return fs.readFileSync(path.join(TEMPLATES_DIR, chosen));
  }

  return null;
}

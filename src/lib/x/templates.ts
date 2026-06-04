import fs from "fs";
import path from "path";

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");

function exists(filename: string): boolean {
  return fs.existsSync(path.join(TEMPLATES_DIR, filename));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Topic → template mapping — keywords matched against tweet text (lowercase)
const TOPIC_TEMPLATES: Array<{ keywords: string[]; files: string[] }> = [
  {
    keywords: ["claude", "anthropic", "ai generation", "ai writes", "ai model", "llm"],
    files: [
      "BigRedDroid_Claude_article_cover.jpg",
      "BigRedDroid_x_Claude_cover.jpg",
      "BigRedDroid_Claude_logo_charcoal.jpg",
      "BigRedDroid_Claude_integration_c….jpg",
    ],
  },
  {
    keywords: ["notion", "second brain", "knowledge base", "database", "workspace"],
    files: [
      "BigRedDroid_x_Notion_cover.jpg",
      "BigRedDroid_Notion_integration_w….jpg",
    ],
  },
  {
    keywords: ["obsidian", "pkm", "notes", "vault", "zettelkasten", "note-taking"],
    files: [
      "Twitter_article_cover_Obsidian_logo.jpg",
      "BigRedDroid_Obsidian_integration….jpg",
      "Obsidian_logo_on_white_background.jpg",
    ],
  },
  {
    keywords: ["phantom", "automation system", "personal brand system", "what i built", "automating my", "ai system"],
    files: [
      "Software_UI_frame_BigRedDroid_br….jpg",
      "Twitter_post_BigRedDroid_UI_show….jpg",
      "Tech_announcement_BigRedDroid_br….jpg",
      "Tech_announcement_card_BigRedDro….jpg",
      "Minimalist_software_UI_showcase.jpg",
      "Robot_looking_at_UI_window.jpg",
      "Software_UI_showcase_frame_white.jpg",
    ],
  },
  {
    keywords: ["shipped", "update", "release", "just launched", "new feature", "what shipped", "just pushed", "went live", "live now"],
    files: [
      "Software_update_template_Dark_Mode.jpg",
      "Software_update_template_Light_Mode.jpg",
      "Milestone_Achieved_template_ligh….jpg",
      "Minimalist_software_UI_showcase.jpg",
    ],
  },
  {
    keywords: ["thread", "here's how", "breakdown", "step by step", "full stack", "how to build", "how i built"],
    files: [
      "Minimalist_Twitter_thread_header.jpg",
      "Twitter_thread_header_white_back….jpg",
      "Minimalist_Twitter_thread_starte….jpg",
      "Twitter_article_cover_white_red.jpg",
    ],
  },
  {
    keywords: ["building in public", "project z", "92 products", "indie builder", "solo founder", "bigreddroid", "shipping"],
    files: [
      "BigRedDroid_branding_code_snippet.jpg",
      "Red_robot_connecting_information….jpg",
      "Robot_organizing_productivity_board.jpg",
      "BigRedDroid_robot_character_logo.jpg",
      "Tech_announcement_BigRedDroid_br….jpg",
    ],
  },
  {
    keywords: ["data", "stats", "numbers", "followers", "growth", "metric", "chart", "analytics"],
    files: [
      "Data_visualization_template_Twit….jpg",
      "Red_grid_minimalist_line_chart.jpg",
      "Red_minimalist_bar_chart.jpg",
      "Infographic_data_chart_backgroun….jpg",
      "Red_grid_on_white_background.jpg",
      "BigRedDroid_5_posts_summary.jpg",
      "BigRedDroid_top_posts_summary.jpg",
    ],
  },
  {
    keywords: ["tip", "lesson", "learn", "advice", "pro tip", "here's what", "mistake", "mistake i made"],
    files: [
      "Tip_of_the_Day_card.jpg",
      "Tip_of_the_Day_variation.jpg",
      "Minimalist_tech_quote_card_varia….jpg",
      "Minimalist_tech_review_template.jpg",
    ],
  },
  {
    keywords: ["code", "snippet", "function", "api", "deploy", "stack", "repo", "github"],
    files: [
      "BigRedDroid_branding_code_snippet.jpg",
      "Code_snippet_background_white_red.jpg",
      "Minimalist_code_snippet_white_ba….jpg",
    ],
  },
  {
    keywords: ["quote", "said", "truth", "real talk", "honest", "unpopular opinion", "hot take"],
    files: [
      "Quote_card_template_Twitter_theme.jpg",
      "Secondary_Quote_card_template.jpg",
      "Minimalist_Twitter_quote_card_white.jpg",
      "Minimalist_Twitter_quote_card_da….jpg",
      "Minimalist_Twitter_quote_template.jpg",
      "Twitter_quote_card_BigRedDroid_b….jpg",
      "Minimalist_tech_quote_card_varia….jpg",
    ],
  },
  {
    keywords: ["robot", "ai agent", "automation", "bot", "automated", "24/7", "autopilot"],
    files: [
      "Red_robot_connecting_information….jpg",
      "Robot_organizing_productivity_board.jpg",
      "BigRedDroid_robot_character_logo.jpg",
      "Red_minimalist_frame_robot.jpg",
      "Robot_looking_at_UI_window.jpg",
      "Red_line_robot_logo.jpg",
    ],
  },
  {
    keywords: ["community", "followers", "audience", "people", "together", "network"],
    files: [
      "Community_spotlight_template_Big….jpg",
      "Minimalist_community_spotlight_t….jpg",
    ],
  },
  {
    keywords: ["poll", "vote", "what do you think", "agree", "disagree", "which"],
    files: [
      "Minimalist_poll_background_dark_….jpg",
      "Minimalist_poll_background_split….jpg",
      "Twitter_poll_background_BigRedDr….jpg",
      "Twitter_poll_variation_BigRedDro….jpg",
    ],
  },
  {
    keywords: ["spaces", "live", "talking", "listening", "recording", "podcast", "interview"],
    files: [
      "Minimalist_Twitter_Space_announc….jpg",
      "Twitter_Spaces_announcement_temp….jpg",
      "Twitter_Spaces_variation_BigRedD….jpg",
    ],
  },
  {
    keywords: ["product", "roadmap", "what's next", "coming soon", "building next", "next up"],
    files: [
      "Minimalist_product_roadmap_backg….jpg",
      "Tech_announcement_BigRedDroid_br….jpg",
      "Tech_announcement_card_BigRedDro….jpg",
    ],
  },
];

// Fallback pool — generic BigRedDroid branded templates used when no topic matches
const GENERIC_POOL = [
  "Abstract_red_geometric_lines.jpg",
  "Abstract_red_shapes_Twitter_header.jpg",
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
  "BigRedDroid_robot_character_logo.jpg",
  "Minimalist_tech_quote_card_varia….jpg",
  "Red_square_with_tech_icon.jpg",
  "Tech_event_background_red_patterns.jpg",
  "Red_line_robot_logo.jpg",
  "Minimalist_software_UI_showcase.jpg",
];

// Style-based pools — used when user picks a style from the Telegram bot
const STYLE_TEMPLATES: Record<string, string[]> = {
  dark: [
    "Minimalist_Twitter_quote_card_da….jpg",
    "Data_visualization_background_da….jpg",
    "Tech_wrench_icon_black_background.jpg",
    "Glowing_red_01_tech_header.jpg",
    "Software_update_template_Dark_Mode.jpg",
    "Tech_event_background_red_patterns.jpg",
    "Abstract_red_geometric_lines.jpg",
    "BigRedDroid_Claude_logo_charcoal.jpg",
    "Minimalist_poll_background_dark_….jpg",
    "Abstract_red_shapes_Twitter_header.jpg",
    "Red_tech_gear_icon.jpg",
  ],
  light: [
    "Minimalist_Twitter_quote_card_white.jpg",
    "Minimalist_Twitter_quote_template.jpg",
    "Software_update_template_Light_Mode.jpg",
    "Twitter_thread_header_white_back….jpg",
    "Minimalist_code_snippet_white_ba….jpg",
    "Red_robot_logo_on_white.jpg",
    "Sleek_tech_giveaway_background,_Light.jpg",
    "Milestone_Achieved_template_ligh….jpg",
    "Minimalist_poll_background_split….jpg",
    "Software_UI_showcase_frame_white.jpg",
    "Obsidian_logo_on_white_background.jpg",
    "Red_circle_logo_white_space.jpg",
    "Minimalist_Twitter_thread_header.jpg",
    "Minimalist_tech_review_template.jpg",
    "Sleek_thank_you_card_light.jpg",
  ],
  branded: [
    "BigRedDroid_Claude_article_cover.jpg",
    "BigRedDroid_x_Claude_cover.jpg",
    "BigRedDroid_x_Notion_cover.jpg",
    "BigRedDroid_branding_code_snippet.jpg",
    "Tech_announcement_BigRedDroid_br….jpg",
    "Tech_announcement_card_BigRedDro….jpg",
    "Minimalist_card_BigRedDroid_bran….jpg",
    "Software_UI_frame_BigRedDroid_br….jpg",
    "Twitter_quote_card_BigRedDroid_b….jpg",
    "Community_spotlight_template_Big….jpg",
    "BigRedDroid_robot_character_logo.jpg",
    "BigRedDroid_Claude_integration_c….jpg",
    "BigRedDroid_Notion_integration_w….jpg",
    "BigRedDroid_Obsidian_integration….jpg",
    "Twitter_post_BigRedDroid_UI_show….jpg",
    "Twitter_poll_background_BigRedDr….jpg",
    "Twitter_Spaces_variation_BigRedD….jpg",
    "Link_in_Bio_card_BigRedDroid.jpg",
  ],
  article: [
    "Twitter_article_cover_white_red.jpg",
    "Twitter_article_cover_Obsidian_logo.jpg",
    "BigRedDroid_Claude_article_cover.jpg",
    "Minimalist_Twitter_thread_header.jpg",
    "Minimalist_Twitter_thread_starte….jpg",
    "Twitter_thread_header_white_back….jpg",
    "Minimalist_Twitter_Space_announc….jpg",
  ],
  data: [
    "Data_visualization_template_Twit….jpg",
    "Red_grid_minimalist_line_chart.jpg",
    "Red_minimalist_bar_chart.jpg",
    "Infographic_data_chart_backgroun….jpg",
    "Red_grid_on_white_background.jpg",
    "BigRedDroid_5_posts_summary.jpg",
    "BigRedDroid_top_posts_summary.jpg",
  ],
};

// Pick a template by explicit style. Falls back to keyword match when style is "auto".
export function pickTemplateByStyle(style: string, tweetText: string): Buffer | null {
  if (style !== "auto" && STYLE_TEMPLATES[style]) {
    const available = STYLE_TEMPLATES[style].filter(exists);
    if (available.length > 0) {
      return fs.readFileSync(path.join(TEMPLATES_DIR, pick(available)));
    }
  }
  return pickTemplate(tweetText);
}

export function pickTemplate(tweetText: string): Buffer | null {
  const lower = tweetText.toLowerCase();

  for (const { keywords, files } of TOPIC_TEMPLATES) {
    if (keywords.some(k => lower.includes(k))) {
      const available = files.filter(exists);
      if (available.length > 0) {
        return fs.readFileSync(path.join(TEMPLATES_DIR, pick(available)));
      }
    }
  }

  // Fallback to generic pool
  const available = GENERIC_POOL.filter(exists);
  if (available.length > 0) {
    return fs.readFileSync(path.join(TEMPLATES_DIR, pick(available)));
  }

  return null;
}

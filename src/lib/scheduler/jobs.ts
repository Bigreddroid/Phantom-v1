import { generateTweet, generateThread, generateReply } from "../claude/generate";
import { postTweet, postThread } from "../x/post";
import { getMentions, searchTweets, likeTweet, followUser } from "../x/engage";
import { requestApproval, notifyPosted, notifyError } from "../telegram/notify";

const MY_USER_ID = process.env.X_USER_ID ?? "";

// Content pillars — topics Phantom rotates through
const CONTENT_PILLARS = [
  "building a personal brand as a founder",
  "AI automation for solopreneurs",
  "lessons from building in public",
  "growing an audience without spending money on ads",
  "the intersection of tech and personal branding",
];

// Target accounts to engage with (niche: founders, creators, AI)
const NICHE_KEYWORDS = [
  "founder personal brand",
  "building in public",
  "solopreneur automation",
  "AI tools for creators",
  "indiehacker",
];

export async function runPostingJob() {
  try {
    const pillar = CONTENT_PILLARS[Math.floor(Math.random() * CONTENT_PILLARS.length)];
    const tweet = await generateTweet(pillar);

    // Send to Telegram for approval before posting
    await requestApproval("Post Tweet", tweet, { pillar });
  } catch (e) {
    await notifyError("Posting Job", String(e));
  }
}

export async function runThreadJob() {
  try {
    const pillar = CONTENT_PILLARS[Math.floor(Math.random() * CONTENT_PILLARS.length)];
    const tweets = await generateThread(pillar, 5);

    await requestApproval("Post Thread", tweets.join("\n\n---\n\n"), { pillar, tweets: String(tweets.length) });
  } catch (e) {
    await notifyError("Thread Job", String(e));
  }
}

export async function runEngagementJob() {
  try {
    const keyword = NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];
    const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 10);

    let engaged = 0;
    for (const tweet of tweets) {
      // Like the tweet automatically (low-stakes, no approval needed)
      if (tweet.author_id) {
        await likeTweet(tweet.id, MY_USER_ID);
        engaged++;
        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (engaged > 0) {
      await notifyPosted("Engagement Run", `Liked ${engaged} tweets about: "${keyword}"`);
    }
  } catch (e) {
    await notifyError("Engagement Job", String(e));
  }
}

export async function runMentionsJob(sinceId?: string) {
  try {
    const mentions = await getMentions(MY_USER_ID, sinceId);

    for (const mention of mentions) {
      const reply = await generateReply(mention.text, mention.author_id ?? "user");

      // Send each mention reply for approval
      await requestApproval("Reply to Mention", reply, {
        original: mention.text.slice(0, 80) + "...",
        tweetId: mention.id,
      });
    }

    return mentions[0]?.id; // return latest ID for next poll
  } catch (e) {
    await notifyError("Mentions Job", String(e));
  }
}

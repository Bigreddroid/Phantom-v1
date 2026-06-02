// Makes automation feel human — random delays, skip chance, active hours only

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, delay));
}

// Random minutes offset — spreads posts so they don't land at exact times
export function shouldSkip(skipChance = 0.1): boolean {
  return Math.random() < skipChance;
}

// Active hours: 7am–10pm IST (India)
export function isActiveHour(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour = ist.getHours();
  return hour >= 7 && hour <= 22;
}

// Peak hours: 8–10am, 12–2pm, 6–9pm IST — best time to post
export function isPeakHour(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour = ist.getHours();
  return (hour >= 8 && hour <= 10) || (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21);
}

// Human-like wait before posting (3–12 seconds)
export function humanPause(): Promise<void> {
  return randomDelay(3000, 12000);
}

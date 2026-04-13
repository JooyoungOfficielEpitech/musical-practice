export interface ShareData {
  accuracy: number;
  duration: number; // seconds
  streak: number;
}

export function getScoreEmoji(accuracy: number): string {
  if (accuracy >= 90) return "🔥";
  if (accuracy >= 70) return "⭐";
  if (accuracy >= 50) return "💪";
  return "🌱";
}

export function generateShareText(data: ShareData): string {
  const emoji = getScoreEmoji(data.accuracy);
  const mins = Math.floor(data.duration / 60);
  return `${emoji} Pitch Accuracy: ${data.accuracy}% | ${mins}min practice | ${data.streak} day streak\n\nMusical Practice - Vocal Pitch Monitor`;
}

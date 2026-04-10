import type { NextApiRequest, NextApiResponse } from 'next';

interface SummaryResponse {
  summary: string;
  tags: string[];
  title: string;
}

// Simple extractive summarization without external API dependencies
function extractSummary(text: string): SummaryResponse {
  const sentences = text
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  // Score sentences by word frequency importance
  const wordFreq: Record<string, number> = {};
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
    'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all',
    'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only',
    'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when',
    'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
    'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your',
    'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
    'about', 'up', 'like', 'also', 'well', 'back', 'much', 'go', 'get',
    'make', 'know', 'think', 'take', 'come', 'see', 'want', 'look', 'use',
    'find', 'give', 'tell', 'work', 'call', 'try', 'ask', 'need', 'feel',
    'become', 'leave', 'put', 'mean', 'keep', 'let', 'begin', 'seem',
    'help', 'show', 'hear', 'play', 'run', 'move', 'live', 'believe',
    'bring', 'happen', 'write', 'provide', 'sit', 'stand', 'lose', 'pay',
    'meet', 'include', 'continue', 'set', 'learn', 'change', 'lead',
    'understand', 'watch', 'follow', 'stop', 'create', 'speak', 'read',
    'spend', 'grow', 'open', 'walk', 'win', 'teach', 'offer', 'remember',
    'consider', 'appear', 'buy', 'wait', 'serve', 'die', 'send', 'expect',
    'build', 'stay', 'fall', 'cut', 'reach', 'kill', 'remain', 'um', 'uh',
    'like', 'yeah', 'okay', 'right', 'gonna', 'wanna', 'kinda', 'sorta',
  ]);

  words.forEach((word) => {
    const clean = word.replace(/[^a-z]/g, '');
    if (clean.length > 2 && !stopWords.has(clean)) {
      wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
  });

  // Extract tags from top keywords
  const sortedWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  const tags = sortedWords.slice(0, 3);

  // Score and rank sentences
  const scoredSentences = sentences.map((sentence, index) => {
    const sentWords = sentence.toLowerCase().split(/\s+/);
    let score = 0;
    sentWords.forEach((w) => {
      const clean = w.replace(/[^a-z]/g, '');
      if (wordFreq[clean]) score += wordFreq[clean];
    });
    // Boost earlier sentences
    score *= 1 + 0.2 / (index + 1);
    // Normalize by sentence length
    score /= Math.max(sentWords.length, 1);
    return { sentence, score, index };
  });

  scoredSentences.sort((a, b) => b.score - a.score);

  // Take top sentences (up to 3) and sort by original order
  const topSentences = scoredSentences
    .slice(0, Math.min(3, Math.ceil(sentences.length * 0.4)))
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence);

  const summary = topSentences.join('. ').replace(/\.\./g, '.') || text.slice(0, 200);

  // Generate a better title
  const title = topSentences[0]
    ? topSentences[0].split(/\s+/).slice(0, 6).join(' ')
    : text.split(/\s+/).slice(0, 6).join(' ');

  return {
    summary: summary.length > 300 ? summary.slice(0, 297) + '...' : summary,
    tags,
    title: title.length > 50 ? title.slice(0, 47) + '...' : title,
  };
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SummaryResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  if (transcript.length < 10) {
    return res.status(400).json({ error: 'Transcript too short to summarize' });
  }

  try {
    const result = extractSummary(transcript);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
}

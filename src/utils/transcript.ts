/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Turns a live tutor turn (a speech transcript, optionally plus a structured
 * analysis from the backend) into the three lines the UI shows:
 * Japanese script, Romaji reading, English meaning.
 *
 * The guiding rule: the Romaji line must be a reading of the Japanese line.
 * It is never scraped out of the tutor's English prose unless it actually
 * decomposes into Japanese morae, because a wrong reading teaches the learner
 * the wrong pronunciation.
 */

import {
  hasJapaneseScript,
  isKanaOnly,
  kanaToRomaji,
  looksLikeRomaji,
  normalizeRomaji,
  romajiLengthMatches,
  romajiToKana,
} from './romaji';

/** Structured fields produced by the backend transcript analyzer. */
export interface TurnAnalysis {
  japanese?: string;
  kana?: string;
  romaji?: string;
  english?: string;
}

export interface TutorTurn {
  japanese: string;
  romaji: string;
  english: string;
}

const CJK = /[぀-ヿ㐀-䶿一-鿿　-〿ー・～！？、。]/g;
const LATIN_RUN = "[A-Za-z0-9\\s.,?!'’\\-]{2,}";
const OPEN_QUOTE = `["'“（(]`;
const CLOSE_QUOTE = `["'”）)]`;

/** Removes the markdown/HTML emphasis the live model sprinkles into transcripts. */
function stripMarkup(text: string): string {
  return (text || '').replace(/<\/?b>/gi, '').replace(/\*/g, '').trim();
}

/** Reads a `LABEL:` field out of a structured tutor response. */
function labelledField(text: string, label: 'JAPANESE' | 'ROMAJI' | 'ENGLISH'): string {
  const others = ['JAPANESE', 'ROMAJI', 'ENGLISH'].filter(l => l !== label).join('|');
  const match = text.match(new RegExp(`${label}:\\s*(.*?)(?=${others}:|$)`, 'is'));
  return match ? stripMarkup(match[1]) : '';
}

/** Accepts a Romaji candidate only if it reads like the Japanese it claims to gloss. */
function acceptRomaji(candidate: string, japanese: string): string {
  const clean = normalizeRomaji(stripMarkup(candidate)).replace(/^[\s("'“]+|[\s)"'”]+$/g, '').trim();
  if (!clean || !looksLikeRomaji(clean)) return '';
  if (japanese && !romajiLengthMatches(clean, japanese)) return '';
  return clean;
}

/** Looks for a parenthesised or quoted reading directly after the Japanese phrase. */
function romajiAfterJapanese(text: string, japanese: string): string {
  if (!japanese) return '';
  const at = text.indexOf(japanese);
  if (at < 0) return '';
  const tail = text.slice(at + japanese.length);
  const match = tail.match(new RegExp(`^[\\s、。？！?!]*${OPEN_QUOTE}(${LATIN_RUN})${CLOSE_QUOTE}`));
  return match ? acceptRomaji(match[1], japanese) : '';
}

export function extractJapanese(text: string, analysis?: TurnAnalysis | null): string {
  if (analysis?.japanese && hasJapaneseScript(analysis.japanese)) {
    return stripMarkup(analysis.japanese);
  }

  const clean = stripMarkup(text);

  const labelled = labelledField(clean, 'JAPANESE');
  if (labelled && hasJapaneseScript(labelled)) return labelled;

  // Longest run of Japanese script in the transcript.
  const runs = clean.match(/[぀-ヿ㐀-䶿一-鿿　-〿ー・～！？、。]+/g);
  if (runs?.length) {
    const longest = runs.reduce((a, b) => (a.length >= b.length ? a : b)).trim();
    // A lone particle is the tutor talking *about* grammar ("it is を, not は"),
    // not a phrase to teach. A single Kanji can be a real vocabulary item.
    const bare = longest.replace(/[　-〿ー・～！？、。]/g, '');
    if (bare.length > 1 || /[㐀-䶿一-鿿]/.test(bare)) return longest;
  }

  // No Japanese script at all: the tutor may have only spoken the reading, so
  // transliterate a quoted Romaji phrase back into Kana. Gated hard, because
  // transliterating English produces convincing-looking nonsense.
  const quoted = clean.match(new RegExp(`${OPEN_QUOTE}(${LATIN_RUN})${CLOSE_QUOTE}`, 'g')) || [];
  for (let i = quoted.length - 1; i >= 0; i--) {
    const inner = quoted[i].replace(new RegExp(`^${OPEN_QUOTE}|${CLOSE_QUOTE}$`, 'g'), '').trim();
    if (looksLikeRomaji(inner)) {
      const converted = romajiToKana(inner);
      if (converted && converted !== inner) return converted;
    }
  }

  return '';
}

export function extractRomaji(text: string, japanese: string, analysis?: TurnAnalysis | null): string {
  const clean = stripMarkup(text);

  // 1. The analyzer's reading, if it really is a reading of this phrase.
  const fromAnalysis = acceptRomaji(analysis?.romaji || '', japanese);
  if (fromAnalysis) return fromAnalysis;

  // 2. An explicit ROMAJI: field in a structured response.
  const labelled = acceptRomaji(labelledField(clean, 'ROMAJI'), japanese);
  if (labelled) return labelled;

  // 3. The analyzer's Kana reading, romanized locally. Spaces in the Kana mark
  //    word boundaries, which is what makes "fukuro wa goriyou desu ka" possible.
  if (analysis?.kana && isKanaOnly(analysis.kana)) {
    const romanized = kanaToRomaji(analysis.kana);
    if (romanized && !hasJapaneseScript(romanized)) return romanized;
  }

  // 4. A reading the tutor spoke right after the phrase, e.g. 袋は… (Fukuro wa…).
  const anchored = romajiAfterJapanese(clean, japanese);
  if (anchored) return anchored;

  // 5. Any bracketed Latin run in the turn that decomposes into Japanese morae.
  const bracketed = clean.match(new RegExp(`${OPEN_QUOTE}(${LATIN_RUN})${CLOSE_QUOTE}`, 'g')) || [];
  for (const candidate of bracketed) {
    const accepted = acceptRomaji(candidate, japanese);
    if (accepted) return accepted;
  }

  // 6. Romanize the phrase ourselves. Only possible without Kanji, which needs
  //    a reading dictionary we do not ship.
  if (isKanaOnly(japanese)) {
    const romanized = kanaToRomaji(japanese);
    if (romanized && !hasJapaneseScript(romanized)) return romanized;
  }

  // Nothing trustworthy. Show no Romaji rather than a misleading one.
  return '';
}

export function extractEnglish(text: string, japanese: string, romaji: string, analysis?: TurnAnalysis | null): string {
  if (analysis?.english?.trim() && !hasJapaneseScript(analysis.english)) {
    return stripMarkup(analysis.english);
  }

  const clean = stripMarkup(text);

  const labelled = labelledField(clean, 'ENGLISH');
  if (labelled) return labelled;

  // "…that means: <translation>" / "…which means <translation>".
  // The separator class has to swallow the colon, or the capture starts on it.
  const means = clean.match(/(?:that means|which means|it means|meaning|translates to)\b[\s:,\-–]*["'“]?([^"'”.!?]+)/i);
  if (means?.[1]?.trim()) return means[1].trim();

  // Fall back to what the tutor said, minus the Japanese and its reading, so the
  // learner still sees the surrounding explanation instead of an empty line.
  let rest = clean.replace(CJK, '');
  // Only strip a reading long enough to be unambiguous, and only where it stands
  // alone — a naive replace of a short reading like "o" guts the English.
  if (romaji.length >= 4) {
    const escaped = romaji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rest = rest.replace(new RegExp(`(^|[\\s("'“])${escaped}(?=[\\s)"'”.,!?]|$)`, 'gi'), '$1');
  }
  return rest
    .replace(new RegExp(`${OPEN_QUOTE}\\s*${CLOSE_QUOTE}`, 'g'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,?!])/g, '$1')
    .trim();
}

/** Parses one completed tutor turn into the three display lines. */
export function parseTutorTurn(transcript: string, analysis?: TurnAnalysis | null): TutorTurn {
  const japanese = extractJapanese(transcript, analysis);
  const romaji = extractRomaji(transcript, japanese, analysis);
  const english = extractEnglish(transcript, japanese, romaji, analysis);
  return { japanese, romaji, english };
}

/**
 * Repairs a stored flashcard whose fields were written by an older, buggier
 * parser. Only replaces values that are missing or provably wrong — a card the
 * learner typed by hand is left exactly as it is.
 */
export function repairFlashcard<T extends { japanese: string; romaji: string; english: string }>(card: T): T {
  const japanese = hasJapaneseScript(card.japanese)
    ? card.japanese.trim()
    : extractJapanese(card.japanese) || card.japanese;

  const romajiIsUsable = card.romaji?.trim() && card.romaji.trim() !== 'N/A' && looksLikeRomaji(card.romaji);
  const romaji = romajiIsUsable ? card.romaji.trim() : extractRomaji(card.japanese, japanese);

  if (japanese === card.japanese && romaji === card.romaji) return card;
  return { ...card, japanese, romaji };
}

/** Splits Japanese text into tappable segments on particles and punctuation. */
export function segmentJapanese(text: string): string[] {
  const particles = /(は|が|を|に|で|と|の|も|か|ね|よ|、|。|？|！|「|」|\s+)/g;
  return (text || '').split(particles).filter(segment => segment.length > 0);
}

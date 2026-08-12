/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Kana to Hepburn Romaji mapping
const KANA_MAP: Record<string, string> = {
  // Hiragana monographs
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'ゐ': 'i', 'ゑ': 'e', 'を': 'o', 'ん': 'n',

  // Dakuten
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ゔ': 'vu',

  // Handakuten
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',

  // Digraphs (Hiragana)
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'ぢゃ': 'ja', 'ぢゅ': 'ju', 'ぢょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',

  // Katakana monographs
  'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
  'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
  'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
  'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
  'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
  'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
  'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
  'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
  'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
  'ワ': 'wa', 'ヰ': 'i', 'ヱ': 'e', 'ヲ': 'o', 'ン': 'n',

  // Katakana Dakuten & Handakuten
  'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
  'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
  'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do',
  'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
  'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
  'ヴ': 'vu',

  // Katakana Digraphs
  'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
  'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
  'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
  'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
  'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
  'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
  'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
  'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
  'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
  'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
  'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
  'ティ': 'ti', 'ディ': 'di', 'デュ': 'dyu', 'トゥ': 'tu', 'ドゥ': 'du',
  'ファ': 'fa', 'フィ': 'fi', 'フェ': 'fe', 'フォ': 'fo',
  'ウィ': 'wi', 'ウェ': 'we', 'ウォ': 'wo',
  'ヴァ': 'va', 'ヴィ': 'vi', 'ヴェ': 've', 'ヴォ': 'vo',
  'シェ': 'she', 'ジェ': 'je', 'チェ': 'che', 'ツァ': 'tsa', 'ツォ': 'tso',

  // Stand-alone small kana (only reached when not part of a digraph)
  'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
  'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo',
  'ァ': 'a', 'ィ': 'i', 'ゥ': 'u', 'ェ': 'e', 'ォ': 'o',
  'ャ': 'ya', 'ュ': 'yu', 'ョ': 'yo',
};

const SOKUON = /^[っッ]$/;
const LONG_VOWEL_MARK = 'ー';

/** True if the string contains any Kanji, Hiragana or Katakana. */
export function hasJapaneseScript(str: string): boolean {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(str || '');
}

/** True if the string contains Japanese script but no Kanji (romanizable without a dictionary). */
export function isKanaOnly(str: string): boolean {
  if (!str || !/[぀-ヿ]/.test(str)) return false;
  return !/[㐀-䶿一-鿿]/.test(str);
}

/** Last vowel of a romanized mora, used to expand the ー long-vowel mark. */
function trailingVowel(mora: string): string {
  const vowels = mora.replace(/[^aiueo]/g, '');
  return vowels.slice(-1);
}

/**
 * Romanizes a whitespace-free run of Kana. Anything that is not Kana (Kanji,
 * punctuation, Latin) is passed through untouched.
 * Returns the individual morae so the caller can decide how to join them.
 */
function romanizeMorae(token: string, applyParticleRules: boolean): string[] {
  const morae: string[] = [];
  // Consonant contributed by a small tsu, carried onto the next mora so that
  // っと becomes one "tto" rather than a stray "t".
  let sokuon = '';
  const push = (mora: string) => {
    morae.push(sokuon + mora);
    sokuon = '';
  };
  let i = 0;

  while (i < token.length) {
    const char = token[i];

    // Small tsu (sokuon) doubles the consonant of the following mora.
    if (SOKUON.test(char)) {
      const rom = KANA_MAP[token.slice(i + 1, i + 3)] || KANA_MAP[token[i + 1]];
      if (rom) sokuon = rom.startsWith('ch') ? 't' : rom[0];
      i++;
      continue;
    }

    // Long vowel mark repeats the vowel of the preceding mora.
    if (char === LONG_VOWEL_MARK) {
      const vowel = trailingVowel(morae[morae.length - 1] || '');
      if (vowel) morae[morae.length - 1] += vowel;
      i++;
      continue;
    }

    const pair = token.slice(i, i + 2);
    if (KANA_MAP[pair]) {
      push(KANA_MAP[pair]);
      i += 2;
      continue;
    }

    if (KANA_MAP[char]) {
      let rom = KANA_MAP[char];

      // Topic particle は and direction particle へ are pronounced wa / e.
      // Only applied mid-token, where they are almost always particles in the
      // short teaching sentences this app handles (word-initial は stays "ha").
      if (applyParticleRules && i > 0 && (char === 'は' || char === 'へ')) {
        rom = char === 'は' ? 'wa' : 'e';
      }

      // Hepburn apostrophe: ん before a vowel or y (きんえん -> kin'en).
      if (rom === 'n') {
        const next = KANA_MAP[token.slice(i + 1, i + 3)] || KANA_MAP[token[i + 1]];
        if (next && /^[aiueoy]/.test(next)) rom = "n'";
      }

      push(rom);
      i++;
      continue;
    }

    // Kanji, punctuation and anything else pass through unchanged.
    push(char);
    i++;
  }

  return morae;
}

/**
 * Converts Hiragana and Katakana to Hepburn Romaji.
 *
 * If the input already contains spaces it is treated as pre-segmented and each
 * word is romanized as one unit ("ふくろ は ごりよう です か" -> "fukuro wa goriyou desu ka").
 * Without spaces there is no way to find word boundaries, so morae are spaced
 * individually ("これはいくらですか" -> "ko re wa i ku ra de su ka") which is
 * still readable for a learner.
 *
 * Kanji cannot be romanized without a reading dictionary and is passed through,
 * so callers should check the result with `hasJapaneseScript` before showing it.
 */
export function kanaToRomaji(str: string): string {
  if (!str) return '';

  const preSegmented = /\s/.test(str.trim());

  const result = str
    .split(/(\s+)/)
    .map((token) => {
      if (!token || /^\s+$/.test(token)) return ' ';
      // A word that is exactly は / へ is unambiguously a particle.
      if (preSegmented && (token === 'は' || token === 'へ')) {
        return token === 'は' ? 'wa' : 'e';
      }
      const morae = romanizeMorae(token, !preSegmented);
      return preSegmented ? morae.join('') : morae.join(' ');
    })
    .join('');

  return result
    // Japanese punctuation has no place on a Romaji line.
    .replace(/[。．]/g, '.').replace(/[、，]/g, ',').replace(/？/g, '?').replace(/！/g, '!')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,?!])/g, '$1')
    .trim();
}

/**
 * Normalizes Romaji long-vowel diacritics to standard double vowels.
 * e.g., Jūsho -> Juusho, Tōkyō -> Toukyou
 */
export function normalizeRomaji(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFC')
    .replace(/[āâ]/g, 'aa').replace(/[ĀÂ]/g, 'Aa')
    .replace(/[īî]/g, 'ii').replace(/[ĪÎ]/g, 'Ii')
    .replace(/[ūû]/g, 'uu').replace(/[ŪÛ]/g, 'Uu')
    .replace(/[ēê]/g, 'ee').replace(/[ĒÊ]/g, 'Ee')
    .replace(/[ōô]/g, 'ou').replace(/[ŌÔ]/g, 'Ou');
}

// Reverse mapping for Romaji to Kana
const ROMAJI_TO_KANA: Record<string, string> = {
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
  'jya': 'じゃ', 'jyu': 'じゅ', 'jyo': 'じょ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
  'tsu': 'つ', 'shi': 'し', 'chi': 'ち', 'fu': 'ふ',

  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  'sa': 'さ', 'si': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  'ta': 'た', 'ti': 'ち', 'tu': 'つ', 'te': 'て', 'to': 'と',
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  'ha': 'は', 'hi': 'ひ', 'hu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  'wa': 'わ', 'wo': 'を',
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  'za': 'ざ', 'zi': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  'ja': 'じゃ', 'ji': 'じ', 'ju': 'じゅ', 'jo': 'じょ',

  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
  'n': 'ん'
};

const ROMAJI_WORD_MAP: Record<string, string> = {
  'amerika': 'アメリカ',
  'watashi': '私',
  'namae': '名前',
  'shon': 'ション',
  'shawn': 'ショーン',
  'kara': 'から',
  'kimashita': '来ました',
  'desu': 'です',
  'oshiharai': 'お支払い',
  'dousaremasu': 'どうされます',
  'ka': 'か',
  'onegai': 'お願い',
  'shimasu': 'します',
  'mantan': '満タン',
  'hajimemashite': 'はじめまして',
  'yoroshiku': 'よろしく',
  'onegaishimasu': 'お願いします',
  'arigatou': 'ありがとう',
  'gozaimasu': 'ございます',
  'sumimasen': 'すみません',
  'gomen': 'ごめん',
  'konnichiwa': 'こんにちは',
  'konbanwa': 'こんばんは',
  'ohayou': 'おはよう',
  'doko': 'どこ',
  'ikura': 'いくら',
  'kore': 'これ',
  'sore': 'それ',
  'are': 'あれ',
  'juusho': '住所',
  'jusho': '住所',
  'touroku': '登録',
  'shitai': 'したい',
  'menyuu': 'メニュー',
  'menu': 'メニュー',
  'wo': 'を',
  'o': 'お',
  'bento': '弁当',
  'fukuro': '袋',
  'atsui': '熱い',
  'tsumetai': '冷たい',
  'okashi': 'お菓子',
};

/**
 * True if a single word decomposes cleanly into Japanese morae.
 * This is what separates real Romaji ("fukuro", "desu") from English words
 * ("would", "bag", "question"), which is the check the old stop-word list
 * was trying and failing to approximate.
 */
export function isRomajiWord(word: string): boolean {
  const clean = normalizeRomaji(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return false;

  let i = 0;
  while (i < clean.length) {
    // Doubled consonant = sokuon (kitte, gakkou). 'n' doubles legitimately (konnichiwa).
    if (i + 1 < clean.length && clean[i] === clean[i + 1] && !'aiueon'.includes(clean[i])) {
      i++;
      continue;
    }
    const tri = clean.slice(i, i + 3);
    if (tri.length === 3 && ROMAJI_TO_KANA[tri]) {
      i += 3;
      continue;
    }
    const bi = clean.slice(i, i + 2);
    if (bi.length === 2 && ROMAJI_TO_KANA[bi]) {
      i += 2;
      continue;
    }
    if (ROMAJI_TO_KANA[clean[i]]) {
      i++;
      continue;
    }
    return false;
  }
  return true;
}

/** Fraction of the words in a phrase that are valid Romaji (0 to 1). */
export function romajiConfidence(phrase: string): number {
  const words = (phrase || '').split(/[^A-Za-zĀ-ſ']+/).filter(Boolean);
  if (words.length === 0) return 0;
  return words.filter(isRomajiWord).length / words.length;
}

/**
 * Guards the Romaji line against English prose leaking into it.
 * Requires the phrase to be Latin script and overwhelmingly made of valid morae.
 */
export function looksLikeRomaji(phrase: string): boolean {
  const trimmed = (phrase || '').trim();
  if (!trimmed || hasJapaneseScript(trimmed)) return false;
  return romajiConfidence(trimmed) >= 0.8;
}

/** Approximate mora count of a Romaji phrase, used for length sanity checks. */
export function romajiMoraCount(phrase: string): number {
  const clean = normalizeRomaji(phrase || '').toLowerCase().replace(/[^a-z]/g, '');
  const vowels = clean.replace(/[^aiueo]/g, '').length;
  // Every mora carries a vowel except a standalone ん.
  const standaloneN = (clean.match(/n(?![aiueoy])/g) || []).length;
  return vowels + standaloneN;
}

/** Approximate mora count of a Japanese phrase (Kanji average ~1.8 morae each). */
export function japaneseMoraCount(text: string): number {
  const kana = (text.match(/[぀-ヿ]/g) || []).length;
  const kanji = (text.match(/[㐀-䶿一-鿿]/g) || []).length;
  return kana + kanji * 1.8;
}

/**
 * True if a Romaji phrase is a plausible reading of a Japanese phrase, by length.
 * Catches cases where a stray fragment is offered as the reading of a full sentence.
 */
export function romajiLengthMatches(romaji: string, japanese: string): boolean {
  const expected = japaneseMoraCount(japanese);
  if (expected === 0) return true;
  const actual = romajiMoraCount(romaji);
  return actual >= expected * 0.5 && actual <= expected * 2.5;
}

/**
 * Converts a Romaji reading into Japanese Hiragana/Katakana script.
 * Callers must gate this with `looksLikeRomaji` — it will happily transliterate
 * English text into meaningless Kana otherwise.
 */
export function romajiToKana(str: string): string {
  if (!str) return '';

  const cleanStr = normalizeRomaji(str.replace(/<\/?b>/gi, '').replace(/\*\*/g, '').trim());
  const words = cleanStr.split(/(\s+|[.,?!'"])/);

  const convertedWords = words.map(word => {
    const lower = word.toLowerCase().trim();
    if (!lower) return word;
    if (ROMAJI_WORD_MAP[lower]) return ROMAJI_WORD_MAP[lower];
    if (!/^[a-z]+$/.test(lower)) return word;

    let res = '';
    let i = 0;
    const len = lower.length;

    while (i < len) {
      // Double consonants (e.g. 'kk', 'ss', 'tt', 'pp')
      if (i + 1 < len && lower[i] === lower[i + 1] && /[bcdfghjklmnpqrstvwxyz]/.test(lower[i]) && lower[i] !== 'n') {
        res += 'っ';
        i++;
        continue;
      }

      const tri = lower.slice(i, i + 3);
      if (tri.length === 3 && ROMAJI_TO_KANA[tri]) {
        res += ROMAJI_TO_KANA[tri];
        i += 3;
        continue;
      }

      const bi = lower.slice(i, i + 2);
      if (bi.length === 2 && ROMAJI_TO_KANA[bi]) {
        res += ROMAJI_TO_KANA[bi];
        i += 2;
        continue;
      }

      res += ROMAJI_TO_KANA[lower[i]] || lower[i];
      i++;
    }

    return res;
  });

  return convertedWords.join('').replace(/\s+/g, ' ').trim();
}

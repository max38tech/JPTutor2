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
  'ティ': 'ti', 'ディ': 'di', 'デュ': 'dyu',
  'ファ': 'fa', 'フィ': 'fi', 'フェ': 'fe', 'フォ': 'fo',
  'ウィ': 'wi', 'ウェ': 'we', 'ウォ': 'wo',
};

/**
 * Converts Hiragana and Katakana text to Hepburn Romaji.
 * Leaves non-Kana / Kanji untouched or cleanly formatted.
 */
export function kanaToRomaji(str: string): string {
  if (!str) return '';
  
  let res = '';
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    // Check for small tsu (sokuton) -> double next consonant
    if (char === 'っ' || char === 'ッ') {
      if (i + 1 < str.length) {
        // Look ahead to next character/digraph
        const nextChar = str[i + 1];
        const nextTwo = str.slice(i + 1, i + 3);
        const rom = KANA_MAP[nextTwo] || KANA_MAP[nextChar];
        if (rom) {
          const firstConsonant = rom[0];
          if (rom.startsWith('ch')) {
            res += 't';
          } else if (/[a-z]/i.test(firstConsonant)) {
            res += firstConsonant.toLowerCase();
          }
        }
      }
      i++;
      continue;
    }

    // Check 2-character digraphs
    if (i + 1 < str.length) {
      const pair = str.slice(i, i + 2);
      if (KANA_MAP[pair]) {
        res += KANA_MAP[pair] + ' ';
        i += 2;
        continue;
      }
    }

    // Single character lookup
    if (KANA_MAP[char]) {
      res += KANA_MAP[char] + (char === 'ー' ? '' : ' ');
      i++;
      continue;
    }

    // Pass through punctuation / spaces / other
    if (char === ' ' || char === '　' || char === '、' || char === '。' || char === '？' || char === '！') {
      res += char;
    } else {
      res += char;
    }
    i++;
  }

  // Clean up spacing around punctuation and formatting
  return res
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,?!、。？！])/g, '$1')
    .trim();
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
};

/**
 * Converts Romaji reading into Japanese Hiragana/Katakana script.
 */
export function romajiToKana(str: string): string {
  if (!str) return '';

  const cleanStr = str.replace(/<\/?b>/gi, '').replace(/\*\*/g, '').trim();
  const words = cleanStr.split(/(\s+|[.,?!'"])/);

  const convertedWords = words.map(word => {
    const lower = word.toLowerCase().trim();
    if (ROMAJI_WORD_MAP[lower]) {
      return ROMAJI_WORD_MAP[lower];
    }

    if (!/^[a-z]+$/i.test(lower)) return word;

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

      if (i + 2 < len) {
        const tri = lower.slice(i, i + 3);
        if (ROMAJI_TO_KANA[tri]) {
          res += ROMAJI_TO_KANA[tri];
          i += 3;
          continue;
        }
      }

      if (i + 1 < len) {
        const bi = lower.slice(i, i + 2);
        if (ROMAJI_TO_KANA[bi]) {
          res += ROMAJI_TO_KANA[bi];
          i += 2;
          continue;
        }
      }

      const uni = lower[i];
      if (ROMAJI_TO_KANA[uni]) {
        res += ROMAJI_TO_KANA[uni];
      } else {
        res += uni;
      }
      i++;
    }

    return res;
  });

  return convertedWords.join('').replace(/\s+/g, ' ').trim();
}

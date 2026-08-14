/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regression tests for the Japanese / Romaji / English parsing of tutor turns.
 * Run with: npm test
 */

import { parseTutorTurn, repairFlashcard } from './transcript';
import { kanaToRomaji, looksLikeRomaji } from './romaji';

let pass = 0, fail = 0;
const check = (label: string, actual: any, expected: any) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}`);
  if (!ok) console.log(`         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`);
};
const notContains = (label: string, actual: string, needle: string) => {
  const ok = !actual.includes(needle);
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}`);
  if (!ok) console.log(`         "${actual}" must not contain "${needle}"`);
};

console.log('\n=== 1. The two turns from the bug report (no backend analysis available) ===');

const turn1 = `Great, let's learn to converse about the topic: Convenience Store. My name is Hiro-sensei! Looking at what we've covered, would you like to review the question "これはいくらですか？"? Or maybe start with something new, like asking for a bag? What do you want to try?`;
const r1 = parseTutorTurn(turn1);
console.log(JSON.stringify(r1, null, 2));
check('turn1 japanese', r1.japanese, 'これはいくらですか？');
check('turn1 romaji is a real reading', r1.romaji, 'ko re wa i ku ra de su ka?');
notContains('turn1 romaji has no English prose', r1.romaji, 'covered');

const turn2 = `袋はご利用ですか？ meaning: "Would you like a bag?"`;
const r2 = parseTutorTurn(turn2);
console.log(JSON.stringify(r2, null, 2));
check('turn2 japanese', r2.japanese, '袋はご利用ですか？');
check('turn2 romaji blank rather than English (kanji, no analysis)', r2.romaji, '');
check('turn2 english', r2.english, 'Would you like a bag');

console.log('\n=== 2. Same turns WITH the backend analysis (the normal path) ===');

const r2b = parseTutorTurn(turn2, {
  japanese: '袋はご利用ですか？',
  kana: 'ふくろ は ごりよう です か',
  romaji: 'Fukuro wa goriyou desu ka?',
  english: 'Would you like a bag?',
});
console.log(JSON.stringify(r2b, null, 2));
check('analysis romaji accepted', r2b.romaji, 'Fukuro wa goriyou desu ka?');
check('analysis english accepted', r2b.english, 'Would you like a bag?');

// Analysis model puts English in the romaji field -> rejected, kana used instead.
const r2c = parseTutorTurn(turn2, {
  japanese: '袋はご利用ですか？',
  kana: 'ふくろ は ごりよう です か',
  romaji: 'Would you like a bag?',
  english: 'Would you like a bag?',
});
check('bad analysis romaji rejected, kana reading used', r2c.romaji, 'fukuro wa goriyou desu ka');

// Analysis truncates the romaji -> length check rejects it, kana wins.
const r2d = parseTutorTurn(turn2, {
  japanese: '袋はご利用ですか？',
  kana: 'ふくろ は ごりよう です か',
  romaji: 'Fukuro',
  english: 'Would you like a bag?',
});
check('truncated analysis romaji rejected', r2d.romaji, 'fukuro wa goriyou desu ka');

// Analysis model echoes the turn's opening preamble into "english" instead of
// translating the target phrase -> rejected rather than shown (issue #12).
const firstTurn = `Great, let's learn to converse about the topic: Dating. I'm Taro-sensei, your Japanese tutor! デートに行きませんか？`;
const r2e = parseTutorTurn(firstTurn, {
  japanese: 'デートに行きませんか？',
  kana: 'デート に いき ませ ん か',
  romaji: 'Deeto ni ikimasen ka?',
  english: "Great, let's learn to converse about the topic: Dating. I'm Taro-sensei, your Japanese tutor!",
});
check('multi-sentence analysis english rejected', r2e.english, '');
check('analysis romaji still accepted despite bad english', r2e.romaji, 'Deeto ni ikimasen ka?');

// A genuine, slightly longer single-clause translation is still accepted.
const r2f = parseTutorTurn(turn2, {
  japanese: '袋はご利用ですか？',
  kana: 'ふくろ は ごりよう です か',
  romaji: 'Fukuro wa goriyou desu ka?',
  english: 'Would you like a bag for your items today?',
});
check('longer single-clause analysis english accepted', r2f.english, 'Would you like a bag for your items today?');

console.log('\n=== 3. Romaji spoken in parentheses right after the phrase ===');
const turn3 = `You can say: アメリカから来ました (Amerika kara kimashita). That means: I came from America.`;
const r3 = parseTutorTurn(turn3);
console.log(JSON.stringify(r3, null, 2));
check('turn3 japanese', r3.japanese, 'アメリカから来ました');
check('turn3 romaji from parentheses', r3.romaji, 'Amerika kara kimashita');
check('turn3 english', r3.english, 'I came from America');

console.log('\n=== 4. Pure English chatter must not invent Japanese or Romaji ===');
const turn4 = `Great job! Are you ready to move on, or would you like to practice that phrase a few more times?`;
const r4 = parseTutorTurn(turn4);
console.log(JSON.stringify(r4, null, 2));
check('turn4 japanese empty', r4.japanese, '');
check('turn4 romaji empty', r4.romaji, '');

console.log('\n=== 5. looksLikeRomaji discriminates readings from English ===');
const romajiCases: [string, boolean][] = [
  ['Fukuro wa goriyou desu ka', true],
  ['Oshiharai wa dousaremasu ka', true],
  ['Kore wa ikura desu ka', true],
  ['Amerika kara kimashita', true],
  ['Konnichiwa, hajimemashite', true],
  ['ve covered, would you like to review the question', false],
  ['Would you like a bag?', false],
  ['I came from America', false],
  ['Now you try saying it', false],
  ['Are you ready to move on', false],
  ['これはいくらですか', false],
];
for (const [phrase, expected] of romajiCases) {
  check(`looksLikeRomaji(${JSON.stringify(phrase)})`, looksLikeRomaji(phrase), expected);
}

console.log('\n=== 6. kanaToRomaji fixes ===');
check('long vowel mark (katakana)', kanaToRomaji('メニュー'), 'me nyuu');
check('long vowel mark (coffee)', kanaToRomaji('コーヒー'), 'koo hii');
check('sokuon', kanaToRomaji('ちょっと'), 'cho tto');
check('topic particle wa', kanaToRomaji('これはいくら'), 'ko re wa i ku ra');
check('pre-segmented kana joins words', kanaToRomaji('おしはらい は どう されます か'), 'oshiharai wa dou saremasu ka');
check("hepburn n'", kanaToRomaji('きんえん'), "ki n' e n");

console.log('\n=== 7. repairFlashcard is conservative ===');
const goodCard = { japanese: 'お会計をお願いします', romaji: 'Okaikei wo onegai shimasu', english: 'Check, please' };
check('valid card untouched', repairFlashcard(goodCard), goodCard);
const brokenCard = { japanese: 'これはいくらですか', romaji: 've covered, would you like to review', english: 'How much is this?' };
const repaired = repairFlashcard(brokenCard);
console.log('  repaired ->', JSON.stringify(repaired));
notContains('broken romaji replaced', repaired.romaji, 'covered');
check('english never overwritten by repair', repaired.english, 'How much is this?');

console.log('\n=== 8. Terse tutor style (strict grading prompt) ===');

const terse1 = parseTutorTurn("袋はいりません。 I don't need a bag. Your turn.", {
  japanese: '袋はいりません。', kana: 'ふくろ は いりません',
  romaji: 'Fukuro wa irimasen', english: "I don't need a bag",
});
check('terse phrase turn', terse1, {
  japanese: '袋はいりません。', romaji: 'Fukuro wa irimasen', english: "I don't need a bag",
});

// A lone particle quoted while correcting grammar is not the lesson phrase.
const terse2 = parseTutorTurn('Close. Watch the particle: it is を, not は. Your turn.');
check('lone particle is not treated as the phrase', terse2.japanese, '');
check('lone particle produces no romaji', terse2.romaji, '');

// A short reading must never be substring-stripped out of the English line.
const terse3 = parseTutorTurn('Not yet. The "su" is short, not "suu". これはいくらですか。 Try again.');
check('english keeps its letters', terse3.english, 'Not yet. The "su" is short, not "suu". Try again.');
check('japanese punctuation normalised in romaji', terse3.romaji, 'ko re wa i ku ra de su ka.');

check('pure grading turn has no phrase', parseTutorTurn('Good.').japanese, '');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

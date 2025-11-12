// backend/utils/ptiGuard.js
// Lightweight newsroom compliance/risk scanner (EN/HI/GU).
// Flags hate/incitement, missing attribution, and sensational / unverified claim words.

/** @typedef {{ ptiFlags: string[]; riskWords: string[]; advice: string; }} GuardResult */

/** @typedef {'en'|'hi'|'gu'} Lang */

const SENSATIONAL = {
  en: ["shocking","explosive","you won't believe","confirmed!*","viral!*"],
  hi: ["चौंकाने वाला","सनसनीखेज","पक्का सबूत","एक्सक्लूसिव!*"],
  gu: ["ચોંકાવનારી","સનસનાટીભર્યું","પક્કા પુરાવા","એકસ્પ્લુસિવ!*"],
};
const UNVERIFIED_CLAIMS = {
  en: ["confirmed","proof","mastermind","terrorist","fraudster"],
  hi: ["पुष्टि","साबित","मास्टरमाइंड","आतंकी","ठग"],
  gu: ["પુષ્ટિ","સાબિત","માસ્ટરમાઇન્ડ","આતંકી","ઠગ"],
};
const HATE_INCITEMENT = {
  en: ["kill","lynch","riot","communal"],
  hi: ["मारो","लिंच","दंगा","सांप्रदायिक"],
  gu: ["મારી નાખો","લિંચ","દંગા","સાંપ્રદાયિક"],
};
const REQUIRE_ATTRIBUTION = {
  en: [/victim|accused|arrested|leaked/i],
  hi: [/पीड़ित|आरोपी|गिरफ्तार|लीक/i],
  gu: [/પીડિત|આરોપી|ગિરફ્તાર|લીક/i],
};

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[“”"‘’']/g,'')
    .split(/[^a-z\u0900-\u097F\u0A80-\u0AFF0-9]+/i)
    .filter(Boolean);
}
function matchList(tokens, list) {
  const found = [];
  for (const w of list) {
    if (w.endsWith('!*')) {
      const base = w.slice(0,-2);
      if (tokens.some(t => t === base || t.endsWith(base))) found.push(base);
    } else if (tokens.includes(w.toLowerCase())) {
      found.push(w);
    }
  }
  return [...new Set(found)];
}

/**
 * @param {{title:string; summary:string; lang:Lang}} input
 * @returns {GuardResult}
 */
function ptiGuard(input) {
  const lang = input.lang || 'en';
  const text = `${input.title || ''} ${input.summary || ''}`.trim();
  const tokens = tokenize(text);
  const sensational = matchList(tokens, SENSATIONAL[lang]);
  const hate = matchList(tokens, HATE_INCITEMENT[lang]);
  const unver = matchList(tokens, UNVERIFIED_CLAIMS[lang]);

  const hasAttribution = /as per|according to|officials|police|sources|report|pti|agency/i.test(text)
    || /जैसा कि|अधिकारियों|पुलिस|स्रोत|रिपोर्ट/i.test(text)
    || /મુજબ|અધિકારીઓ|પોલીસ|સ્ત્રોત|રિપોર્ટ/i.test(text);
  const needsAttr = REQUIRE_ATTRIBUTION[lang].some(r => r.test(text)) && !hasAttribution;

  const ptiFlags = [
    ...hate.map(w => `Hate/Incitement: ${w}`),
    ...(needsAttr ? ['Missing attribution for sensitive claim'] : []),
  ];
  const riskWords = [
    ...sensational.map(w => `Sensational: ${w}`),
    ...(!hasAttribution && unver.length ? unver.map(w => `Unverified certainty: ${w}`) : []),
  ];
  let advice = 'No legal/sensational issues detected.';
  if (ptiFlags.length || riskWords.length) {
    advice = 'Review required: avoid sensational words, add clear attribution, keep claims precise.';
  }
  return { ptiFlags, riskWords, advice };
}

module.exports = { ptiGuard };

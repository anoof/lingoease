import model from 'wink-eng-lite-web-model';
import winkNLP, { TokenItsFunction } from 'wink-nlp';
import word1000 from './wordlist/1000.json' with { type: 'json' };
import word2000 from './wordlist/2000.json' with { type: 'json' };
import word3000 from './wordlist/3000.json' with { type: 'json' };

const word1000Set = new Set(word1000);
const word2000Set = new Set(word2000);
// Unlike the 1000/2000 lists (bare arrays), 3000.json is `{ words, model }`.
const word3000Set = new Set((word3000 as { words: string[] }).words);

// Building a wink-nlp instance loads its full lexicon — expensive enough
// that doing it per call (especially client-side, per render) can exhaust
// memory. Build it once and reuse it for every analyzeChunks call.
let nlpInstance: ReturnType<typeof winkNLP> | null = null;
function getNlp() {
  if (!nlpInstance) {
    nlpInstance = winkNLP(model);
  }
  return nlpInstance;
}

export function analyzeChunks(chunks: string[], wordFreq: 1000 | 2000 | 3000) {
  const wordSet =
    wordFreq === 1000 ? word1000Set : wordFreq === 2000 ? word2000Set : word3000Set;
  const nlp = getNlp();
  const { its, as } = nlp;

  const lemmaFunc = its.lemma as TokenItsFunction<string>;

  const totalLemmasSet = new Set<string>();

  const analyzedChunks = chunks.map((c) => {
    const doc = nlp.readDoc(c);

    const tokens = doc.tokens();
    const filteredTokens = tokens.filter(
      (t) => t.out(its.type) !== 'punctuation' && t.out(lemmaFunc) !== 'in.'
    );
    const lemmas = filteredTokens.out(lemmaFunc);
    const words = filteredTokens.out();

    const lemmasOriginalWordsMap = new Map<string, string>();
    lemmas.forEach((l, i) => {
      const originalWord = words[i];
      if (originalWord) {
        lemmasOriginalWordsMap.set(l, originalWord);
      }
    });

    const uniqueLemmas = Array.from(new Set(lemmas));

    uniqueLemmas.forEach((l) => totalLemmasSet.add(l));

    const newWords = uniqueLemmas.filter((l) => {
      if (wordSet.has(l)) return false;
      if (!isNaN(Number(l))) return false;
      if (/^(i|you|he|she|it|we|they)'[a-z]+$/i.test(l)) return false;
      if (/^[a-z]+'s$/i.test(l)) return false;
      return true;
    });

    return {
      text: c,
      lemmas,
      lemmasOriginalWordsMap,
      newWords,
    };
  });

  const totalLemmas = Array.from(totalLemmasSet);

  const totalNewWords = Array.from(
    new Set(analyzedChunks.flatMap((chunk) => chunk.newWords))
  );

  return {
    analyzedChunks,
    totalNewWords,
    totalLemmasCount: totalLemmas.length,
    totalNewWordsCount: totalNewWords.length,
    newWordsRate: (totalNewWords.length / totalLemmas.length).toFixed(2),
  };
}

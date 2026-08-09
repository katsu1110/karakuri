import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const INBOX_PATH = path.resolve('data/inbox.json');

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function cleanJsonText(rawText) {
  let text = rawText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return text;
}

async function generateDraftWithModel(ai, modelName, prompt) {
  const model = ai.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const cleaned = cleanJsonText(responseText);
  return JSON.parse(cleaned);
}

async function generateDraft(ai, item) {
  const systemPrompt = `あなたは行動科学・社会心理学の査読論文を日本の読者にわかりやすく解説する専門ライターです。
与えられた論文のタイトルと英文抄録（abstract）を読み、以下の条件に厳密に従って日本語で解説用のJSONを出力してください。

【厳守事項】
1. title_ja: 直訳ではなく、論文の結論や内容がひと目でわかる日本語見出し（40字以内）。
2. summary_ja: ちょうど3文で構成する。
   - 1文目: 「何（目的・問い）を調べたか」
   - 2文目: 「何（結果・結論）がわかったか」
   - 3文目: 「どこまで言えるか（研究の限界・条件・サンプルの偏りなど）」
   - 英文抄録の逐語訳ではなく、自分の言葉で分かりやすく書き直すこと。
   - 相関関係を因果関係として書かないこと。サンプルが学生のみや特定国のみの場合は3文目に明記すること。
3. why_ja: ちょうど1文。「この知見が日常や社会のどんな場面で役立つか・効くか」。
4. confidence: 抄録の内容から確証が持てる場合は "high"、抄録が不鮮明または判断材料が不足している場合は "low"。

【出力形式】
JSONオブジェクトのみを出力してください。キーは title_ja, summary_ja, why_ja, confidence の4つです。

論文情報:
タイトル: ${item.title_en}
著者: ${(item.authors || []).join(', ')}
掲載誌: ${item.venue}
英文抄録:
${item.abstract_en}`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastErr = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const prompt = attempt === 1
          ? systemPrompt
          : `${systemPrompt}\n\n注意: 前回出力のパースに失敗しました。余計な文字列を含めず、厳格なJSONオブジェクトのみを出力してください。`;
        const data = await generateDraftWithModel(ai, modelName, prompt);

        if (
          typeof data.title_ja === 'string' &&
          typeof data.summary_ja === 'string' &&
          typeof data.why_ja === 'string' &&
          ['high', 'low'].includes(data.confidence)
        ) {
          return data;
        }
        throw new Error('JSON response does not match required schema fields');
      } catch (err) {
        console.warn(`Attempt ${attempt} with ${modelName} failed: ${err.message}`);
        lastErr = err;
      }
    }
  }

  throw lastErr;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is missing.');
    process.exit(1);
  }

  if (!fs.existsSync(INBOX_PATH)) {
    console.log('inbox.json does not exist.');
    return;
  }

  const inbox = JSON.parse(fs.readFileSync(INBOX_PATH, 'utf-8'));
  const newItems = inbox.filter((item) => item.status === 'new');

  if (newItems.length === 0) {
    console.log('No "new" items to draft in inbox.json.');
    return;
  }

  console.log(`Found ${newItems.length} "new" item(s). Drafting up to 5 items...`);
  const ai = new GoogleGenerativeAI(apiKey);
  const todayStr = getTodayStr();

  let draftedCount = 0;
  for (const item of inbox) {
    if (item.status !== 'new') continue;
    if (draftedCount >= 5) break;

    console.log(`Drafting [${item.id}] ${item.title_en}...`);
    try {
      const draft = await generateDraft(ai, item);
      item.title_ja = draft.title_ja;
      item.summary_ja = draft.summary_ja;
      item.why_ja = draft.why_ja;
      item.confidence = draft.confidence;
      item.status = 'draft';
      item.drafted_at = todayStr;
      draftedCount++;
      console.log(`✓ Successfully drafted [${item.id}] (confidence: ${draft.confidence})`);
    } catch (err) {
      console.error(`✗ Failed to draft [${item.id}]: ${err.message}`);
      item.status = 'draft-failed';
    }
  }

  fs.writeFileSync(INBOX_PATH, JSON.stringify(inbox, null, 2), 'utf-8');
  console.log(`Drafting complete. Updated inbox.json (${draftedCount} drafted).`);
}

main().catch((err) => {
  console.error('Fatal error in draft-papers:', err);
  process.exit(1);
});

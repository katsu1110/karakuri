# からくり (KARAKURI)

行動科学・社会心理学の査読論文を、日本の読者向けに毎日 1〜5 件「やさしい日本語」で解説する静的サイト。

- 本番: <https://karakuri-gamma.vercel.app>（Vercel Git 連携、`main` push で自動デプロイ）
- リポジトリ: `katsu1110/karakuri`

## スタック

Vanilla JS (ES modules) + Vite 6 のマルチページビルド。フレームワークなし、クライアント側に API キーを置かない。生成はすべてビルド前の Node スクリプト。

```
index.html  article.html  policy.html   ← build.rollupOptions.input の明示エントリ必須
src/main.js       記事一覧レンダラ（全文字列 esc() でエスケープ）
src/article.js    記事ビューア（slug は encodeURIComponent）
content/articles/*.md    記事ソース（frontmatter: slug/date/title/status/sources/episode_ref/researcher）
content/guests.json      ゲスト登録簿 — 手動管理のみ、ID は実在する OpenAlex author ID
data/inbox.json          パイプラインのキュー（唯一 cron が触って良いファイル）
public/data/papers.json  公開フィード（人間承認済みのみ、abstract_en 禁止、DOI 必須）
public/data/articles.json  記事索引（build 生成）
public/articles/*.html  生成済み記事（build が差し替え、stale は必ず purge）
scripts/…               パイプライン各段（下記 run script 参照）
.github/workflows/daily-feed.yml  毎日 21:00 UTC (06:00 JST)、手動 dispatch 可
.github/workflows/deploy.yml       push 時 `npm ci && npm run build` の CI 検証
```

## データパイプライン

```
OpenAlex (論文 高々25件/日, 直近14日, 対象ソース+サブフィールド, 抄録あり)
  └─ feed:fetch   → data/inbox.json に status:"new" で追記（重複 ID スキップ）
       └─ feed:draft → Gemini (gemini-2.5-flash→2.0-flash フォールバック) が
            title_ja(<40字)・summary_ja(3文: 目的/結果/限界)・why_ja(1文)・confidence
            を JSON のみで生成 → status:"draft"
            ├─ feed:autoapprove (cron) → confidence:"high" かつ必須項目+DOI あり
            │    のみ status:"approved"（それ以外は人間待ちのまま）
            │        └─ feed:publish (cron) → public/data/papers.json に published で
            │              追加（abstract_en 削除）+ data/inbox.json 更新
            └─ confidence:"low" は human レビュー → approved/rejected を手で付け、
                  必要なら文面を直して「公開ショートカット」で出す
```

inbox 状態遷移: `new` → `draft` → `approved` → `published`（または `rejected`）。

## 公開ポリシー（ハイブリッド、2026-08-09 決定）

- **Policy B（新着フィード）**: `confidence:"high"` のドラフトのみ cron が自動で approved → publish する。low / 必須フィールド欠落 / DOI 無しは自動では絶対に公開しない — 人間レビュー待ち。
- **Policy A（深掘り記事）**: `content/articles/*.md` は誰も自動で公開しない — 人間が frontmatter を `status: published` にするのが唯一の経路。
- 手動公開ショートカットの対象は (1) `low` を人間が確認して出したい場合 (2) 文面を修正した場合 (3) 深掘り記事 の 3 つ。詳細は `.agents/skills/karakuri-publish/SKILL.md`。

## 常用コマンド

```bash
npm run dev            # ローカル開発サーバ
npm run build          # 記事ビルド + Vite trim (dist/)
npm run feed:fetch     # OpenAlex から new を取得（要 OPENALEX_MAILTO env）
npm run feed:draft     # Gemini でドラフト生成（要 GEMINI_API_KEY env）
npm run feed:autoapprove  # confidence:"high" → approved（cron 内で実行）
npm run feed:publish   # approved → 公開（cron が実行。手動でも可）
npm run guest:resolve  # author name → OpenAlex ID 解決（手動確認用）
npm run guest:works    # ゲストの最新作一覧
node scripts/verify-all.js  # 全検証（5/5 全成功のみコミット可）
gh workflow run "Daily Feed Drafts" --repo katsu1110/karakuri   # 手動トリガ
```

## 検証スイート（verify-all.js, 5 項目）

1. inbox.json 実在・件数
2. papers.json 公開件数 & 非 abstract_en 検証
3. articles の JSON/HTML 一致 + 帰属ボックス存在
4. public 成果物に Simplecast/RSS URL 無し
5. public/articles の stale HTML 無し（publish スラッグとの完全一致）

変更後は `npm run build && node scripts/verify-all.js` が pass している状態で提出する。

## 不変条件（Invariants）

1. **DOI 必須**: 公開前の feed アイテムに必ず DOI があること。無い場合はスキップして警告（`publish-papers.js` が強制）。
2. **`abstract_en` を公開物に混入しない**: `public/` 以下のどのファイルにも含めない。publish 時に削除済みであることを verify-all が検証する。
3. **cron の書き込み範囲**: daily-feed.yml が書き込むのは `data/inbox.json` と `public/data/papers.json` の 2 ファイルのみ。それ以外の `public/` 生成物は cron から触らない。
4. **ブランド・権利**: 「Hidden Brain」の番組素材の転載・翻訳・要約はしない。エピソード言及記事には必ず標準帰属文を入れる。RSS/Simplecast 音声 URL は public 成果物に一切含めない。
5. **本人の作品または手元に実在する物以外の author ID・DOI を考案しない**。
6. **XSS 対策**: `src/*.js` の DOM 注入は必ず `esc()` を通す。slug や外部 URL は `encodeURIComponent`。

## 留意点

- `main` への push は Vercel 本番デプロイ。テスト・失敗確認は作業ブランチで。
- policy.html の連絡先はメール収集対策のため難読化表示（`code1110g-show [at] hotmail.co.jp`）。生アドレスを policy.html に記載しない。
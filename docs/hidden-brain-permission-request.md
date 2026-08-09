# Hidden Brain Media 許諾打診メールおよび note.com クロスポスト運用手順

## 1. Permission Request Email Draft (`business@hiddenbrain.org`)

**To:** business@hiddenbrain.org  
**Subject:** Permission request — Japanese-language coverage of research featured on Hidden Brain

```text
Dear Hidden Brain Media team,

I'm a longtime listener based in Japan. There is currently no Japanese-language outlet covering the behavioral science that your show explores, and I'd like to help change that.

I have launched a small Japanese site, KARAKURI (https://karakuri-gamma.vercel.app), which writes original Japanese explainers about the *published, peer-reviewed research* of scholars who appear on your show. I do not translate, summarize, crawl, or reproduce any Hidden Brain audio, transcripts, artwork, or text; I link to the episode and credit it as where I learned of the topic, nothing more.

Two requests:
1. Please confirm that linking to an episode and naming it in this credit line is acceptable to you.
2. If you would ever consider authorizing licensed Japanese-language episode summaries or subtitles, I would be glad to discuss terms.

I'll happily change or remove anything you're not comfortable with.

Sincerely,
Katsuhisa / contact@karakuri.example.com / https://karakuri-gamma.vercel.app
```

---

## 2. note.com クロスポスト運用手順

`KARAKURI` に深掘り記事を公開した際、SEOの重複コンテンツ扱いを避けつつ note.com から集客するための手順:

### 投稿手順
1. `content/articles/<slug>.md` から**冒頭〜結論の手前まで**をコピーする。
2. note.com のエディタに貼り付け、文末に以下の導線を追加する:
   > 続きを読む（全文・参考文献・詳細解説は本家サイトで公開中）:  
   > 👉 [KARAKURI で全編を読む](https://karakuri-gamma.vercel.app/article.html?slug=<slug>)
3. 記事の末尾に一次資料の DOI リンクを明記する。
4. note に投稿完了後、発行された note 記事の URL を `content/articles/<slug>.md` の frontmatter 内 `note_url: "..."` に書き戻す。

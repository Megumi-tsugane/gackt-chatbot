# gackt-chatbot プロジェクトルール

@AGENTS.md

## 概要
GACKTさんのファン向けチャットボット。Next.js (App Router) + TypeScript + Vercel + Anthropic Claude。
Telegram Bot・公式LINEとWebhookで連携済み。

## 絶対に守ること
- APIキー・トークン類をコードに直接書かない（.env.local の環境変数を使う）
- .env.local は .gitignore 対象なのでコミットしない
- 作業が終わったら ~/Desktop/Obsidian/work_log.md に1行記録する
- コミット前に npm run build を通してからpushする

## 技術スタック
- フレームワーク: Next.js 15（App Router）+ TypeScript
- デプロイ: Vercel（mainブランチへのpushで自動デプロイ）
- AI: Anthropic Claude（claude-sonnet-4-6）
- 外部連携: Telegram Bot API / LINE Messaging API（Webhookで受け取り・APIで返信）

## ディレクトリ構成
app/api/chat/route.ts               … メインチャットAPI
app/api/telegram/webhook/route.ts   … Telegram Webhook
app/api/line/webhook/route.ts       … LINE Webhook
app/components/ChatInterface.tsx    … チャットUI
lib/knowledge.ts                    … GACKTナレッジベース

## コマンド
- 開発サーバー起動: npm run dev
- ビルド確認: npm run build
- デプロイ: git add . && git commit && git push

## 環境変数（.env.local）
ANTHROPIC_API_KEY         … Anthropic APIキー
TELEGRAM_BOT_TOKEN        … BotFatherで発行したトークン
TELEGRAM_SECRET_TOKEN     … Webhook合言葉（自分で決める）
LINE_CHANNEL_SECRET       … チャネルシークレット
LINE_CHANNEL_ACCESS_TOKEN … チャネルアクセストークン

## リポジトリ・デプロイ先
GitHub: https://github.com/Megumi-tsugane/gackt-chatbot
本番URL: https://gackt-chatbot.vercel.app/

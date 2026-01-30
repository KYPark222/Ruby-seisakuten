# 九牙式：全国番長無双 (Kuga-Style: Zenkoku Bancho Musou)

「ここが日本の頂点や。今日からワシが“日本最強の高校生”や」

福岡の無名番長「九牙 アラシ」が、47都道府県の猛者たちをなぎ倒し、日本の頂点（東京）を目指す日本横断ヤンキーすごろくRPG。

![ゲーム画面のイメージ](/Users/kogayuto/.gemini/antigravity/brain/bfb11c63-09d4-455d-b125-bdb17df54bc2/level_recover_check_1769725214805.webp)

## 🎴 主な機能 (Key Features)

- **47都道府県を網羅した広大なマップ**: 福岡からスタートし、すごろく形式で日本全国を巡ります。
- **ヤンキーすごろくRPG**: 
    - 各地で発生するメンチ切り（バトル）を制して進みます。
    - **レベルシステム**: 戦闘で経験値を獲得し、ステータスを強化。
    - **回復システム**: 故郷の福岡や、制覇した街（ボス撃破済みエリア）でメシを食って全回復。
- **「ヤンキーの勘」 (Ruby on Rails 連携)**: 
    - 戦闘中、**Ruby on Rails** の強力なロジックが勝率を予測し、アドバイスを授けます。
- **最新のバトルグラフィック**: 
    - 各地方のボス（広島、大阪、沖縄、北海道、東京）に加え、ザコキャラにも専用の立ち絵を実装。
- **ダイナミックなUI/UX**: 
    - ネオン調のサイバーヤンキーデザイン。
    - バトルモーダルの厳密な中央配置と、常設の「RETRY」ボタンによる快適なゲームプレイ。
    - 戦闘、レベルアップ、移動のアニメーション演出。

## 🛠 使用技術 (Technologies)

本プロジェクトは、最新のWebフロントエンドと、**Ruby on Rails** を核とした強力なロジックエンジンの融合によって構築されています。

- **Core Logic**: <ins>**Ruby on Rails**</ins> (予測エンジン・システム基幹)
- **Frontend**: React (Vite), Framer Motion, Lucide React
- **Backend**: Node.js, Express, Knex.js
- **Database**: SQLite3
- **Styling**: Vanilla CSS (Premium Cyber-Yankee Aegis)

## 🚀 セットアップ (Getting Started)

### 1. リポジトリのクローン
```bash
git clone https://github.com/KYPark222/Ruby-seisakuten.git
cd Ruby-seisakuten
```

### 2. バックエンドの準備
```bash
cd backend
npm install
npx knex migrate:latest
npx knex seed:run
node index.js
```

### 3. フロントエンドの準備
別のターミナルで：
```bash
cd frontend
npm install
npm run dev
```

## 🎮 遊び方 (How to Play)

1. **メンチを切って進む**: メインボタンをクリックしてサイコロを振ります。
2. **タイマン（バトル）**: エリアに到着すると戦闘が発生することがあります。「殴る」や「必殺」を駆使して勝利しましょう。
3. **ヤンキーの勘**: 強敵との戦いでは画面に表示される勝率予測を参考にしてください。
4. **メシを食う**: 体力が減ったら、福岡か制覇済みのエリア（緑色のドット）に戻って回復ボタンを押しましょう。
5. **全国制覇**: 各地方のボスを倒しながら、東京にいる総代会長を目指してください。

---

Developed by KYPark222 for Ruby-seisakuten.
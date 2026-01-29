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
- **「ヤンキーの勘」 (Ruby連携)**: 
    - 戦闘中、Ruby言語で書かれたロジックが勝率を予測し、アドバイスを授けます。
- **ダイナミックなUI**: 
    - ネオン調のサイバーヤンキーデザイン。
    - 都道府県ごとに最適化されたラベル配置。
    - 戦闘、レベルアップ、移動のアニメーション演出。

## 🛠 技術スタック (Tech Stack)

- **Frontend**: React (Vite), Framer Motion, Lucide React, Axios
- **Backend**: Node.js, Express, Knex.js, SQLite3
- **Logic Engine**: Ruby (ヤンキーの勘ロジック)
- **Styling**: Vanilla CSS (Custom Design System)

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
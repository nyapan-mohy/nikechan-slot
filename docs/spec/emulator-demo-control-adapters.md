# エミュレーター展示・デバッグ制御アダプタ仕様

## 目的

公開用エミュレーターでは、展示、説明、デバッグのために通常遊技とは異なる操作補助が必要になる。

この資料では、以下の機能を通常の遊技コアに密結合させず、エミュレーター専用アダプタとして取り入れる方針を定義する。

- オートモード
- リールWaitなし
- 強制BIG成立ボタン
- 強制REG成立ボタン

これらは実機仕様ではなく、ブラウザエミュレーターの展示・検証・デバッグ機能として扱う。

## 基本方針

- `core` は通常の抽選、停止制御、入賞判定、払出、状態遷移だけを担当する
- `core` は DOM、Canvas、音、ボタンUI、自動操作タイマーに依存しない
- オート操作、Wait短縮、強制成立は `emulator` または `ui` 側のアダプタで扱う
- 強制BIG/REGは通常抽選テーブルを書き換えない
- 強制BIG/REGを使ったゲームはログに `forced: true` を残す
- シミュレーションレポートでは、通常抽選ゲームと強制成立ゲームを分けて集計する
- 公開UIでは、展示用機能であることが分かる領域に配置する
- 実機化資料には、これらの機能を含めない

## 推奨構成

```text
src/core/
  game-state.ts
  lottery.ts
  reel.ts
  stop-control.ts
  payout.ts

src/emulator/
  game-service.ts
  outcome-resolver.ts
  auto-player.ts
  demo-controls.ts
  timing-profile.ts
  event-log.ts

src/ui/
  canvas-renderer.ts
  input.ts
  panels.ts
  sound.ts
```

責務:

- `game-service.ts`: UIやオートモードからの操作コマンドを受け、`core` を進める
- `outcome-resolver.ts`: 通常抽選または強制成立を選び、次ゲームの成立役を返す
- `auto-player.ts`: BET、START、STOPを自動実行する
- `demo-controls.ts`: 強制BIG/REG、Waitなし、オートモードなどの展示用操作を管理する
- `timing-profile.ts`: リールWait、停止間隔、演出待ち時間を管理する
- `event-log.ts`: 通常抽選、強制成立、自動操作、手動操作を記録する

## 操作コマンド

UI、キーボード、オートモードは、直接 `core` を触らず、以下のようなコマンドを `game-service` に送る。

```text
betMax
start
stopLeft
stopCenter
stopRight
forceBigNextGame
forceRegNextGame
setAutoMode
setTimingProfile
resetGame
```

`game-service` は現在状態を見て、許可できる操作だけを実行する。

## オートモード

オートモードは、手動操作と同じコマンドを順番に送るだけのアダプタとする。

処理順:

1. クレジットが足りるか確認する
2. `betMax` を送る
3. `start` を送る
4. 左リールを止める
5. 中リールを止める
6. 右リールを止める
7. 払出、告知、状態遷移が完了するまで待つ
8. オート継続条件を満たす場合、次ゲームへ進む

設定項目:

- 有効/無効
- 実行ゲーム数
- 停止順
- STOP間隔
- ボーナス成立時に停止するか
- クレジット不足時に停止するか
- 強制成立ゲームも継続するか

制約:

- オートモードは抽選結果を直接決めない
- オートモード中も `game-service` の状態チェックを通す
- 手動操作が入った場合は一時停止できる
- 公開版では、通常遊技UIと区別できる表示にする

ログ項目:

```json
{
  "type": "autoCommand",
  "command": "stopLeft",
  "gameNo": 120,
  "source": "auto",
  "timestamp": "..."
}
```

## リールWaitなし

リールWaitなしは、遊技結果ではなくタイミング制御の設定として扱う。

通常モード:

- START後にリール回転演出を一定時間表示する
- STOP操作間にも最小待ち時間を設ける
- 告知、払出、状態遷移の表示時間を確保する

Waitなしモード:

- START直後にSTOP可能にする
- STOP間隔を最小化する
- 払出や告知の表示待ちを短縮する
- コアの状態遷移順序は変えない

実装方針:

- `timing-profile.ts` に `normal` と `instant` を用意する
- `core` は時間を持たない
- `ui` と `auto-player` だけが `timing-profile` を参照する
- Waitなしでも、イベント発火順は通常モードと同じにする

例:

```json
{
  "id": "instant",
  "reelSpinMs": 0,
  "stopIntervalMs": 0,
  "payoutDisplayMs": 0,
  "bonusNoticeMs": 0
}
```

## 強制BIG/REG成立ボタン

強制BIG/REGは、次ゲームの成立役を指定する展示・デバッグ機能とする。

基本動作:

- ボタンを押すと、次ゲームの成立役予約に `BIG` または `REG` をセットする
- すでにボーナス成立中の場合は、原則として予約を受け付けない
- 次の `start` 時に通常抽選ではなく予約された成立役を返す
- 使用後、予約は必ず消す
- ログに強制成立であることを残す

予約状態:

```json
{
  "forcedOutcome": {
    "roleId": "BIG",
    "consumeOn": "nextStart",
    "createdBy": "demoControl"
  }
}
```

抽選結果ログ:

```json
{
  "type": "lotteryResolved",
  "gameNo": 42,
  "roleId": "BIG",
  "forced": true,
  "source": "demoControl"
}
```

制約:

- 抽選テーブルの確率値は変更しない
- 通常シミュレーションでは無効にする
- 強制成立ゲームは出玉率レポートから除外できるようにする
- 強制BIG/REGボタンは公開UIでは展示用またはデバッグ用として明示する
- 実機仕様書には含めない

## アダプタ境界

成立役を決める処理は、以下のような境界で切る。

```text
UI / AutoPlayer / DemoControls
  -> GameService
    -> OutcomeResolver
      -> ForcedOutcomeQueue
      -> Lottery
    -> Core State Transition
```

通常時:

```text
OutcomeResolver -> Lottery -> 抽選テーブルから成立役を返す
```

強制成立予約あり:

```text
OutcomeResolver -> ForcedOutcomeQueue -> BIG または REG を返す
```

重要なのは、`Lottery` 自体にデバッグ条件を入れないこと。通常抽選と強制成立を `OutcomeResolver` で切り替えることで、通常ロジックと展示機能を分離する。

## UI配置方針

展示用コントロールは通常の遊技ボタンと混同しない場所に置く。

最低限のボタン:

- オート開始/停止
- Waitなし切替
- 強制BIG
- 強制REG

表示項目:

- オートモード中
- Waitなし有効
- 強制BIG予約中
- 強制REG予約中
- 現在ゲームが強制成立かどうか

## テスト観点

- オートモードで BET、START、STOP が順に実行される
- オートモードはクレジット不足で停止する
- オートモード中も通常抽選が行われる
- Waitなしでもイベント順序が変わらない
- Waitなしでも手動操作とオート操作が破綻しない
- 強制BIGを押すと次ゲームでBIGが成立する
- 強制REGを押すと次ゲームでREGが成立する
- 強制成立後、予約が残らない
- ボーナス成立中に強制成立予約が重複しない
- 強制成立ゲームがログで識別できる
- 通常シミュレーション集計から強制成立ゲームを除外できる

## 公開前チェック

- 展示用機能であることがUI上または説明文で分かる
- 通常遊技ボタンと展示用ボタンが混同されない
- 強制成立を使った場合、レポート上で通常抽選と区別できる
- 実機仕様、検定資料、基板回路資料に混入していない

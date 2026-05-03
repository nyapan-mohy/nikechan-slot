# メイン基板ログシミュレーター仕様

## 目的

第一段階では、筐体Canvasや演出を作る前に、メイン基板相当の処理ログをブラウザ上に表示するターミナル風シミュレーターを作る。

ここでいうメイン基板は物理基板ではなく、エミュレーター内の `core` が担当する主制御相当の処理を指す。

対象:

- 現在設定
- 乱数シード
- BET
- START
- 役抽選
- リール停止制御
- 入賞判定
- 払出
- ボーナス内部成立
- ボーナス図柄入賞
- ボーナス状態遷移
- クレジット変動

対象外:

- 筐体Canvas表示
- 液晶演出
- ランプ演出
- 音
- 本制作素材
- 物理基板、ROM、回路

## 第一段階の画面

第一段階のUIは、ターミナル風のログ画面だけでよい。

最低限の表示:

- ログ出力エリア
- 現在状態
- 現在設定
- 乱数シード
- ゲーム数
- クレジット
- BET
- 内部ボーナス状態

最低限の操作:

- 1ゲーム実行
- Bonusまで実行
- リセット
- 設定選択
- シード指定
- ログクリア

`Bonusまで実行` は、初期版では `bonusFlagRaised`、つまりボーナス内部成立まで自動でゲームを進める。必要に応じて、後で `bonusStarted`、つまりボーナス図柄入賞まで進めるモードを追加する。

## 実行単位

1ゲーム実行では、以下を1単位としてログに出す。

```text
BET
START
LOTTERY
STOP_LEFT
STOP_CENTER
STOP_RIGHT
WIN_EVALUATION
PAYOUT
STATE_TRANSITION
```

オートモードとは分ける。第一段階のログシミュレーターは、デバッグ用に固定停止順、固定押下位置、または疑似押下位置で1ゲームを進める。

## ログ形式

ログは人間が読めるテキストを主表示とし、内部的には構造化イベントを保持する。

表示例:

```text
[000128] state=normal setting=3 credit=47 seed=0x12AB34CD
[000128] BET max=3 credit=44
[000128] START reelPositions L=12 C=03 R=18
[000128] LOTTERY bonus=null smallRole=BELL replay=false table=normal-setting3 forced=false
[000128] STOP L push=12 stop=14 slip=2 visible=[LOGO_BAR,BELL,REPLAY]
[000128] STOP C push=03 stop=05 slip=2 visible=[BELL,CHERRY,SUIKA]
[000128] STOP R push=18 stop=20 slip=2 visible=[AI_NIKECHAN,BELL,LOGO_BAR]
[000128] WIN role=BELL line=upDiagonal payout=5
[000128] PAYOUT credit=49 delta=+2
[000128] END state=normal gamesSinceBonus=128
```

ボーナス成立時の例:

```text
[000241] LOTTERY bonus=BIG smallRole=null replay=false table=normal-setting3 forced=false
[000241] BONUS_FLAG type=BIG announced=false
[000241] STOP_RESULT tag=reachPattern bonusEntered=false
[000241] END state=bonusFlagged carriedBonus=BIG
```

ボーナス図柄入賞時の例:

```text
[000244] STOP_RESULT tag=bonusEntered role=BIG
[000244] BONUS_SYMBOL_ENTERED type=BIG
[000244] STATE bonusFlagged -> bonusActive bonusType=BIG
```

## 構造化イベント

画面表示用テキストとは別に、以下のイベントを保持する。

```text
gameStarted
betAccepted
lotteryResolved
reelStopped
winEvaluated
payoutApplied
bonusFlagRaised
bonusSymbolEntered
bonusStarted
bonusEnded
stateChanged
creditChanged
settingChanged
simulationStopped
```

構造化イベント例:

```json
{
  "type": "lotteryResolved",
  "gameNo": 241,
  "settingId": "setting3",
  "tableId": "normal-setting3",
  "bonus": "BIG",
  "smallRole": null,
  "isReplay": false,
  "forced": false,
  "seedBefore": "0x12AB34CD",
  "seedAfter": "0x9988FF00"
}
```

## 実装構成

```text
src/core/
  rng.ts
  setting.ts
  lottery-table.ts
  lottery.ts
  stop-control.ts
  line-evaluator.ts
  payout.ts
  bonus-state.ts
  game-state.ts
  event-emitter.ts

src/emulator/
  game-service.ts
  main-board-log-adapter.ts
  event-log.ts
  state-exporter.ts

src/simulator/
  one-game-runner.ts
  run-until-bonus.ts

src/ui/
  terminal-log-view.ts
```

責務:

- `game-service.ts`: 1ゲーム進行の入口。
- `main-board-log-adapter.ts`: `core` のイベントをメイン基板ログ風の表示行に変換する。
- `event-log.ts`: 構造化イベントを保存する。
- `state-exporter.ts`: 現在状態スナップショットを返す。
- `one-game-runner.ts`: 1ゲームだけ進める。
- `run-until-bonus.ts`: Bonus到達条件までゲームを繰り返す。
- `terminal-log-view.ts`: ブラウザ上のターミナル風UIにログを表示する。

## Bonusまで実行

`run-until-bonus` は、指定条件に到達するまで1ゲームずつ実行する。

初期条件:

- `stopCondition: "bonusFlagRaised"`
- `maxGames: 10000`
- `settingId`
- `seed`
- `stopOrder: ["left", "center", "right"]`
- `pushStrategy: "fixed"` または `pushStrategy: "pseudoRandom"`

停止条件:

- ボーナス内部成立
- 最大ゲーム数到達
- クレジット不足
- エラー発生
- ユーザー停止

実行中も1ゲームごとにログを画面へ追記する。大量ログになるため、表示は直近N行に制限し、構造化イベントは別に保持できるようにする。

## 最終統合UI

最終的には、1つのブラウザ内に以下を同時表示する。

- 内部状態パネル
- メイン基板ログターミナル
- HTML + Canvas の筐体表示
- 筐体動作、リール動作、ランプ、液晶
- シミュレーション操作
- データ表示端末
- スランプグラフ

統合後も、遊技結果を決める処理は `core` に閉じる。Canvas、音、ランプ、ログ、スランプグラフは `core` のイベントを購読して表示する。

## UIレイアウト方針

第一段階:

```text
┌──────────────────────────────────────┐
│ 状態 / 設定 / Seed / Credit           │
├──────────────────────────────────────┤
│ [1ゲーム実行] [Bonusまで実行] [停止]  │
├──────────────────────────────────────┤
│ ターミナル風ログ                      │
│ ...                                  │
└──────────────────────────────────────┘
```

最終段階:

```text
┌───────────────┬──────────────────────┐
│ Canvas筐体     │ 内部状態 / データ端末 │
│ リール/液晶/灯 │ スランプグラフ         │
├───────────────┴──────────────────────┤
│ シミュレーション操作 / 展示操作        │
├──────────────────────────────────────┤
│ メイン基板ログターミナル              │
└──────────────────────────────────────┘
```

## テスト観点

- 1ゲーム実行で、BETから状態遷移までのログが出る。
- `Bonusまで実行` で、ボーナス内部成立まで自動実行される。
- 到達したBonus種別、ゲーム数、設定、シードがログに残る。
- 同じ設定、同じシード、同じ押下戦略なら同じログになる。
- ログ表示が遊技結果を変更しない。
- Canvas未実装でも、コア状態遷移と抽選結果を確認できる。
- 最終統合UIでも、ログ、筐体表示、スランプグラフが同じイベントソースから更新される。

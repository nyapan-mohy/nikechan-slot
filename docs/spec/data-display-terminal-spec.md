# データ表示端末仕様

## 目的

エミュレーター本体とは別機能として、遊技データを表示するデータ表示端末を実装する。

遊技機能は、現在状態、ゲーム結果、払出、ボーナス開始・終了などのデータを出力する。データ表示端末は、その出力を購読して集計・表示するだけにし、抽選、停止制御、入賞判定、払出、状態遷移には影響しない。

## 基本方針

- データ表示端末は遊技機能から分離する。
- データ表示端末は読み取り専用とする。
- データ表示端末から `core` の状態を変更しない。
- データ表示端末は `core` または `emulator` が出力するイベントログとスナップショットを入力にする。
- データ表示端末の集計値は、遊技結果の判定には使わない。
- 公開UIでは、遊技機パネルとデータ表示端末パネルを視覚的に分ける。

## 推奨構成

```text
src/core/
  game-state.ts
  event-emitter.ts

src/emulator/
  game-service.ts
  event-log.ts
  state-exporter.ts

src/terminal/
  data-counter.ts
  probability.ts
  slump-graph.ts
  terminal-panel.ts
```

責務:

- `event-emitter.ts`: ゲーム進行イベントを出力する。
- `event-log.ts`: イベントを時系列に保存する。
- `state-exporter.ts`: 現在状態の読み取り用スナップショットを作る。
- `data-counter.ts`: ゲーム数、BIG/REG、小役成立数などを集計する。
- `probability.ts`: 大当たり確率、小役成立確率を計算する。
- `slump-graph.ts`: 差枚または差クレジット推移を作る。
- `terminal-panel.ts`: データ表示端末UIを描画する。

## 入力イベント

データ表示端末は、以下のイベントを購読する。

```text
gameStarted
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
reset
```

イベント例:

```json
{
  "type": "gameStarted",
  "gameNo": 120,
  "state": "normal",
  "bet": 3,
  "timestamp": "..."
}
```

```json
{
  "type": "lotteryResolved",
  "gameNo": 120,
  "bonus": "BIG",
  "smallRole": "BELL",
  "forced": false,
  "timestamp": "..."
}
```

```json
{
  "type": "payoutApplied",
  "gameNo": 120,
  "payout": 5,
  "credit": 147,
  "delta": 5,
  "timestamp": "..."
}
```

## 表示項目

初期版では、以下を表示する。

- 現在の状態表示
- 現在設定
- 動作回転数
- ボーナス間ゲーム数
- BIG回数
- REG回数
- 大当たり確率
- 小役成立数
- 小役成立確率
- スランプグラフ

## 集計定義

### 現在の状態表示

`state-exporter` が返す現在状態を表示する。

対象状態:

- `normal`
- `bonusFlagged`
- `bonusSymbolEntered`
- `bonusActive`
- `bonusEnding`
- `error`

BIG/REG の違いは状態IDではなく、`bonusType` で表示する。

### 現在設定

`state-exporter` が返す現在設定を表示する。

表示例:

```text
設定1
設定6
```

ルール:

- データ表示端末から設定を変更しない。
- 設定変更は `settingChanged` イベントとしてログに残す。
- 設定変更をまたぐ集計は、全体集計と設定別集計を分けられるようにする。

### 動作回転数

通常時およびボーナス成立状態のゲーム数を数える。

ルール:

- `bonusActive` 中のゲームは含めない。
- `bonusEnding` 中の演出は含めない。
- リセット後は0に戻す。
- 強制BIG/REG成立ゲームを含めるかは表示設定で切り替え可能にする。

### ボーナス間ゲーム数

最後のボーナス終了後から、次のボーナス図柄入賞またはボーナス開始までの通常ゲーム数を数える。

ルール:

- ボーナス中ゲームは含めない。
- ボーナス成立状態で入賞できずに回したゲームは含める。
- 初回ボーナス前は、起動後の通常ゲーム数を表示する。
- BIG/REGどちらでもボーナス開始時に0へ戻す。

### BIG回数

BIGが開始した回数を数える。

カウントタイミング:

- `bonusStarted` イベントで `bonusType: "BIG"` のとき。

### REG回数

REGが開始した回数を数える。

カウントタイミング:

- `bonusStarted` イベントで `bonusType: "REG"` のとき。

### 大当たり確率

動作回転数に対する BIG+REG 回数で表示する。

表示例:

```text
1/132.4
```

計算:

```text
大当たり確率 = 動作回転数 / (BIG回数 + REG回数)
```

BIG回数 + REG回数が0の場合は `--` を表示する。

### 小役成立数

`lotteryResolved` の成立役をもとに、小役ごとに成立数を数える。

対象例:

- ベル
- チェリー
- リプレイ
- ブランクまたはハズレは小役成立数に含めない

表記はプロジェクト内では「小役」に統一する。UI上でユーザー向けに「子役」と出す必要がある場合は、表示ラベルだけを変える。

### 小役成立確率

動作回転数に対する小役成立数で表示する。

表示例:

```text
ベル 1/7.1
チェリー 1/32.4
リプレイ 1/7.3
```

計算:

```text
小役成立確率 = 動作回転数 / 対象小役成立数
```

成立数が0の場合は `--` を表示する。

### スランプグラフ

差枚または差クレジットの推移を折れ線で表示する。

初期版では、投入クレジットと払出クレジットの差分を使う。

```text
差クレジット = 累計払出 - 累計BET
```

記録タイミング:

- 1ゲーム終了ごと
- ボーナス中も記録する
- リセット時に0へ戻す

表示:

- 横軸: ゲーム進行
- 縦軸: 差クレジット
- 0ラインを表示する
- BIG/REG開始地点にマーカーを置けるようにする

## 状態スナップショット

データ表示端末は、イベントログだけでなく現在値のスナップショットも受け取れるようにする。

```json
{
  "state": "bonusFlagged",
  "bonusType": "BIG",
  "settingId": "setting3",
  "gameNo": 120,
  "displayGameCount": 88,
  "gamesSinceBonus": 88,
  "bigCount": 1,
  "regCount": 0,
  "bonusProbability": "1/88.0",
  "smallRoles": {
    "BELL": {
      "count": 12,
      "probability": "1/7.3"
    }
  },
  "slump": {
    "currentDelta": -36,
    "points": [
      { "gameNo": 1, "delta": -3 },
      { "gameNo": 2, "delta": 5 }
    ]
  }
}
```

## UI方針

データ表示端末は、遊技機本体の液晶や告知ランプとは別のパネルとして配置する。

表示ブロック:

- 状態
- 現在設定
- 回転数
- ボーナス情報
- 小役情報
- スランプグラフ

制約:

- 遊技機本体の演出に見せない。
- ボーナス告知や役判定の代替表示にしない。
- デバッグパネルとは分ける。
- 公開版でも表示してよいが、外部データ表示端末として扱う。

## テスト観点

- 通常ゲームで動作回転数が増える。
- 現在設定が `state-exporter` の値と一致する。
- データ表示端末から設定を変更できない。
- ボーナス中ゲームで動作回転数が増えない。
- ボーナス成立状態で入賞できずに回したゲームはボーナス間ゲーム数に含まれる。
- BIG開始時にBIG回数が増える。
- REG開始時にREG回数が増える。
- 大当たり確率が BIG+REG 回数をもとに計算される。
- 小役成立数が抽選結果をもとに増える。
- 小役成立確率が動作回転数をもとに計算される。
- スランプグラフがBETと払出の差分で更新される。
- データ表示端末から遊技状態を変更できない。

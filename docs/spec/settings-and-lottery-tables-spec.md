# 設定・抽選テーブル仕様

## 目的

この資料は、AType エミュレーターにおける設定の概念と、設定別の抽選テーブルを定義する。

初期版では、設定ごとに以下へ差を持たせる。

- BIG成立確率
- REG成立確率
- ベル成立確率
- リプレイ確率
- 想定出玉率

設定は遊技結果に直結するため、`core` の抽選処理が参照する正式な仕様データとして扱う。UIだけの表示項目やデバッグ値として扱わない。

## 設定段階

初期版では、設定1から設定6までを基本とする。

```text
setting1
setting2
setting3
setting4
setting5
setting6
```

方針:

- 設定1を最も低い出玉性能にする。
- 設定6を最も高い出玉性能にする。
- BIG、REG、ベル、リプレイに設定差を持たせる。
- チェリー、スイカは全設定共通にする。
- 小役の設定差はベルのみにし、リプレイは小役ではなく再遊技カテゴリとしてベース調整に使う。
- 設定ごとの確率は仕様書、データファイル、シミュレーション結果で照合できるようにする。
- 公開エミュレーターでは、設定選択をデバッグ/展示機能として扱う。
- 実機化時は、遊技者が設定を変更できない前提の資料へ分離する。

## 設定で差をつける項目

必須:

- BIG単独成立
- REG単独成立
- BIG + 小役同時成立
- REG + 小役同時成立
- ベル
- リプレイ

任意:

- 小役の内訳比率
- ボーナス種別比率
- 告知タイミング比率

初期版では、設定差を確認しやすくするため、BIG/REG とベルに設定差を持たせる。チェリー、スイカ、ボーナス同時成立チェリーは全設定共通にし、小役の設定差はベルだけで表現する。リプレイはベース40G/50枚を維持するために設定別の調整値を持つ。

## 抽選結果の構造

1ゲームの抽選は、設定に応じた抽選テーブルを参照する。

```json
{
  "settingId": "setting3",
  "tableId": "normal-setting3",
  "bonus": "BIG",
  "smallRole": "BELL",
  "isReplay": false
}
```

ルール:

- `settingId` はゲーム開始時点の現在設定を使う。
- 1ゲーム中に設定を変更しない。
- ボーナス成立状態中に設定変更を許可するかは、エミュレーター専用機能として別途制御する。
- 通常シミュレーションでは、指定した設定で固定して実行する。
- 設定変更イベントはログに残す。

## データファイル

```text
src/data/
  settings.json
  tables.json
  roles.json
```

`settings.json` 例:

```json
{
  "settings": [
    {
      "id": "setting1",
      "label": "設定1",
      "lotteryTableId": "normal-setting1",
      "bonusFlaggedTableId": "bonus-flagged-setting1",
      "bigTableId": "big-setting1",
      "regTableId": "reg-setting1",
      "expectedPayoutRate": 99.0
    },
    {
      "id": "setting6",
      "label": "設定6",
      "lotteryTableId": "normal-setting6",
      "bonusFlaggedTableId": "bonus-flagged-setting6",
      "bigTableId": "big-setting6",
      "regTableId": "reg-setting6",
      "expectedPayoutRate": 108.5
    }
  ],
  "defaultSettingId": "setting1"
}
```

`tables.json` 例:

```json
{
  "tables": [
    {
      "id": "normal-setting1",
      "settingId": "setting1",
      "denominator": 65536,
      "entries": [
        { "result": { "bonus": "BIG", "smallRole": null }, "weight": 211 },
        { "result": { "bonus": "REG", "smallRole": null }, "weight": 112 },
        { "result": { "bonus": null, "smallRole": "BELL" }, "weight": 12025 },
        { "result": { "bonus": null, "smallRole": "RARE_CHERRY" }, "weight": 1841 },
        { "result": { "bonus": null, "smallRole": "SUIKA" }, "weight": 64 },
        { "result": { "bonus": null, "smallRole": null, "isReplay": true }, "weight": 16640 },
        { "result": { "bonus": "BIG", "smallRole": "RARE_CHERRY" }, "weight": 46 },
        { "result": { "bonus": "REG", "smallRole": "RARE_CHERRY" }, "weight": 45 },
        { "result": { "bonus": null, "smallRole": null }, "weight": 34552 }
      ]
    }
  ]
}
```

この例は有効な JSON として扱える。実装前に、全エントリの重み合計が `denominator` と一致することを検証する。第一段階の具体値は `docs/spec/first-stage-minimum-data-spec.md` に定義する。

## 抽選テーブルの分類

通常時テーブル:

- `normal-setting1` から `normal-setting6`
- 通常時の BIG/REG、小役、リプレイ、ハズレを定義する。

ボーナス成立状態テーブル:

- `bonus-flagged-setting1` から `bonus-flagged-setting6`
- ボーナス持越し中の小役、リプレイ、ハズレを定義する。
- 新規 BIG/REG の重複成立は行わない。

ボーナス中テーブル:

- `big-setting1` から `big-setting6`
- `reg-setting1` から `reg-setting6`
- 初期版では設定差を持たせないことも可能だが、テーブルIDは分けておく。

## 確率表示

設定ごとの確率は、仕様書または生成レポートで以下の形式にする。

```text
設定1 BIG 1/255.0
設定1 REG 1/417.4
設定1 合算 1/158.3
設定1 ベル 1/5.45
設定1 非重複チェリー 1/35.6
設定1 スイカ 1/1024.0
設定1 リプレイ 1/3.94
```

計算:

```text
確率分母 = denominator / 対象weight合計
```

ボーナスと小役の同時成立がある場合:

- BIG確率には BIG単独 + BIG同時成立を含める。
- REG確率には REG単独 + REG同時成立を含める。
- チェリー成立確率には チェリー単独 + ボーナス同時成立チェリーを含める。
- ベル、スイカ、リプレイは単独成立のみで計算する。
- 入賞確率は、停止制御と目押し成功率に依存するため、成立確率とは別に扱う。

## コア実装方針

```text
src/core/
  setting.ts
  lottery.ts
  lottery-table.ts
  role-result.ts
```

責務:

- `setting.ts`: 現在設定を保持する。
- `lottery-table.ts`: 設定IDから抽選テーブルを解決する。
- `lottery.ts`: 現在状態と現在設定に応じて抽選する。
- `role-result.ts`: ボーナス、小役、リプレイの抽選結果を正規化する。

`lottery.ts` は、UIやデバッグパネルから直接設定値を受け取らない。`game-state` が持つ現在設定を参照する。

## 設定変更

公開エミュレーターでは、設定変更は展示・デバッグ機能として実装できる。

制約:

- 通常遊技中に勝手に変更しない。
- 変更時は `settingChanged` イベントを出す。
- シミュレーションでは、開始時に指定した設定で固定する。
- 設定変更をまたいだレポートは、設定別に分割して集計できるようにする。
- 実機仕様へ進む場合、設定変更UIは実機資料から除外する。

イベント例:

```json
{
  "type": "settingChanged",
  "from": "setting1",
  "to": "setting6",
  "source": "demoControl",
  "timestamp": "..."
}
```

## データ表示端末との関係

データ表示端末は現在設定を表示してよい。ただし、遊技結果の判定や抽選には影響しない。

表示候補:

- 現在設定
- 設定別の大当たり確率
- 設定別の小役成立確率

注意:

- 設定推測を煽る表現は公開UIでは避ける。
- 表示する場合は、エミュレーターの内部設定表示として扱う。

## シミュレーション

設定別に以下を出す。

- BIG成立確率
- REG成立確率
- BIG/REG合算確率
- ベル成立確率
- チェリー成立確率
- スイカ成立確率
- リプレイ確率
- 出玉率
- 差枚または差クレジット分布

設定1から設定6まで、同一ゲーム数、同一試行条件で比較できるようにする。

## テスト観点

- 設定1から設定6までの抽選テーブルが存在する。
- 現在設定に対応した抽選テーブルが使われる。
- BIG確率が設定別に変わる。
- REG確率が設定別に変わる。
- ベル確率が設定別に変わる。
- リプレイ確率が設定別に変わる。
- チェリー確率とスイカ確率は全設定共通になる。
- 抽選テーブルの重み合計が分母と一致する。
- ボーナス成立状態中に新規 BIG/REG が重複成立しない。
- 同じシード、同じ設定では同じ結果になる。
- 同じシードでも設定が違えば、参照テーブルが変わる。
- 設定変更イベントがログに残る。
- 設定別シミュレーションレポートを再生成できる。

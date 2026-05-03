# 第一段階最小データ仕様

## 目的

第一段階のメイン基板ログシミュレーターを動かすために必要な、最小限の遊技データを定義する。

この資料の値は初期実装用の仮仕様とする。後で数理設計を詰める場合でも、データ構造と実行可能性は維持する。

## 基本値

```json
{
  "reelCount": 3,
  "stops": ["left", "center", "right"],
  "reelLength": 21,
  "visibleRows": 3,
  "activeLines": ["top", "center", "bottom", "downDiagonal", "upDiagonal"],
  "maxBet": 3,
  "initialCredit": 10000,
  "maxSlip": 5,
  "defaultSettingId": "setting1",
  "defaultSeed": "0x12345678"
}
```

## 図柄ID

```json
[
  { "id": "AI_NIKECHAN", "label": "AIニケちゃん", "type": "bonus", "bonusType": "BIG" },
  { "id": "MASTER_NIKECHAN", "label": "Masterニケちゃん", "type": "bonus", "bonusType": "BIG" },
  { "id": "LOGO_BAR", "label": "ニケちゃんロゴBAR", "type": "bonus", "bonusType": "REG" },
  { "id": "BELL", "label": "ベル", "type": "smallRole" },
  { "id": "CHERRY", "label": "チェリー", "type": "smallRole" },
  { "id": "SUIKA", "label": "スイカ", "type": "smallRole" },
  { "id": "REPLAY", "label": "リプレイ", "type": "replay" },
  { "id": "BLANK", "label": "ブランク", "type": "blank" }
]
```

## リール配列

各リールは21コマとする。配列は上から下へ、インデックス `0` から `20` で管理する。

```json
{
  "left": [
    "CHERRY", "MASTER_NIKECHAN", "BELL", "SUIKA", "REPLAY", "SUIKA",
    "AI_NIKECHAN", "REPLAY", "SUIKA", "BELL", "LOGO_BAR", "CHERRY",
    "LOGO_BAR", "BELL", "REPLAY", "SUIKA", "MASTER_NIKECHAN",
    "MASTER_NIKECHAN", "MASTER_NIKECHAN", "REPLAY", "BELL"
  ],
  "center": [
    "BELL", "CHERRY", "SUIKA", "AI_NIKECHAN", "REPLAY", "BELL",
    "LOGO_BAR", "CHERRY", "REPLAY", "BELL", "CHERRY", "BELL",
    "REPLAY", "CHERRY", "SUIKA", "CHERRY", "BELL", "REPLAY",
    "MASTER_NIKECHAN", "CHERRY", "REPLAY"
  ],
  "right": [
    "REPLAY", "CHERRY", "AI_NIKECHAN", "BELL", "SUIKA", "REPLAY",
    "CHERRY", "BELL", "CHERRY", "REPLAY", "LOGO_BAR", "BELL",
    "CHERRY", "REPLAY", "CHERRY", "BELL", "SUIKA", "REPLAY",
    "MASTER_NIKECHAN", "BELL", "SUIKA"
  ]
}
```

この配列は、添付リール表をPJ図柄へ置換した初期配列とする。白7は `AI_NIKECHAN`、DONは `MASTER_NIKECHAN`、HANABI/BARは `LOGO_BAR`、涼は `SUIKA` として扱う。`AI_NIKECHAN` と `MASTER_NIKECHAN` は同一BIGフラグの図柄であり、どちらが有効ラインに揃ってもBIG入賞として扱う。最大滑り5コマ、有効5ラインのため、`BELL` と `REPLAY` はどの押下位置からでも成立時に3コマ窓内の有効ラインへ引き込める。

## 有効ライン

第一段階では、3コマ表示窓に対して5ラインを有効ラインとする。

```json
{
  "activeLineIds": ["top", "center", "bottom", "downDiagonal", "upDiagonal"],
  "lines": [
    {
      "id": "top",
      "label": "上段",
      "positions": {
        "left": 0,
        "center": 0,
        "right": 0
      }
    },
    {
      "id": "center",
      "label": "中段",
      "positions": {
        "left": 1,
        "center": 1,
        "right": 1
      }
    },
    {
      "id": "bottom",
      "label": "下段",
      "positions": {
        "left": 2,
        "center": 2,
        "right": 2
      }
    },
    {
      "id": "downDiagonal",
      "label": "右下がり",
      "positions": {
        "left": 0,
        "center": 1,
        "right": 2
      }
    },
    {
      "id": "upDiagonal",
      "label": "右上がり",
      "positions": {
        "left": 2,
        "center": 1,
        "right": 0
      }
    }
  ]
}
```

`positions` は、表示窓上の `0: 上段`、`1: 中段`、`2: 下段` を表す。

## 役定義

```json
[
  {
    "id": "REPLAY",
    "type": "replay",
    "winningPattern": ["REPLAY", "REPLAY", "REPLAY"],
    "payout": 0,
    "replay": true
  },
  {
    "id": "BELL",
    "type": "smallRole",
    "rarity": "normal",
    "requiresAim": false,
    "winningPattern": ["BELL", "BELL", "BELL"],
    "payout": 5
  },
  {
    "id": "RARE_CHERRY",
    "type": "smallRole",
    "rarity": "rare",
    "requiresAim": true,
    "winningPattern": ["CHERRY", "ANY", "ANY"],
    "payout": 2,
    "cornerPayout": 4,
    "missResultTags": ["rareMiss", "chancePattern"]
  },
  {
    "id": "SUIKA",
    "type": "smallRole",
    "rarity": "rare",
    "requiresAim": true,
    "winningPattern": ["SUIKA", "SUIKA", "SUIKA"],
    "payout": 15,
    "missResultTags": ["suikaMiss", "chancePattern"]
  },
  {
    "id": "BIG",
    "type": "bonus",
    "bonusType": "BIG",
    "winningPattern": [
      ["AI_NIKECHAN", "MASTER_NIKECHAN"],
      ["AI_NIKECHAN", "MASTER_NIKECHAN"],
      ["AI_NIKECHAN", "MASTER_NIKECHAN"]
    ],
    "payout": 0
  },
  {
    "id": "REG",
    "type": "bonus",
    "bonusType": "REG",
    "winningPattern": ["LOGO_BAR", "LOGO_BAR", "LOGO_BAR"],
    "payout": 0
  }
]
```

## ボーナス終了条件

```json
{
  "BIG": {
    "bonusType": "BIG",
    "entryRoleId": "BIG",
    "bet": 2,
    "payoutPerGame": 14,
    "netPerGame": 12,
    "gameCount": 21,
    "endByGrossPayout": 294,
    "endByNetPayout": 252,
    "endingState": "bonusEnding"
  },
  "REG": {
    "bonusType": "REG",
    "entryRoleId": "REG",
    "bet": 2,
    "payoutPerGame": 14,
    "netPerGame": 12,
    "gameCount": 8,
    "endByGrossPayout": 112,
    "endByNetPayout": 96,
    "endingState": "bonusEnding"
  }
}
```

## 払出仕様

通常時は MAXBET Only とし、3枚掛けで扱う。

| 役 | 払出 | 備考 |
| --- | ---: | --- |
| REPLAY | 0 | 払出は行わず、次ゲームが同じ掛け枚数で再遊技になる。3枚掛けなら取消不能の MAXBET が自動セットされる扱い。 |
| BELL | 5 | 通常小役。 |
| RARE_CHERRY | 2 | 1ライン入賞時。 |
| 角CHERRY | 4 | 2ライン入賞扱い。第一段階では5ライン化により判定対象に含める余地を残すが、初期実装の払出は成立した代表ライン1本分を採用する。 |
| SUIKA | 15 | レア小役。機械割調整用として扱い、確率が極端に重くなってもよい。 |
| BIG / REG 入賞 | 0 | ボーナス図柄入賞自体の払出はない。 |
| リーチ目 | 0 | 入賞役ではないため払出なし。 |

ボーナスゲーム中は、初期仕様では成立ベルOnlyとする。将来、設定看破用の差を入れる場合でも、まずはボーナス中テーブルを分けて拡張できるようにする。

| 状態 | 掛け枚数 | 成立役 | 払出 |
| --- | ---: | --- | ---: |
| BIG中 | 2 | BELL | 14 |
| REG中 | 2 | BELL | 14 |
 
ボーナス中は1Gあたり `14枚払出 - 2枚BET = 純増12枚` とする。BIG は21G消化、総払出294枚、純増252枚で終了する。REG は8G消化、総払出112枚、純増96枚で終了する。

## 設定別抽選テーブル

分母は `65536` とする。`NONE` はハズレを表す。

| 設定 | BIG | REG | BELL | RARE_CHERRY | SUIKA | REPLAY | BIG+RARE_CHERRY | REG+RARE_CHERRY | NONE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 設定1 | 211 | 112 | 12025 | 1841 | 64 | 16640 | 46 | 45 | 34552 |
| 設定2 | 213 | 118 | 12092 | 1841 | 64 | 16529 | 48 | 49 | 34582 |
| 設定3 | 218 | 133 | 12181 | 1841 | 64 | 16380 | 48 | 51 | 34620 |
| 設定4 | 225 | 149 | 12273 | 1841 | 64 | 16227 | 48 | 57 | 34652 |
| 設定5 | 229 | 172 | 12412 | 1841 | 64 | 15995 | 51 | 57 | 34715 |
| 設定6 | 248 | 191 | 12603 | 1841 | 64 | 15677 | 52 | 64 | 34796 |

各行の合計は `65536` に一致する。

小役の設定差は `BELL` のみに持たせる。`RARE_CHERRY`、`SUIKA`、ボーナス同時成立チェリーは全設定共通とする。`REPLAY` は小役ではなく再遊技カテゴリとして扱い、50枚あたり約40Gのベースを維持するため設定別に調整する。

このテーブルは、通常時3枚掛け、REPLAY同掛け再遊技、BELL 5枚、RARE_CHERRY 2枚、SUIKA 15枚、ボーナス中2枚掛け14枚払出、BIG純増252枚、REG純増96枚として計算する。

目標機械割は以下を基準にする。

| 設定 | 目標機械割 |
| --- | ---: |
| 設定1 | 99.0% |
| 設定2 | 100.0% |
| 設定3 | 101.3% |
| 設定4 | 103.1% |
| 設定5 | 105.0% |
| 設定6 | 108.5% |

上記抽選テーブルは、50枚あたり約40Gのベースを優先する。参考資料の方向性に合わせて、チェリーは非重複 `1/35.6`、スイカは調整用の15枚役として `1/1024`、ベルは `1/5.45` から `1/5.20` 程度に置く。リプレイはベース調整のため高めに置く。

| 設定 | 目標機械割 | 計算機械割 | ベース | BIG確率 | REG確率 | 合算 | BELL確率 | REPLAY確率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 設定1 | 99.0% | 99.0% | 40.0G | 1/255.0 | 1/417.4 | 1/158.3 | 1/5.45 | 1/3.94 |
| 設定2 | 100.0% | 99.9% | 40.0G | 1/251.1 | 1/392.4 | 1/153.1 | 1/5.42 | 1/3.96 |
| 設定3 | 101.3% | 101.3% | 40.0G | 1/246.4 | 1/356.2 | 1/145.6 | 1/5.38 | 1/4.00 |
| 設定4 | 103.1% | 103.1% | 40.0G | 1/240.1 | 1/318.1 | 1/136.8 | 1/5.34 | 1/4.04 |
| 設定5 | 105.0% | 105.0% | 40.0G | 1/234.1 | 1/286.2 | 1/128.8 | 1/5.28 | 1/4.10 |
| 設定6 | 108.5% | 108.5% | 40.0G | 1/218.5 | 1/257.0 | 1/118.1 | 1/5.20 | 1/4.18 |

## 第一段階の押下戦略

第一段階ログシミュレーターでは、以下の押下戦略を実装対象にする。

```json
[
  {
    "id": "fixed",
    "label": "固定押下",
    "description": "各リールの現在位置をそのまま押下位置にする"
  },
  {
    "id": "pseudoRandom",
    "label": "疑似ランダム押下",
    "description": "乱数シードから押下位置を決める"
  },
  {
    "id": "bonusAim",
    "label": "ボーナス狙い",
    "description": "ボーナス成立状態では該当ボーナス図柄を狙う"
  },
  {
    "id": "rareAim",
    "label": "レア小役狙い",
    "description": "レア小役成立時にレア小役図柄を狙う"
  }
]
```

初期実装では `fixed` と `pseudoRandom` を必須、`bonusAim` と `rareAim` は次段階でもよい。

## 第一段階で必須の停止制御ルール

- 通常小役 `BELL` は成立時に最大滑り5コマで引き込む。
- レア小役 `RARE_CHERRY` は押下位置が入賞可能範囲内の場合だけ揃える。
- レア小役取りこぼし時は `rareMiss` を停止結果タグに残す。
- ボーナス成立または持越し中は、ボーナス図柄の引き込みを最優先にする。
- ボーナス図柄を引き込めない場合のみ、成立小役またはリプレイの入賞を許可する。
- ボーナス成立状態では新規ボーナス抽選を行わず、小役とリプレイだけを抽選する。
- ボーナス成立状態で小役もリプレイも成立せず、ボーナス図柄も引き込めない場合は `reachPattern` を停止結果タグに残す。
- 未成立役は有効ラインに揃えない。

## 第一段階で必須のログ項目

- ゲーム番号
- 状態ID
- `bonusType`
- 設定
- シード
- BET
- クレジット
- 抽選テーブルID
- 抽選結果
- 押下位置
- 停止位置
- 滑りコマ数
- 入賞役
- 払出
- 停止結果タグ
- 状態遷移

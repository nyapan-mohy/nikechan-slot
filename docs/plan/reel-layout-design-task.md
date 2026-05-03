# 3リール役配置設計タスク

## 目的

AIニケちゃんスロットの公開用エミュレーター実装に入る前に、3リールの図柄配列を固定する。

このタスクでは、現在制作済みの図柄素材を前提に、停止制御、入賞判定、払出、ボーナス持越しに使える配列データを作る。

## 入力

- 図柄定義: `assets/images/symbols/symbols.json`
- 図柄素材: `assets/images/symbols/`
- ボーナス状態遷移と停止制御方針: `docs/spec/bonus-and-reel-control-spec.md`
- 初期Aタイプ仕様: `docs/spec/initial-a-type-spec.md`

## 使用図柄

| 図柄ID | 表示名 | 役割 |
| --- | --- | --- |
| `BLANK` | 役なし | ハズレ、間隔調整、リーチ目構成用 |
| `BELL` | ベル | 通常小役 |
| `REPLAY` | リプレイ | 再遊技 |
| `CHERRY` | チェリー | レア小役 |
| `SUIKA` | スイカ | レア小役 |
| `AI_NIKECHAN` | AIニケちゃん | BIG図柄 |
| `MASTER_NIKECHAN` | Masterニケちゃん | BIG図柄 |
| `LOGO_BAR` | ニケちゃんロゴBAR | REG図柄 |

第一段階のログシミュレーターでは、添付リール表をPJ図柄へ置換して使う。白7は `AI_NIKECHAN`、DONは `MASTER_NIKECHAN`、HANABI/BARは `LOGO_BAR`、涼は `SUIKA` として扱う。

## 決めること

1. リール基本仕様
   - 1リールあたりのコマ数: 21コマ
   - 表示窓に見えるコマ数: 3コマ
   - 最大滑りコマ数: 5コマ
   - 有効ライン数とライン座標: 5ライン。上段、中段、下段、右下がり、右上がり

2. 図柄配列
   - 左リール配列
   - 中リール配列
   - 右リール配列
   - 各図柄の出現個数
   - 通常小役がどの押下位置からでも引き込める間隔

3. 役別の入賞形
   - `BELL`: `BELL` - `BELL` - `BELL`
   - `REPLAY`: `REPLAY` - `REPLAY` - `REPLAY`
   - `CHERRY`: 左リール `CHERRY` + 中右任意
   - `SUIKA`: `SUIKA` - `SUIKA` - `SUIKA`
   - BIG: `AI_NIKECHAN` または `MASTER_NIKECHAN` の3つ揃い。同一BIGフラグとして混在も許す。
   - REG: `LOGO_BAR` - `LOGO_BAR` - `LOGO_BAR`

4. 停止制御上の制約
   - `BELL` は目押しなしで揃う。
   - `REPLAY` は目押しなしで揃う。
   - `CHERRY` は左リール目押し範囲内のみ入賞する。
   - `SUIKA` は目押し範囲内のみ揃う。
   - BIG/REG はボーナス持越し中に目押しできた場合のみ揃う。
   - 未成立の小役、リプレイ、ボーナス図柄を有効ラインに揃えない。

5. 見た目上の制約
   - BIG図柄は `AI_NIKECHAN` と `MASTER_NIKECHAN` の両方を使う。
   - REG図柄は `LOGO_BAR` を使う。
   - 役なし図柄はロゴの見え方を崩さない。

## 成果物

1. `src/data/reels.json`
   - 左、中、右リールのコマ配列。
   - コマ番号は上から下へ `0` 始まりで固定する。

2. `src/data/roles.json`
   - 役ID、入賞形、払出、目押し要否、フラグ種別。

3. `src/data/lines.json`
   - 表示窓と有効ラインの定義。

4. 検証メモ
   - 図柄間隔チェック。
   - 通常小役の引き込み可否。
   - レア小役の取りこぼし可否。
   - BIG/REGの目押し範囲。
   - ハズレ時に誤入賞しないこと。

## 作業手順

1. 既存仕様からコマ数、最大滑り、有効ラインを確認し、未決定なら仮値を置く。
2. 参考リール画像の密度を参考に、20から21コマ程度の初期配列案を作る。
3. `BELL` と `REPLAY` の間隔を先に固定する。
4. `CHERRY` と `SUIKA` を目押し前提の位置へ配置する。
5. `AI_NIKECHAN`、`MASTER_NIKECHAN`、`LOGO_BAR` をボーナス図柄として配置する。
6. `BLANK` で間隔、ハズレ目、リーチ目候補を調整する。
7. 配列から全停止位置を検査し、誤入賞と引き込み不能を洗い出す。
8. 必要なら配列を調整し、`reels.json`、`roles.json`、`lines.json` に落とす。

## 未決定事項

- チェリーの角判定と払出。
- BIG/REGの最終停止制御で、同一BIGフラグ内の図柄混在をどこまで優先するか。

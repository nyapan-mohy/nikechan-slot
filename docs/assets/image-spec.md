# 画像素材仕様

## 基本方針

- 既存機種の図柄、ランプ、筐体意匠、キャラクター、ロゴは使用しない。
- 元データは高解像度またはベクターで保持し、Canvas 表示用に最適化した PNG を出力する。
- UIアイコンは、既存ライブラリを使用する場合もライセンスを確認する。

## 推奨形式

- 図柄元データ: SVG または 512x512 以上の透過 PNG
- Canvas表示用図柄: 透過 PNG
- リール帯: PNG または図柄パーツからの動的生成
- 液晶背景: 1280x720 以上の PNG
- 筐体/パネル: 2倍解像度以上の PNG
- UIアイコン: SVG または透過 PNG

## 命名規則

```text
assets/images/symbols/symbol-ai-nikechan.png
assets/images/symbols/symbol-master-nikechan.png
assets/images/symbols/symbol-logo-bar.png
assets/images/symbols/symbol-bell.png
assets/images/symbols/symbol-replay.png
assets/images/symbols/symbol-cherry.png
assets/images/symbols/symbol-watermelon.png
assets/images/symbols/symbol-blank.png
assets/images/reel-strips/reel-strip-left.png
assets/images/lamps/lamp-on.png
assets/images/lcd/lcd-bg-normal.png
assets/images/ui/icon-volume.svg
```

## Canvas表示の注意

- 図柄はリール停止時に輪郭がぼやけないサイズで書き出す。
- ランプは点灯、消灯、発光表現を別レイヤーまたは別画像で管理する。
- 初期版の液晶は `BONUS` 表示を中心にし、告知ランプと回胴図柄を邪魔しない明度・情報量にする。
- スマートフォン表示でもボタンと図柄の視認性を維持する。

export const DEFAULT_REEL_KEYS = ["left", "center", "right"];

export const DEFAULT_DATA_BUNDLE = Object.freeze({
  settings: {
    defaultSettingId: "setting1",
    settings: [
      { id: "setting1", label: "Setting 1", lotteryTableId: "normal-setting1", bonusFlaggedTableId: "bonus-flagged-setting1", bigTableId: "big-setting1", regTableId: "reg-setting1" },
      { id: "setting2", label: "Setting 2", lotteryTableId: "normal-setting2", bonusFlaggedTableId: "bonus-flagged-setting2", bigTableId: "big-setting2", regTableId: "reg-setting2" },
      { id: "setting3", label: "Setting 3", lotteryTableId: "normal-setting3", bonusFlaggedTableId: "bonus-flagged-setting3", bigTableId: "big-setting3", regTableId: "reg-setting3" },
      { id: "setting4", label: "Setting 4", lotteryTableId: "normal-setting4", bonusFlaggedTableId: "bonus-flagged-setting4", bigTableId: "big-setting4", regTableId: "reg-setting4" },
      { id: "setting5", label: "Setting 5", lotteryTableId: "normal-setting5", bonusFlaggedTableId: "bonus-flagged-setting5", bigTableId: "big-setting5", regTableId: "reg-setting5" },
      { id: "setting6", label: "Setting 6", lotteryTableId: "normal-setting6", bonusFlaggedTableId: "bonus-flagged-setting6", bigTableId: "big-setting6", regTableId: "reg-setting6" }
    ]
  },
  tables: {
    tables: [
      tableFor("setting1", 211, 112, 12025, 1841, 64, 16640, 46, 45, 34552),
      tableFor("setting2", 213, 118, 12092, 1841, 64, 16529, 48, 49, 34582),
      tableFor("setting3", 218, 133, 12181, 1841, 64, 16380, 48, 51, 34620),
      tableFor("setting4", 225, 149, 12273, 1841, 64, 16227, 48, 57, 34652),
      tableFor("setting5", 229, 172, 12412, 1841, 64, 15995, 51, 57, 34715),
      tableFor("setting6", 248, 191, 12603, 1841, 64, 15677, 52, 64, 34796),
      bonusFlaggedTableFor("setting1", 12025, 1932, 64, 16640),
      bonusFlaggedTableFor("setting2", 12092, 1938, 64, 16529),
      bonusFlaggedTableFor("setting3", 12181, 1940, 64, 16380),
      bonusFlaggedTableFor("setting4", 12273, 1946, 64, 16227),
      bonusFlaggedTableFor("setting5", 12412, 1949, 64, 15995),
      bonusFlaggedTableFor("setting6", 12603, 1957, 64, 15677),
      bonusTableFor("big", "setting1"),
      bonusTableFor("big", "setting2"),
      bonusTableFor("big", "setting3"),
      bonusTableFor("big", "setting4"),
      bonusTableFor("big", "setting5"),
      bonusTableFor("big", "setting6"),
      bonusTableFor("reg", "setting1"),
      bonusTableFor("reg", "setting2"),
      bonusTableFor("reg", "setting3"),
      bonusTableFor("reg", "setting4"),
      bonusTableFor("reg", "setting5"),
      bonusTableFor("reg", "setting6")
    ]
  },
  roles: {
    roles: [
      { id: "REPLAY", type: "replay", winningPattern: ["REPLAY", "REPLAY", "REPLAY"], payout: 0, replay: true },
      { id: "BELL", type: "smallRole", rarity: "normal", requiresAim: false, winningPattern: ["BELL", "BELL", "BELL"], payout: 5 },
      { id: "RARE_CHERRY", type: "smallRole", rarity: "rare", requiresAim: true, winningPattern: ["CHERRY", "ANY", "ANY"], payout: 2, missResultTags: ["rareMiss", "chancePattern"] },
      { id: "SUIKA", type: "smallRole", rarity: "rare", requiresAim: true, winningPattern: ["SUIKA", "SUIKA", "SUIKA"], payout: 15, missResultTags: ["suikaMiss", "chancePattern"] },
      { id: "BIG", type: "bonus", bonusType: "BIG", winningPattern: [["AI_NIKECHAN", "MASTER_NIKECHAN"], ["AI_NIKECHAN", "MASTER_NIKECHAN"], ["AI_NIKECHAN", "MASTER_NIKECHAN"]], payout: 0 },
      { id: "REG", type: "bonus", bonusType: "REG", winningPattern: ["LOGO_BAR", "LOGO_BAR", "LOGO_BAR"], payout: 0 }
    ]
  },
  reels: {
    reelKeys: DEFAULT_REEL_KEYS,
    reels: {
      left: ["CHERRY", "MASTER_NIKECHAN", "BELL", "SUIKA", "REPLAY", "SUIKA", "AI_NIKECHAN", "REPLAY", "SUIKA", "BELL", "LOGO_BAR", "CHERRY", "LOGO_BAR", "BELL", "REPLAY", "SUIKA", "MASTER_NIKECHAN", "MASTER_NIKECHAN", "MASTER_NIKECHAN", "REPLAY", "BELL"],
      center: ["BELL", "CHERRY", "SUIKA", "AI_NIKECHAN", "REPLAY", "BELL", "LOGO_BAR", "CHERRY", "REPLAY", "BELL", "CHERRY", "BELL", "REPLAY", "CHERRY", "SUIKA", "CHERRY", "BELL", "REPLAY", "MASTER_NIKECHAN", "CHERRY", "REPLAY"],
      right: ["REPLAY", "CHERRY", "AI_NIKECHAN", "BELL", "SUIKA", "REPLAY", "CHERRY", "BELL", "CHERRY", "REPLAY", "LOGO_BAR", "BELL", "CHERRY", "REPLAY", "CHERRY", "BELL", "SUIKA", "REPLAY", "MASTER_NIKECHAN", "BELL", "SUIKA"]
    }
  },
  lines: {
    activeLineIds: ["top", "center", "bottom", "downDiagonal", "upDiagonal"],
    lines: [
      { id: "top", label: "Top", positions: [0, 0, 0], enabled: true },
      { id: "center", label: "Center", positions: [1, 1, 1], enabled: true },
      { id: "bottom", label: "Bottom", positions: [2, 2, 2], enabled: true },
      { id: "downDiagonal", label: "Down Diagonal", positions: [0, 1, 2], enabled: true },
      { id: "upDiagonal", label: "Up Diagonal", positions: [2, 1, 0], enabled: true }
    ]
  },
  stopControl: {
    maxSlip: 5,
    reelKeys: DEFAULT_REEL_KEYS
  },
  bonusSpec: {
    BIG: { bonusType: "BIG", entryRoleId: "BIG", bet: 2, payoutPerGame: 14, gameCount: 21, endByGrossPayout: 294, endByNetPayout: 252, endingState: "bonusEnding" },
    REG: { bonusType: "REG", entryRoleId: "REG", bet: 2, payoutPerGame: 14, gameCount: 8, endByGrossPayout: 112, endByNetPayout: 96, endingState: "bonusEnding" }
  }
});

function tableFor(settingId, big, reg, bell, rareCherry, suika, replay, bigRareCherry, regRareCherry, none) {
  return {
    id: `normal-${settingId}`,
    settingId,
    denominator: 65536,
    entries: [
      { result: { bonus: "BIG", smallRole: null }, weight: big },
      { result: { bonus: "REG", smallRole: null }, weight: reg },
      { result: { bonus: null, smallRole: "BELL" }, weight: bell },
      { result: { bonus: null, smallRole: "RARE_CHERRY" }, weight: rareCherry },
      { result: { bonus: null, smallRole: "SUIKA" }, weight: suika },
      { result: { bonus: null, smallRole: null, isReplay: true }, weight: replay },
      { result: { bonus: "BIG", smallRole: "RARE_CHERRY" }, weight: bigRareCherry },
      { result: { bonus: "REG", smallRole: "RARE_CHERRY" }, weight: regRareCherry },
      { result: { bonus: null, smallRole: null }, weight: none }
    ]
  };
}

function bonusFlaggedTableFor(settingId, bell, rareCherry, suika, replay) {
  const denominator = 65536;
  const none = Math.max(0, denominator - bell - rareCherry - suika - replay);
  return {
    id: `bonus-flagged-${settingId}`,
    settingId,
    denominator,
    entries: [
      { result: { bonus: null, smallRole: "BELL" }, weight: bell },
      { result: { bonus: null, smallRole: "RARE_CHERRY" }, weight: rareCherry },
      { result: { bonus: null, smallRole: "SUIKA" }, weight: suika },
      { result: { bonus: null, smallRole: null, isReplay: true }, weight: replay },
      { result: { bonus: null, smallRole: null }, weight: none }
    ]
  };
}

function bonusTableFor(kind, settingId) {
  return {
    id: `${kind}-${settingId}`,
    settingId,
    denominator: 1,
    entries: [{ result: { bonus: null, smallRole: "BELL", bonusGame: true }, weight: 1 }]
  };
}

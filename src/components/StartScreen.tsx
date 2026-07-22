"use client";

import {
  useState,
  useEffect,
  useMemo,
  type CSSProperties,
  type FC,
  type ReactNode,
} from "react";
import { useGameStore } from "./GameStore";
import { getSfxEngine } from "@/game/audio";
import {
  CHARACTERS,
  saveSelectedCharacter,
  loadSelectedCharacter,
} from "@/game/data/characters";
import CharacterSprite from "./CharacterSprite";
import AchievementsModal from "./AchievementsModal";
import ACHIEVEMENTS, { loadUnlockedAchievements } from "@/lib/achievements";
import {
  AVATAR_PRESETS,
  clearLeaderboard,
  getAvatarPreset,
  loadLeaderboard,
  loadLeaderboardAvatarId,
  loadLeaderboardName,
  saveLeaderboardAvatarId,
  sanitizeLeaderboardName,
  saveLeaderboardName,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
import {
  SHOP_UPGRADES,
  clearPendingContinueSlot,
  getTodayIsoDay,
  hasPlayedDailyChallenge,
  loadActiveSaveSlotId,
  loadSaveSlots,
  purchaseCharacter,
  purchaseUpgrade,
  renameSaveSlot,
  resetSaveSlot,
  setActiveSaveSlotId,
  setPendingContinueSlot,
  type SaveSlot,
  type SaveSlotId,
} from "@/lib/progression";
import {
  clearRunHistory,
  loadRunHistory,
  summarizeRunHistory,
  type RunRecord,
} from "@/lib/run-history";
import { schedulePanelReveal } from "@/lib/menu-panel-reveal";
import TouchControlSettings from "./TouchControlSettings";
import {
  fetchOnlineLeaderboard,
  fetchOnlineReplay,
  type OnlineBoardScope,
  type OnlineEntry,
} from "@/lib/online-leaderboard";

interface Props {
  onPlay: (seed?: number) => void;
  onPlayDailyChallenge?: () => void;
  onLevelSelect?: () => void;
  onPlayMultiplayer?: (params: {
    mode: "host" | "join";
    roomId?: string;
    playerName: string;
    seed?: number;
  }) => void;
  onPlaySplitScreen?: (seed?: number) => void;
  onPlayOnlineGhostRace?: (payload: {
    entry: OnlineEntry;
    replayPath: Array<{ distance: number; x: number; y: number }>;
  }) => void;
  initialRoomCode?: string;
}



type MenuView = "character" | "profile";

const StartScreen: FC<Props> = ({
  onPlay,
  onPlayDailyChallenge,
  onLevelSelect,
  onPlayMultiplayer,
  onPlaySplitScreen,
  onPlayOnlineGhostRace,
  initialRoomCode,
}) => {
  const { stats } = useGameStore();
  const [seedInput, setSeedInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [activeView, setActiveView] = useState<MenuView>("character");
  const [playerName, setPlayerName] = useState("Player");
  const [avatarId, setAvatarId] = useState(AVATAR_PRESETS[0].id);
  const [roomCode, setRoomCode] = useState("");
  const [mpError, setMpError] = useState("");
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [runHistory, setRunHistory] = useState<RunRecord[]>([]);
  const [showProgression, setShowProgression] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [onlineScope, setOnlineScope] = useState<OnlineBoardScope>("global");
  const [onlineEntries, setOnlineEntries] = useState<OnlineEntry[]>([]);
  const [onlineBoardLabel, setOnlineBoardLabel] = useState("");
  const [onlineSeasonLabel, setOnlineSeasonLabel] = useState("");
  const [loadingReplayId, setLoadingReplayId] = useState("");
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [activeSlotId, setActiveSlot] = useState<SaveSlotId>("slot1");
  const [progressionMessage, setProgressionMessage] = useState("");
  const [achieveCount, setAchieveCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [selectedChar, setSelectedChar] = useState("knight");

  useEffect(() => {
    setAchieveCount(loadUnlockedAchievements().length);
  }, []);

  useEffect(() => {
    setSelectedChar(loadSelectedCharacter());
  }, []);

  useEffect(() => {
    const storedName = loadLeaderboardName();
    setPlayerName(storedName);
    setAvatarId(loadLeaderboardAvatarId());
    setLeaderboard(loadLeaderboard());
    setRunHistory(loadRunHistory());
    setSaveSlots(loadSaveSlots());
    setActiveSlot(loadActiveSaveSlotId());
  }, []);

  useEffect(() => {
    if (!progressionMessage) return;
    const timer = window.setTimeout(() => setProgressionMessage(""), 2300);
    return () => window.clearTimeout(timer);
  }, [progressionMessage]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const incomingCode = (initialRoomCode ?? "").trim().toUpperCase();
    if (!incomingCode) return;
    setShowMultiplayer(true);
    setActiveView("profile");
    setRoomCode(incomingCode);
  }, [initialRoomCode]);

  useEffect(() => {
    if (!showLeaderboard) return;
    let closed = false;
    void fetchOnlineLeaderboard(onlineScope, 12)
      .then((result) => {
        if (closed) return;
        setOnlineEntries(result.entries);
        setOnlineBoardLabel(result.key);
        setOnlineSeasonLabel(result.season.label);
      })
      .catch(() => {
        if (closed) return;
        setOnlineEntries([]);
        setOnlineBoardLabel("");
        setOnlineSeasonLabel("");
      });
    return () => {
      closed = true;
    };
  }, [onlineScope, showLeaderboard]);

  const handlePlay = () => {
    setActiveSaveSlotId(activeSlotId);
    clearPendingContinueSlot();
    const safeName = sanitizeLeaderboardName(playerName);
    setPlayerName(safeName);
    saveLeaderboardName(safeName);
    saveLeaderboardAvatarId(avatarId);
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    onPlay(seed);
  };

  const handleHostMultiplayer = () => {
    if (!onPlayMultiplayer) return;
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    const safeName = sanitizeLeaderboardName(playerName);
    if (!safeName) {
      setMpError("Enter a player name");
      return;
    }
    saveLeaderboardName(safeName);
    saveLeaderboardAvatarId(avatarId);
    setMpError("");
    onPlayMultiplayer({ mode: "host", playerName: safeName, seed });
  };

  const handleJoinMultiplayer = () => {
    if (!onPlayMultiplayer) return;
    const safeName = sanitizeLeaderboardName(playerName);
    const code = roomCode.trim().toUpperCase();
    if (!safeName) {
      setMpError("Enter a player name");
      return;
    }
    if (code.length < 4) {
      setMpError("Enter a valid room code");
      return;
    }
    saveLeaderboardName(safeName);
    saveLeaderboardAvatarId(avatarId);
    setMpError("");
    onPlayMultiplayer({ mode: "join", roomId: code, playerName: safeName });
  };

  const handlePlayOnlineGhost = async (entryId: string) => {
    if (!onPlayOnlineGhostRace) return;
    setLoadingReplayId(entryId);
    try {
      const replay = await fetchOnlineReplay(entryId);
      onPlayOnlineGhostRace({
        entry: replay.entry,
        replayPath: replay.replayPath,
      });
    } catch {
      setProgressionMessage("Replay unavailable right now");
    } finally {
      setLoadingReplayId("");
    }
  };

  const handleSplitScreen = () => {
    if (!onPlaySplitScreen) return;
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    onPlaySplitScreen(seed);
  };

  const handleDailyChallengeClick = () => {
    if (!onPlayDailyChallenge) return;
    const safeName = sanitizeLeaderboardName(playerName);
    setPlayerName(safeName);
    saveLeaderboardName(safeName);
    saveLeaderboardAvatarId(avatarId);
    onPlayDailyChallenge();
  };

  const handleLeaderboardToggle = () => {
    if (!showLeaderboard) {
      setLeaderboard(loadLeaderboard());
      setOnlineScope("global");
    }
    setShowLeaderboard((v) => !v);
  };

  const handleSelectSaveSlot = (slotId: SaveSlotId) => {
    setActiveSlot(slotId);
    setActiveSaveSlotId(slotId);
  };

  const handleContinueFromSlot = (slotId: SaveSlotId) => {
    const slot = saveSlots.find((s) => s.id === slotId);
    if (!slot?.checkpoint) {
      setProgressionMessage("No saved checkpoint in that slot");
      return;
    }
    setActiveSaveSlotId(slotId);
    setPendingContinueSlot(slotId);
    onPlay(slot.checkpoint.seed);
  };

  const handleRenameSlot = (slotId: SaveSlotId) => {
    const slot = saveSlots.find((s) => s.id === slotId);
    if (!slot) return;
    const next = window.prompt("Rename save slot", slot.name)?.trim();
    if (!next) return;
    const updated = renameSaveSlot(slotId, next);
    setSaveSlots(updated);
  };

  const handleResetSlot = (slotId: SaveSlotId) => {
    const confirmed = window.confirm(
      "Reset this save slot? This clears coins, upgrades, and checkpoint.",
    );
    if (!confirmed) return;
    const updated = resetSaveSlot(slotId);
    setSaveSlots(updated);
  };

  const handleBuyCharacter = (characterId: string) => {
    const result = purchaseCharacter(activeSlotId, characterId);
    setSaveSlots(result.slots);
    if (result.ok) {
      setSelectedChar(characterId);
      saveSelectedCharacter(characterId);
    }
    setProgressionMessage(result.ok ? "Character unlocked" : (result.reason ?? "Unlock failed"));
  };

  const handleBuyUpgrade = (upgradeId: string) => {
    const result = purchaseUpgrade(activeSlotId, upgradeId);
    setSaveSlots(result.slots);
    setProgressionMessage(
      result.ok ? "Upgrade purchased" : (result.reason ?? "Purchase failed"),
    );
  };

  const activeSlot = useMemo(
    () => saveSlots.find((s) => s.id === activeSlotId) ?? null,
    [activeSlotId, saveSlots],
  );
  const dailyUsed = useMemo(
    () => hasPlayedDailyChallenge(activeSlotId, getTodayIsoDay()),
    [activeSlotId],
  );
  const runSummary = useMemo(() => summarizeRunHistory(runHistory), [runHistory]);

  useEffect(() => {
    if (!activeSlot) return;
    const selected = CHARACTERS.find((c) => c.id === selectedChar);
    if (!selected) return;
    const unlocked = activeSlot.unlockedCharacterIds.includes(selected.id) || selected.unlockCost <= 0;
    if (unlocked) return;
    const fallback = CHARACTERS.find((c) => activeSlot.unlockedCharacterIds.includes(c.id)) ?? CHARACTERS[0];
    setSelectedChar(fallback.id);
    saveSelectedCharacter(fallback.id);
  }, [activeSlot, selectedChar]);

  const selectedCharacter =
    CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[0];
  const highScoreLabel =
    stats.highScore > 0 ? stats.highScore.toLocaleString() : "New run";

  return (
    <div
      className="absolute inset-0 dash-menu-shell"
      style={{
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.28s ease",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        padding:
          "max(16px, env(safe-area-inset-top, 0px)) 0 max(30px, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <StarField />
      <div className="dash-grid-glow dash-grid-glow-a" />
      <div className="dash-grid-glow dash-grid-glow-b" />

      <main className="dash-menu-stage dash-menu-stage-v2">
        <section className="dash-command-panel dash-hero-v2">
          <div className="dash-topbar-v2">
            <div className="dash-brand-v2">
              <AppIcon characterId={selectedChar} />
              <div>
                <p className="dash-eyebrow">Dashverse</p>
                <h1>Pick a mode</h1>
              </div>
            </div>
            <div className="dash-live-pill">
              <span /> Ready
            </div>
          </div>

          <p className="dash-hero-lede">
            Endless runner with co-op, daily challenges, and online ghost races.
          </p>

          <div className="dash-quick-stats-v2">
            <span>
              <small>Best</small>
              <b>{highScoreLabel}</b>
            </span>
            <span>
              <small>Save</small>
              <b>{activeSlot?.name ?? "Slot 1"}</b>
            </span>
            <span>
              <small>Bank</small>
              <b>{activeSlot?.bankCoins ?? 0}c</b>
            </span>
            <span>
              <small>Runner</small>
              <b>{selectedCharacter.name}</b>
            </span>
          </div>

          <div className="dash-primary-row-v2">
            <button className="dash-play-button-v2" onClick={handlePlay}>
              <span>Play Endless</span>
              <small>Jump straight into a run</small>
            </button>
            <button
              className={`dash-icon-action-v2 ${activeView === "character" ? "is-active" : ""}`}
              onClick={() => setActiveView("character")}
              aria-label="Open character select"
              aria-pressed={activeView === "character"}
            >
              <CharacterSprite characterId={selectedChar} size={38} decorative />
            </button>
            <button
              className={`dash-icon-action-v2 ${activeView === "profile" ? "is-active" : ""}`}
              onClick={() => setActiveView("profile")}
              aria-label="Open player profile"
              aria-pressed={activeView === "profile"}
            >
              <span aria-hidden="true">●</span>
            </button>
          </div>
        </section>

        <section className="dash-command-panel dash-modes-v2 dash-view-panel-v3">
          <div className="dash-section-title-row-v2">
            <div>
              <p className="dash-eyebrow">Modes</p>
              <h2>Choose your run</h2>
            </div>
          </div>
          <div className="dash-flow-tabs-v2" aria-label="Menu flow">
            <span className="is-active">Play</span>
            <span>Compete</span>
            <span>Customize</span>
          </div>
          <p className="dash-tester-checklist-v2">
            Recommended play plan: run Adventure first, try Daily next, then use Same-Wi-Fi for nearby co-op.
          </p>
          <div className="dash-mode-grid-v2">
            {onLevelSelect && (
              <button
                className="dash-mode-card-v2 solo"
                onClick={onLevelSelect}
              >
                <small>Solo</small>
                <b>Adventure</b>
                <span>Levels + time attacks</span>
                <em>→</em>
              </button>
            )}
            <button
              className="dash-mode-card-v2 coop"
              onClick={() => setShowMultiplayer((v) => !v)}
            >
              <small>Co-op</small>
              <b>{showMultiplayer ? "Hide Wi-Fi" : "Same-Wi-Fi"}</b>
              <span>Host or join nearby</span>
              <em>↔</em>
            </button>
            <button
              className="dash-mode-card-v2 coop"
              onClick={handleSplitScreen}
            >
              <small>Co-op</small>
              <b>Split Screen</b>
              <span>Two players locally</span>
              <em>▦</em>
            </button>
            {onPlayDailyChallenge && (
              <button
                className="dash-mode-card-v2 compete"
                onClick={handleDailyChallengeClick}
                disabled={dailyUsed}
              >
                <small>Compete</small>
                <b>{dailyUsed ? "Daily Done" : "Daily"}</b>
                <span>
                  {dailyUsed ? "Resets tomorrow" : "One ranked shot"}
                </span>
                <em>★</em>
              </button>
            )}
            <button
              className="dash-mode-card-v2 compete"
              onClick={handleLeaderboardToggle}
            >
              <small>Compete</small>
              <b>{showLeaderboard ? "Hide Board" : "Leaderboard"}</b>
              <span>Records + ghost races</span>
              <em>≡</em>
            </button>
            <button
              className="dash-mode-card-v2 customize"
              aria-expanded={showRunHistory}
              aria-controls="run-lab-panel"
              onClick={() => {
                if (!showRunHistory) {
                  setRunHistory(loadRunHistory());
                  schedulePanelReveal("run-lab-panel");
                }
                setShowRunHistory((value) => !value);
              }}
            >
              <small>Review</small>
              <b>{showRunHistory ? "Hide Run Lab" : "Run Lab"}</b>
              <span>Trends + recent debriefs</span>
              <em>↗</em>
            </button>
            <button
              className="dash-mode-card-v2 customize"
              onClick={() => setShowProgression((v) => !v)}
            >
              <small>Customize</small>
              <b>{showProgression ? "Hide Shop" : "Saves + Shop"}</b>
              <span>Coins, checkpoints, perks</span>
              <em>◇</em>
            </button>
            <button
              className="dash-mode-card-v2 customize"
              aria-expanded={showSettings}
              aria-controls="settings-panel"
              onClick={() => {
                if (!showSettings) schedulePanelReveal("settings-panel");
                setShowSettings((s) => !s);
              }}
            >
              <small>Setup</small>
              <b>{showSettings ? "Hide Settings" : "Settings"}</b>
              <span>Controls, audio, and display</span>
              <em>⚙</em>
            </button>
          </div>
        </section>

        {activeView === "character" && (
          <section className="dash-command-panel dash-runner-v2 dash-character-select-v3 dash-view-panel-v3">
            <div className="dash-section-title-row-v2">
              <div>
                <p className="dash-eyebrow">Runner</p>
                <h2>{selectedCharacter.name}</h2>
              </div>
              <span className="dash-subtle-pill-v2">
                Bank: {activeSlot?.bankCoins ?? 0}c
              </span>
            </div>
            <p className="dash-panel-subtitle">{selectedCharacter.description} · {selectedCharacter.ability}</p>
            <div className="dash-runner-body-v2 dash-character-hero-v3">
              <div
                className="dash-character-avatar-v2 dash-sprite-frame-v2 dash-character-stage-v3"
                style={
                  {
                    "--hero-color": selectedCharacter.bodyColor,
                    background: `linear-gradient(145deg, ${selectedCharacter.bodyColor}33, ${selectedCharacter.bodyColor}11)`,
                    borderColor: selectedCharacter.outlineColor,
                    boxShadow: `0 18px 50px ${selectedCharacter.bodyColor}28, inset 0 1px 0 rgba(255,255,255,0.18)`,
                  } as CSSProperties
                }
              >
                <CharacterSprite
                  characterId={selectedChar}
                  size={124}
                  decorative
                />
              </div>
              <div className="dash-stat-stack-v2">
                <StatBar
                  label="SPD"
                  value={selectedCharacter.speed}
                  color="#7170ff"
                />
                <StatBar
                  label="JMP"
                  value={selectedCharacter.jumpVelocity}
                  color="#10b981"
                />
                <StatBar
                  label="HP"
                  value={selectedCharacter.maxHealth / 5}
                  color="#f87171"
                />
              </div>
            </div>
            <div className="dash-character-grid-v2 dash-character-roster-v3">
              {CHARACTERS.map((c) => {
                const unlocked = activeSlot?.unlockedCharacterIds.includes(c.id) ?? c.unlockCost <= 0;
                const canAfford = (activeSlot?.bankCoins ?? 0) >= c.unlockCost;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`dash-character-chip-v2 dash-character-card-v3 ${selectedChar === c.id ? "is-active" : ""}`}
                    onClick={() => {
                      if (!unlocked) {
                        handleBuyCharacter(c.id);
                        return;
                      }
                      setSelectedChar(c.id);
                      saveSelectedCharacter(c.id);
                    }}
                    style={{ "--chip-color": c.bodyColor } as CSSProperties}
                    title={unlocked ? c.ability : `Unlock for ${c.unlockCost} coins`}
                  >
                    <span className="dash-chip-sprite-v2">
                      <CharacterSprite characterId={c.id} size={28} decorative />
                    </span>
                    <span>{c.name}</span>
                    {!unlocked && <small>{canAfford ? `${c.unlockCost}c` : `🔒 ${c.unlockCost}c`}</small>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {activeView === "profile" && (
          <section className="dash-command-panel dash-profile-v2 dash-view-panel-v3">
            <div className="dash-section-title-row-v2 compact">
              <div>
                <p className="dash-eyebrow">Profile</p>
                <h2>Player setup</h2>
              </div>
              <button
                className="dash-text-button-v2"
                onClick={() => setShowAchievements(true)}
              >
                Achievements {achieveCount}/{ACHIEVEMENTS.length}
              </button>
            </div>
            <div className="dash-input-grid-v2">
              <label>
                <span>Name</span>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
                  onBlur={() => {
                    const safe = sanitizeLeaderboardName(playerName);
                    setPlayerName(safe);
                    saveLeaderboardName(safe);
                  }}
                  placeholder="Profile name"
                  className="ios-text-field dash-field-v2"
                  maxLength={20}
                />
              </label>
              <label>
                <span>Seed</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={seedInput}
                  onChange={(e) =>
                    setSeedInput(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="Random"
                  className="ios-text-field dash-field-v2"
                  onKeyDown={(e) => e.key === "Enter" && handlePlay()}
                />
              </label>
            </div>
            <div className="dash-avatar-row-v2">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`dash-avatar-button-v2 ${avatarId === preset.id ? "is-active" : ""}`}
                  onClick={() => {
                    setAvatarId(preset.id);
                    saveLeaderboardAvatarId(preset.id);
                  }}
                  title={preset.label}
                >
                  {preset.icon}
                </button>
              ))}
            </div>
          </section>
        )}

        {showMultiplayer && (
          <MenuPanel
            title="Same-Wi‑Fi room"
            subtitle="Host creates the room. Guest enters the code. Both devices should use the exact same site URL."
          >
            <div className="dash-input-grid-v2 single-panel">
              <label>
                <span>Your name</span>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
                  onBlur={() => {
                    const safe = sanitizeLeaderboardName(playerName);
                    setPlayerName(safe);
                    saveLeaderboardName(safe);
                    saveLeaderboardAvatarId(avatarId);
                  }}
                  placeholder="Your name"
                  className="ios-text-field dash-field-v2"
                  maxLength={20}
                />
              </label>
              <label>
                <span>Room code</span>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 8),
                    )
                  }
                  placeholder="Join only"
                  className="ios-text-field dash-field-v2"
                  maxLength={8}
                />
              </label>
            </div>
            <div className="dash-two-col">
              <button
                className="dash-panel-primary-v2"
                onClick={handleHostMultiplayer}
              >
                Host Room
              </button>
              <button
                className="dash-panel-secondary-v2"
                onClick={handleJoinMultiplayer}
              >
                Join Room
              </button>
            </div>
            {mpError && <p className="dash-error-text">{mpError}</p>}
          </MenuPanel>
        )}

        {showSettings && (
          <div id="settings-panel" className="dash-panel-wrap">
            <SettingsPanel />
          </div>
        )}

        {showRunHistory && (
          <MenuPanel
            id="run-lab-panel"
            title="Run lab"
            subtitle="A private, on-device debrief of your latest 20 meaningful runs."
          >
            {runHistory.length === 0 ? (
              <p className="dash-empty-text">Finish a run to unlock trend analysis.</p>
            ) : (
              <>
                <div className="dash-quick-stats-v2" aria-label="Run history summary">
                  <span><small>Runs</small><b>{runSummary.runs}</b></span>
                  <span><small>Average</small><b>{runSummary.averageScore.toLocaleString()}</b></span>
                  <span><small>Best</small><b>{runSummary.bestScore.toLocaleString()}</b></span>
                  <span>
                    <small>Recent trend</small>
                    <b>{runSummary.scoreTrend > 0 ? "+" : ""}{runSummary.scoreTrend.toLocaleString()}</b>
                  </span>
                </div>
                <div className="dash-panel-heading-row with-margin">
                  <span>Recent debriefs</span>
                  <button
                    aria-label="Clear all run history"
                    onClick={() => {
                      clearRunHistory();
                      setRunHistory([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <p className="dash-run-insight" role="status">
                  {runSummary.scoreTrend > 0
                    ? `Trending up by ${runSummary.scoreTrend.toLocaleString()} points across your latest runs.`
                    : runSummary.scoreTrend < 0
                      ? `Trending down by ${Math.abs(runSummary.scoreTrend).toLocaleString()} points. Focus on survival and clean combos.`
                      : runSummary.runs < 4
                        ? "Complete a few more runs to reveal a useful trend."
                        : "Your recent scores are holding steady."}
                  {` Average distance: ${runSummary.averageDistance.toLocaleString()}m.`}
                </p>
                <div className="dash-list-scroll">
                  {runHistory.map((run, index) => (
                    <ScoreRow
                      key={run.id}
                      rank={index + 1}
                      title={run.characterId.charAt(0).toUpperCase() + run.characterId.slice(1)}
                      meta={`${new Date(run.playedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} • ${run.distance}m • ${run.coins} coins • x${run.maxCombo} combo • ${run.enemiesDefeated} kills`}
                      score={run.score}
                    />
                  ))}
                </div>
              </>
            )}
          </MenuPanel>
        )}

        {showLeaderboard && (
          <MenuPanel
            title="Top runs"
            subtitle="Race your local records or load an online ghost replay."
          >
            <div className="dash-panel-heading-row">
              <span>Local records</span>
              <button
                onClick={() => {
                  clearLeaderboard();
                  setLeaderboard([]);
                }}
              >
                Clear
              </button>
            </div>
            {leaderboard.length === 0 ? (
              <p className="dash-empty-text">
                No runs yet. Finish a game to add your first score.
              </p>
            ) : (
              <div className="dash-list-scroll">
                {leaderboard.slice(0, 20).map((entry, idx) => (
                  <ScoreRow
                    key={entry.id}
                    rank={idx + 1}
                    title={`${getAvatarPreset(entry.avatarId).icon} ${entry.name}`}
                    meta={`${entry.distance}m • ${entry.coins} coins${entry.maxCombo ? ` • x${entry.maxCombo} combo` : ''}${entry.enemiesDefeated ? ` • ${entry.enemiesDefeated} kills` : ''}`}
                    score={entry.score}
                  />
                ))}
              </div>
            )}
            <div className="dash-panel-heading-row with-margin">
              <span>Online board</span>
              <small>
                {onlineSeasonLabel || "Season"} •{" "}
                {onlineBoardLabel || onlineScope}
              </small>
            </div>
            <div className="dash-tab-grid">
              {(["global", "weekly", "daily"] as OnlineBoardScope[]).map(
                (scope) => (
                  <button
                    key={scope}
                    className={onlineScope === scope ? "is-active" : ""}
                    onClick={() => setOnlineScope(scope)}
                  >
                    {scope}
                  </button>
                ),
              )}
            </div>
            {onlineEntries.length === 0 ? (
              <p className="dash-empty-text">
                No online entries yet for this board.
              </p>
            ) : (
              <div className="dash-list-scroll">
                {onlineEntries.map((entry, idx) => (
                  <ScoreRow
                    key={entry.id}
                    rank={idx + 1}
                    title={`${getAvatarPreset(entry.avatarId).icon} ${entry.name}`}
                    meta={`${entry.distance}m • ${entry.coins} coins • ${entry.badge}`}
                    score={entry.score}
                    action={
                      entry.hasReplay && onPlayOnlineGhostRace ? (
                        <button
                          onClick={() => {
                            void handlePlayOnlineGhost(entry.id);
                          }}
                          disabled={loadingReplayId === entry.id}
                        >
                          {loadingReplayId === entry.id ? "Loading..." : "Race"}
                        </button>
                      ) : null
                    }
                  />
                ))}
              </div>
            )}
          </MenuPanel>
        )}

        {showProgression && (
          <MenuPanel
            title="Saves + shop"
            subtitle={`Active bank: ${activeSlot?.bankCoins ?? 0} coins`}
          >
            <div className="dash-save-grid">
              {saveSlots.map((slot) => (
                <button
                  key={slot.id}
                  className={slot.id === activeSlotId ? "is-active" : ""}
                  onClick={() => handleSelectSaveSlot(slot.id)}
                >
                  <b>{slot.name}</b>
                  <span>{slot.bankCoins}c</span>
                  <small>
                    {slot.checkpoint ? "Checkpoint ready" : "No save"}
                  </small>
                  {slot.totalRuns > 0 && (
                    <small className="dash-slot-bests" aria-label={`Best score ${slot.bestScore}, best combo x${slot.bestCombo}, ${slot.bestKills} kills`}>
                      ★{slot.bestScore.toLocaleString()} · 🔗x{slot.bestCombo} · ⚔{slot.bestKills}
                    </small>
                  )}
                </button>
              ))}
            </div>
            <div className="dash-three-col">
              <button onClick={() => handleContinueFromSlot(activeSlotId)}>
                Continue
              </button>
              <button onClick={() => handleRenameSlot(activeSlotId)}>
                Rename
              </button>
              <button onClick={() => handleResetSlot(activeSlotId)}>
                Reset
              </button>
            </div>
            <div className="dash-panel-heading-row with-margin">
              <span>Shop upgrades</span>
              <small>11 permanent perks</small>
            </div>
            <div className="dash-list-scroll shop">
              {SHOP_UPGRADES.map((upgrade) => {
                const owned = !!activeSlot?.unlockedUpgradeIds.includes(
                  upgrade.id,
                );
                const canAfford = (activeSlot?.bankCoins ?? 0) >= upgrade.cost;
                return (
                  <div key={upgrade.id} className="dash-shop-row">
                    <div>
                      <b>{upgrade.name}</b>
                      <span>
                        {upgrade.description} • {upgrade.cost}c
                      </span>
                    </div>
                    <button
                      disabled={owned || !canAfford}
                      onClick={() => handleBuyUpgrade(upgrade.id)}
                    >
                      {owned ? "Owned" : canAfford ? "Buy" : "Locked"}
                    </button>
                  </div>
                );
              })}
            </div>
            {progressionMessage && (
              <p className="dash-success-text">{progressionMessage}</p>
            )}
          </MenuPanel>
        )}
      </main>

      {showAchievements && (
        <AchievementsModal
          onClose={() => {
            setShowAchievements(false);
            setAchieveCount(loadUnlockedAchievements().length);
          }}
        />
      )}
    </div>
  );
};

export default StartScreen;

const MenuPanel: FC<{
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}> = ({ id, title, subtitle, children }) => (
  <section
    id={id}
    className="dash-card dash-expand-panel"
    style={{ animation: "iosSlideDown 0.24s ease both" }}
  >
    <div className="dash-section-title-row compact">
      <div>
        <p className="dash-eyebrow">Panel</p>
        <h2>{title}</h2>
      </div>
    </div>
    {subtitle && <p className="dash-panel-subtitle">{subtitle}</p>}
    <div className="dash-panel-content">{children}</div>
  </section>
);

const ScoreRow: FC<{
  rank: number;
  title: string;
  meta: string;
  score: number;
  action?: ReactNode;
}> = ({ rank, title, meta, score, action }) => (
  <div className="dash-score-row">
    <span className="dash-rank">#{rank}</span>
    <div>
      <b>{title}</b>
      <small>{meta}</small>
    </div>
    <div className="dash-score-cell">
      <strong>{score.toLocaleString()}</strong>
      {action}
    </div>
  </div>
);

/* ── Star field background ────────────────────────────────────── */

const StarField: FC = () => {
  // Golden-ratio distribution for even spacing, no JS randomness needed
  const stars = useMemo(
    () =>
      Array.from({ length: 38 }, (_, i) => ({
        x: ((i * 137.508) % 100).toFixed(3),
        y: ((i * 61.803) % 100).toFixed(3),
        size: 0.9 + (i % 4) * 0.55,
        delay: ((i * 0.618) % 3.5).toFixed(2),
        duration: (1.6 + (i % 5) * 0.7).toFixed(2),
      })),
    [],
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {stars.map((star, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: "50%",
            background: "white",
            opacity: 0,
            animation: `starTwinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
};

/* ── App icon with ambient glow ring ─────────────────────────── */

const AppIcon: FC<{ characterId: string }> = ({ characterId }) => (
  <div className="dash-app-icon-v3">
    {/* Expanding glow ring */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 22,
        background: "rgba(0,122,255,0.18)",
        animation: "ringExpand 3.2s ease-out 0.4s infinite",
        pointerEvents: "none",
      }}
    />
    {/* Ambient soft glow */}
    <div
      style={{
        position: "absolute",
        inset: -14,
        borderRadius: 36,
        background:
          "radial-gradient(circle, rgba(0,122,255,0.18) 0%, transparent 70%)",
        animation: "iconAmbient 3.6s ease-in-out infinite",
        pointerEvents: "none",
      }}
    />
    {/* App icon face */}
    <div
      style={{
        position: "relative",
        width: 88,
        height: 88,
        borderRadius: 20,
        background:
          "linear-gradient(148deg, #0C1A30 0%, #0E2244 55%, #091C38 100%)",
        boxShadow:
          "0 10px 32px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.09), 0 1px 0 rgba(255,255,255,0.06) inset",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      <CharacterSprite characterId={characterId} size={72} decorative />
    </div>
  </div>
);

/* ── Settings Panel ──────────────────────────────────────────── */

const SettingsPanel: FC = () => {
  const { settings, setSettings } = useGameStore();

  return (
    <div>
      <p className="ios-section-header">Settings</p>
      <div className="ios-card">
        <SliderRow
          label="Master Volume"
          value={settings.masterVolume}
          onChange={(v) => setSettings({ masterVolume: v })}
        />
        <SliderRow
          label="SFX"
          value={settings.sfxVolume}
          onChange={(v) => setSettings({ sfxVolume: v })}
        />
        <SliderRow
          label="Music"
          value={settings.musicVolume}
          onChange={(v) => setSettings({ musicVolume: v })}
        />
        <ToggleRow
          label="Show FPS"
          value={settings.showFPS}
          onChange={(v) => setSettings({ showFPS: v })}
        />
        <ToggleRow
          label="Haptics"
          value={settings.hapticsEnabled}
          onChange={(v) => setSettings({ hapticsEnabled: v })}
        />
        <ToggleRow
          label="Reduced Particles"
          value={settings.reducedParticles}
          onChange={(v) => setSettings({ reducedParticles: v })}
        />
        <TouchControlSettings />
        <CameraModeRow
          value={settings.cameraMode}
          onChange={(cameraMode) => setSettings({ cameraMode })}
        />
        <div
          className="ios-row"
          style={{ flexDirection: "column", alignItems: "flex-start", gap: 5 }}
        >
          <span className="ios-row-label">Controller</span>
          <span className="ios-footnote" style={{ color: "var(--ios-label3)" }}>
            Left stick / D-pad move · A jump · B dash · X attack · Y help
          </span>
        </div>
      </div>
    </div>
  );
};

const CameraModeRow: FC<{
  value: "auto" | "horizontal" | "vertical";
  onChange: (value: "auto" | "horizontal" | "vertical") => void;
}> = ({ value, onChange }) => {
  const modes: Array<{
    id: "auto" | "horizontal" | "vertical";
    label: string;
  }> = [
    { id: "auto", label: "Auto" },
    { id: "horizontal", label: "Wide" },
    { id: "vertical", label: "Tall" },
  ];

  return (
    <div
      className="ios-row"
      style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}
    >
      <span className="ios-row-label">Camera</span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 6,
        }}
      >
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={
              value === mode.id ? "ios-btn-primary" : "ios-btn-secondary"
            }
            onClick={() => {
              onChange(mode.id);
              getSfxEngine().play("click");
            }}
            style={{ height: 34, fontSize: 13 }}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── Stat bar for character select ───────────────────────────── */

const StatBar: FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => {
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        className="ios-caption2"
        style={{
          color: "var(--ios-label3)",
          width: 24,
          fontSize: 9,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          background: "var(--ios-fill3)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 2,
            background: color,
            transition: "width 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            boxShadow: `0 0 6px ${color}44`,
          }}
        />
      </div>
    </div>
  );
};

/* ── Shared row components ────────────────────────────────────── */

const SliderRow: FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => (
  <div
    className="ios-row"
    style={{
      flexDirection: "column",
      alignItems: "stretch",
      gap: 8,
      paddingTop: 13,
      paddingBottom: 13,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span className="ios-row-label">{label}</span>
      <span
        className="ios-footnote"
        style={{
          fontVariantNumeric: "tabular-nums",
          minWidth: 34,
          textAlign: "right",
        }}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={value}
      onChange={(e) => {
        onChange(parseFloat(e.target.value));
        getSfxEngine().play("click");
      }}
    />
  </div>
);

const ToggleRow: FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="ios-row">
    <span className="ios-row-label">{label}</span>
    <IOSToggle checked={value} onChange={onChange} />
  </div>
);

const IOSToggle: FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    className="ios-toggle-track"
    onClick={() => {
      onChange(!checked);
      getSfxEngine().play("click");
    }}
    style={{ background: checked ? "var(--ios-green)" : "var(--ios-fill)" }}
    role="switch"
    aria-checked={checked}
  >
    <div
      className="ios-toggle-thumb"
      style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
    />
  </button>
);

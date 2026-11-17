import { memo, useCallback, useState } from "react";
import {
  Rocket,
  Play,
  RotateCcw,
  Trophy,
  Info,
  Medal,
  Settings,
  Award,
  BarChart3,
} from "lucide-react";

import SpaceScene from "./components/SpaceScene";
import "./App.css";

const StableSpaceScene = memo(SpaceScene);

const DEFAULT_STATS = { gamesPlayed: 0, enemiesDefeated: 0, bossesDefeated: 0, victories: 0 };
const readStorage = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};

const LEVELS = [
  { name: "ROOKIE PILOT", start: 0, target: 1500 },
  { name: "GALACTIC HUNTER", start: 1500, target: 3000 },
  { name: "GALAXY DEFENDER", start: 3000, target: 4500 },
];

function getLevel(score) {
  if (score >= 3000) return 3;
  if (score >= 1500) return 2;
  return 1;
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(3);
  const [resetKey, setResetKey] = useState(0);

  const [highScore, setHighScore] = useState(() =>
    Number(localStorage.getItem("spaceBattleHighScore") || 0)
  );
  const [difficulty, setDifficulty] = useState(() => localStorage.getItem("spaceBattleDifficulty") || "normal");
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [stats, setStats] = useState(() => readStorage("spaceBattleStats", DEFAULT_STATS));

  const updateStats = useCallback((updater) => {
    setStats((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      localStorage.setItem("spaceBattleStats", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleEnemyDefeated = useCallback(() => {
    updateStats((current) => ({ ...current, enemiesDefeated: current.enemiesDefeated + 1 }));
  }, [updateStats]);

  const handleBossDefeated = useCallback(() => {
    updateStats((current) => ({ ...current, bossesDefeated: current.bossesDefeated + 1 }));
  }, [updateStats]);

  const currentLevel = getLevel(score);
  const levelInfo = LEVELS[currentLevel - 1];
  const progress = Math.min(
    100,
    Math.max(
      0,
      ((score - levelInfo.start) / (levelInfo.target - levelInfo.start)) * 100
    )
  );

  const handleScoreChange = useCallback((newScore) => {
    setScore(newScore);
    setHighScore((currentHighScore) => {
      if (newScore > currentHighScore) {
        localStorage.setItem("spaceBattleHighScore", String(newScore));
        return newScore;
      }
      return currentHighScore;
    });
  }, []);

  const handleVictory = useCallback(() => {
    setVictory(true);
    updateStats((current) => ({ ...current, victories: current.victories + 1 }));
  }, [updateStats]);

  function startGame() {
    setScore(0);
    setHealth(3);
    setGameOver(false);
    setVictory(false);
    setShowInstructions(false);
    setShowSettings(false);
    setShowProfile(false);
    setResetKey((value) => value + 1);
    updateStats((current) => ({ ...current, gamesPlayed: current.gamesPlayed + 1 }));
    setStarted(true);
  }

  function exitGame() {
    setStarted(false);
    setGameOver(false);
    setVictory(false);
    setScore(0);
    setHealth(3);
  }

  return (
    <main className="game-container">
      <header className="top-bar">
        <div className="brand">
          <Rocket size={26} />
          <span>SPACE BATTLE <b>3D</b></span>
        </div>
        <div className="level">
          <span>MISSION</span>
          <strong>00{currentLevel}</strong>
        </div>
      </header>

      <section className="game-area">
        {started && !gameOver && !victory && (
          <StableSpaceScene
            key={resetKey}
            onScoreChange={handleScoreChange}
            onHealthChange={setHealth}
            onGameOver={setGameOver}
            onVictory={handleVictory}
            onEnemyDefeated={handleEnemyDefeated}
            onBossDefeated={handleBossDefeated}
            difficulty={difficulty}
            resetKey={resetKey}
          />
        )}

        {started && (
          <div className="hud">
            <div className="hud-item">
              <span>SCORE</span>
              <strong>{String(score).padStart(6, "0")}</strong>
            </div>
            <div className="hud-item">
              <span>LEVEL {currentLevel}</span>
              <strong>{levelInfo.name}</strong>
            </div>
            <div className="hud-item">
              <span>HEALTH</span>
              <strong className="health-text">
                {"♥ ".repeat(Math.max(0, health))}
                {"♡ ".repeat(Math.max(0, 3 - health))}
              </strong>
            </div>
          </div>
        )}

        {started && !gameOver && !victory && (
          <div className="mission-progress">
            <div className="mission-progress-heading">
              <span>MISSION {currentLevel} PROGRESS</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mission-progress-track">
              <div className="mission-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <small>TARGET: {levelInfo.target.toLocaleString()} POINTS</small>
          </div>
        )}

        {!started && (
          <div className="start-overlay">
            <div className="start-content">
              <span className="eyebrow">GALACTIC DEFENSE SYSTEM</span>
              <h1>SPACE <span>BATTLE 3D</span></h1>
              <p>Destroy enemy ships. Protect your galaxy. Become the ultimate space pilot.</p>
              <button className="start-button" onClick={startGame}>
                <Play size={20} fill="currentColor" /> START MISSION
              </button>
              <button className="menu-button instructions-button" onClick={() => setShowInstructions((value) => !value)}>
                <Info size={18} /> {showInstructions ? "HIDE INSTRUCTIONS" : "HOW TO PLAY"}
              </button>

              <div className="stage8-menu-actions">
                <button className="menu-button" onClick={() => { setShowSettings((v) => !v); setShowProfile(false); }}><Settings size={17} /> SETTINGS</button>
                <button className="menu-button" onClick={() => { setShowProfile((v) => !v); setShowSettings(false); }}><BarChart3 size={17} /> PILOT PROFILE</button>
              </div>

              {showSettings && (
                <div className="stage8-panel">
                  <h3>DIFFICULTY</h3>
                  <div className="difficulty-options">
                    {["easy", "normal", "hard"].map((level) => (
                      <button key={level} className={difficulty === level ? "difficulty-option selected" : "difficulty-option"}
                        onClick={() => { setDifficulty(level); localStorage.setItem("spaceBattleDifficulty", level); }}>
                        {level.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <p>Easy: slower attacks and weaker bosses.</p>
                  <p>Normal: standard combat balance.</p>
                  <p>Hard: faster attacks and tougher bosses.</p>
                  <small>Difficulty applies to your next mission.</small>
                </div>
              )}

              {showProfile && (
                <div className="stage8-panel profile-panel">
                  <h3><Award size={16} /> PILOT RECORD</h3>
                  <div className="profile-stats">
                    <span>Games played <strong>{stats.gamesPlayed}</strong></span>
                    <span>Enemies defeated <strong>{stats.enemiesDefeated}</strong></span>
                    <span>Bosses defeated <strong>{stats.bossesDefeated}</strong></span>
                    <span>Victories <strong>{stats.victories}</strong></span>
                  </div>
                  <h3>ACHIEVEMENTS</h3>
                  <div className="achievement-list">
                    <span className={stats.enemiesDefeated >= 1 ? "unlocked" : "locked"}> {stats.enemiesDefeated >= 1 ? "★" : "☆"} FIRST STRIKE</span>
                    <span className={stats.bossesDefeated >= 1 ? "unlocked" : "locked"}> {stats.bossesDefeated >= 1 ? "★" : "☆"} BOSS HUNTER</span>
                    <span className={stats.enemiesDefeated >= 100 ? "unlocked" : "locked"}> {stats.enemiesDefeated >= 100 ? "★" : "☆"} CENTURION</span>
                    <span className={stats.victories >= 1 ? "unlocked" : "locked"}> {stats.victories >= 1 ? "★" : "☆"} GALAXY SAVIOR</span>
                  </div>
                </div>
              )}

              {showInstructions && (
                <div className="instructions-panel">
                  <h3>FLIGHT CONTROLS</h3>
                  <p>WASD / Arrow keys — Move spaceship</p>
                  <p>SPACE — Shoot lasers</p>
                  <p>E — Activate shield</p>
                  <p>P — Pause or resume</p>
                  <h3>MISSION OBJECTIVES</h3>
                  <p>Defeat The Destroyer, The Phantom and the Galactic Overlord.</p>
                  <p>Collect power-ups and avoid enemy fire.</p>
                </div>
              )}

              <div className="high-score-display">
                <Medal size={20} />
                <span>BEST SCORE</span>
                <strong>{highScore.toLocaleString()}</strong>
              </div>
              <div className="mission-info"><span>DEFEND</span><span>ATTACK</span><span>SURVIVE</span></div>
              <div className="controls-hint">WASD / ARROWS TO MOVE | SPACE TO SHOOT</div>
            </div>
          </div>
        )}

        {started && gameOver && (
          <div className="game-over-overlay">
            <div className="game-over-card">
              <Trophy size={48} color="#35d9ff" />
              <h1>GAME OVER</h1>
              <p>Your spaceship has been destroyed.</p>
              <div className="final-score"><span>FINAL SCORE</span><strong>{score.toLocaleString()}</strong></div>
              <p>BEST SCORE: {highScore.toLocaleString()}</p>
              <button className="start-button" onClick={startGame}><RotateCcw size={18} /> PLAY AGAIN</button>
              <button className="menu-button" onClick={exitGame}>MAIN MENU</button>
            </div>
          </div>
        )}

        {started && victory && (
          <div className="game-over-overlay">
            <div className="game-over-card victory-card">
              <Trophy size={58} color="#ffd45c" />
              <h1>GALAXY SAVED!</h1>
              <p>You defeated all three boss ships.</p>
              <div className="final-score"><span>FINAL SCORE</span><strong>{score.toLocaleString()}</strong></div>
              <p>BEST SCORE: {highScore.toLocaleString()}</p>
              <h3>ALL BOSS MISSIONS COMPLETED</h3>
              <button className="start-button" onClick={startGame}><RotateCcw size={18} /> PLAY AGAIN</button>
              <button className="menu-button" onClick={exitGame}>MAIN MENU</button>
            </div>
          </div>
        )}

        {started && !gameOver && !victory && (
          <button className="exit-button" onClick={exitGame}>EXIT MISSION</button>
        )}

        <div className="bottom-info">
          <span>SECTOR 07 - DEEP SPACE</span>
          <span>{victory ? "ALL BOSSES DEFEATED" : gameOver ? "MISSION FAILED" : started ? `LEVEL ${currentLevel} ACTIVE` : "SYSTEM ONLINE"}</span>
        </div>
      </section>

      <footer className="game-footer">SPACE BATTLE 3D | POWERED BY THREE.JS</footer>
    </main>
  );
}

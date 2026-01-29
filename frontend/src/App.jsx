import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Sword, Zap, Coins, MapPin, Skull, ShieldAlert, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './App.css'

// Import assets
import heroImg from './assets/hero.jpg'
import miniHero1 from './assets/mini_hero_1.png'
import miniHero2 from './assets/mini_hero_2.png'

const API_BASE = 'http://localhost:3001/api'

// Coordinate helper (Interpolated)
const getPos = (square, areas) => {
  if (!areas || areas.length === 0) return { x: 0, y: 0 };

  const s = Math.max(1, Math.min(square, 47));
  const floorS = Math.floor(s);
  const ceilS = Math.ceil(s);

  const a1 = areas.find(a => a.order === floorS) || areas[0];
  const a2 = areas.find(a => a.order === ceilS) || a1;

  const t = s - floorS;
  return {
    x: a1.x + (a2.x - a1.x) * t,
    y: a1.y + (a2.y - a1.y) * t
  };
};

function App() {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState(["全国制覇への道が始まった..."])
  const [isRolling, setIsRolling] = useState(false)
  const [isWalking, setIsWalking] = useState(false)
  const [walkImgIdx, setWalkImgIdx] = useState(1)
  const [displaySquare, setDisplaySquare] = useState(0)
  const [allAreas, setAllAreas] = useState([])
  const [battle, setBattle] = useState(null)
  const [rival, setRival] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [lastRoll, setLastRoll] = useState(null)
  const [showEnding, setShowEnding] = useState(false)
  const [showGameOver, setShowGameOver] = useState(false)
  const logEndRef = useRef(null)

  const fetchPlayer = async () => {
    try {
      const res = await axios.get(`${API_BASE}/player`)
      setPlayer(res.data)
      setDisplaySquare(res.data.current_square)
      setLoading(false)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchAreas = async () => {
    try {
      const res = await axios.get(`${API_BASE}/areas`)
      setAllAreas(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchPlayer()
    fetchAreas()
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Walking animation loop
  useEffect(() => {
    let interval;
    if (isWalking) {
      interval = setInterval(() => {
        setWalkImgIdx(prev => (prev === 1 ? 2 : 1))
      }, 200);
    } else {
      setWalkImgIdx(1);
    }
    return () => clearInterval(interval);
  }, [isWalking])

  const addLog = (msg) => {
    setLogs(prev => [...prev, `> ${msg}`])
  }

  const handleRoll = async () => {
    setIsRolling(true)
    addLog("サイコロを振っている...")

    try {
      await new Promise(r => setTimeout(r, 800))

      const res = await axios.post(`${API_BASE}/sugoroku/roll`)
      const { roll, player: updatedPlayer, event, message } = res.data

      setLastRoll(roll)

      // Start sequential walking animation
      setIsWalking(true)
      addLog(`${roll} の目が出た！気合で歩くぞ！`)

      // Move step by step (Interpolated)
      let currentSq = player.current_square;

      const steps = roll * 10; // 10 mini-steps per square for smooth transition
      for (let i = 0; i <= steps; i++) {
        await new Promise(r => setTimeout(r, 60)); // Time per mini-step
        setDisplaySquare(currentSq + (i / 10));
      }

      await new Promise(r => setTimeout(r, 400));
      setIsWalking(false)
      setPlayer(updatedPlayer)
      setDisplaySquare(updatedPlayer.current_square)
      addLog(message)

      if (event === 'battle' || event === 'boss_battle') {
        startBattle(event === 'boss_battle')
      }
    } catch (err) {
      addLog("エラー発生：バックエンドが喧嘩に負けてるようだ")
    } finally {
      setIsRolling(false)
    }
  }

  const startBattle = async (isBoss = false) => {
    try {
      const res = await axios.post(`${API_BASE}/battle/start`, { isBoss })
      setRival(res.data.rival)
      setBattle({ ...res.data.battle, rival_current_guts: res.data.rival.guts, status: 'active' })
      addLog(`${res.data.rival.name}が現れた！喧嘩上等だ！`)

      // Fetch Ruby Prediction
      const predRes = await axios.post(`${API_BASE}/battle/predict`, {
        player_hp: player.guts,
        player_atk: player.strength,
        enemy_hp: res.data.rival.guts,
        enemy_atk: res.data.rival.strength
      })
      setPrediction(predRes.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleBattleAction = async (action) => {
    try {
      const res = await axios.post(`${API_BASE}/battle/action`, { action })
      const { logs: battleLogs, battle: updatedBattle, player: updatedPlayer } = res.data

      battleLogs.forEach(l => addLog(l))
      setBattle(updatedBattle)
      setPlayer(updatedPlayer)

      if (updatedBattle.status === 'won') {
        if (rival.gimmick === 'phase_shift') {
          setTimeout(() => setShowEnding(true), 1500)
        } else {
          setTimeout(() => {
            setBattle(null)
            setRival(null)
            setPrediction(null)
          }, 2000)
        }
      } else if (updatedBattle.status === 'lost') {
        setTimeout(() => setShowGameOver(true), 1500)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleRestart = () => {
    window.location.reload()
  }

  // Get Next Objective Helper
  const getNextObjective = (currentSq) => {
    const objectives = [
      { order: 11, name: '広島', boss: '鬼瓦 鉄丸 (紅蓮鉄砲高校)' },
      { order: 16, name: '大阪', boss: '笑門 (浪速笑殺高校)' },
      { order: 26, name: '沖縄', boss: '島袋 カイ (琉覇魂高校)' },
      { order: 46, name: '北海道', boss: '氷室 冬牙 (白夜極寒高校)' },
      { order: 47, name: '東京', boss: '総代 会長 (国会議事堂高校)' }
    ];
    const next = objectives.find(o => o.order > currentSq) || objectives[objectives.length - 1];
    const distance = next.order - currentSq;
    return { ...next, distance: Math.max(0, distance) };
  };

  if (loading || allAreas.length === 0) return <div className="loading">LOADING GUTS...</div>

  const pos = getPos(displaySquare, allAreas);
  const nextObj = getNextObjective(player.current_square);

  return (
    <div className="app-layout">
      {/* Header Section */}
      <header className="header-section">
        <div className="header-left">
          <h1 className="game-logo">YANKEE SUGOROKU RPG</h1>
        </div>
        <div className="header-center">
          <div className="objective-box">
            <span className="label">Next Target:</span>
            <span className="target-name">{nextObj.name}</span>
            <span className="boss-info">VS {nextObj.boss}</span>
            <span className="distance">あと <span className="num">{nextObj.distance}</span> 県</span>
          </div>
        </div>
        <div className="header-right">
          <div className="current-loc">
            <MapPin size={16} />
            {player.current_area_name}
          </div>
        </div>
      </header>

      {/* Left Sidebar: Stats */}
      <aside className="sidebar-section">
        <div className="player-profile">
          <div className="hero-portrait-sidebar">
            <img src={heroImg} alt="Hero" />
          </div>
          <div className="player-info">
            <div className="title-badge-sm">{player.title}</div>
            <div className="player-name-lg">{player.name}</div>
          </div>
        </div>

        <div className="stats-list">
          <StatRow icon={<div className="icon-box red">根</div>} label="根性 (HP)" value={player.guts} max={player.max_guts} color="var(--neon-red)" />
          <StatRow icon={<div className="icon-box blue">気</div>} label="気合 (MP)" value={player.kiai} max={player.max_kiai} color="var(--neon-blue)" />
          <StatRow icon={<div className="icon-box yellow">金</div>} label="メンチ" value={player.menchi} color="var(--neon-yellow)" />
          <StatRow icon={<div className="icon-box purple">防</div>} label="防御力" value={player.defense} color="var(--neon-purple)" />
          <div className="stat-divider"></div>
          <StatRow icon={<Sword size={16} />} label="攻撃力" value={player.strength} color="#fff" />
          <StatRow icon={<Zap size={16} />} label="素早さ" value={player.speed} color="#fff" />
        </div>
      </aside>

      {/* Center: Map */}
      <main className="main-section">
        <div className="map-container-full">
          <AnimatePresence mode="wait">
            {lastRoll && (
              <motion.div
                key={lastRoll}
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                exit={{ scale: 0 }}
                className="dice-overlay"
              >
                <Dice value={lastRoll} />
              </motion.div>
            )}
          </AnimatePresence>

          {allAreas.map(area => (
            <div
              key={area.id}
              className={`map-dot ${displaySquare >= area.order ? 'active' : ''}`}
              style={{ left: `${area.x}%`, top: `${area.y}%` }}
              data-major={["広島", "大阪", "沖縄", "北海道", "東京"].includes(area.name)}
            >
              <div className="dot-inner"></div>
              <span className={`dot-label ${area.label_dir || 'bottom'}`}>{area.name}</span>
            </div>
          ))}

          <div
            className={`mini-hero-container ${isWalking ? 'walking-animation' : ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <img
              src={walkImgIdx === 1 ? miniHero1 : miniHero2}
              className="mini-hero-img"
              alt="Mini Hero"
            />
          </div>
        </div>

        {/* Battle Overlay (Conditional) */}
        <AnimatePresence>
          {battle && rival && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="battle-modal"
            >
              <div className="battle-header">
                <span className="blinking">BATTLE START!!</span>
              </div>

              <div className="battle-arena">
                <div className="fighter player">
                  <img src={heroImg} className="fighter-img" />
                  <div className="hp-bar-sm"><div className="fill" style={{ width: `${(player.guts / player.max_guts) * 100}%` }}></div></div>
                </div>
                <div className="vs">VS</div>
                <div className="fighter enemy">
                  <div className="fighter-img enemy-icon">👿</div>
                  <div className="enemy-info">
                    <div className="name">{rival.name}</div>
                    <div className="school">{rival.school_name}</div>
                  </div>
                  <div className="hp-bar-sm"><div className="fill" style={{ width: `${(battle.rival_current_guts / rival.guts) * 100}%` }}></div></div>
                </div>
              </div>

              {/* Prediction */}
              {prediction && (
                <div className="battle-prediction">
                  <div className="pred-row">
                    <span className="label">YANKEE'S INTUITION:</span>
                    <span className="val text-neon-blue">{prediction.win_rate}% Win Rate</span>
                  </div>
                  <div className="advice">"{prediction.advice}"</div>
                </div>
              )}

              <div className="battle-controls">
                {battle.status === 'active' ? (
                  <>
                    <button className="battle-btn attack" onClick={() => handleBattleAction('attack')}>
                      <Sword size={18} /> 殴る
                    </button>
                    <button
                      className="battle-btn skill"
                      onClick={() => handleBattleAction('skill')}
                      disabled={player.kiai < 3}
                    >
                      <Zap size={18} /> 必殺 (気合3)
                    </button>
                  </>
                ) : (
                  <div className="battle-result">
                    {battle.status === 'won' ? "WINNER!" : "LOSE..."}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ending Screens */}
        <AnimatePresence>
          {showEnding && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="full-overlay">
              <h1>🏆 全国制覇</h1>
              <p>「ここが日本の頂点や。今日からワシが“日本最強の高校生”や」</p>
              <button className="restart-btn" onClick={handleRestart}>NEW GAME</button>
            </motion.div>
          )}
          {showGameOver && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="full-overlay">
              <h1>GAME OVER</h1>
              <button className="restart-btn" onClick={handleRestart}>RETRY</button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Right Sidebar: Logs & Control */}
      <aside className="log-section">
        <div className="log-header">
          <span className="log-title">ACTION LOG</span>
        </div>
        <div className="log-content">
          {logs.map((log, i) => (
            <div key={i} className="log-item">
              <span className="bullet">›</span> {log}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        <div className="control-area">
          <button
            className="main-roll-btn"
            onClick={handleRoll}
            disabled={isRolling || battle}
          >
            {isRolling ? "ROLLING..." : "メンチを切って進む"}
            <div className="btn-sub">ROLL THE DICE</div>
          </button>
        </div>
      </aside>
    </div>
  )
}

function StatRow({ icon, label, value, max, color }) {
  return (
    <div className="stat-row" style={{ '--stat-color': color }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-details">
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {value} {max && <span className="max">/ {max}</span>}
        </div>
      </div>
    </div>
  )
}

function Dice({ value }) {
  // value is 1-6
  // sprite is 3 columns, 2 rows
  // 1: x=0, y=0
  // 2: x=-100, y=0
  // 3: x=-200, y=0
  // 4: x=0, y=-100
  // 5: x=-100, y=-100
  // 6: x=-200, y=-100
  const row = value > 3 ? 1 : 0;
  const col = (value - 1) % 3;

  const style = {
    backgroundPosition: `-${col * 100}px -${row * 100}px`
  };

  return <div className="dice-container" style={style}></div>
}

export default App

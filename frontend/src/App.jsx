import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sword, Zap, Map as MapIcon, ChevronRight, MessageSquare, Shield } from 'lucide-react'
import axios from 'axios'
import './App.css'

// Assets
import heroImg from './assets/hero.jpg'
import miniHero1 from './assets/mini_hero_1.png'
import miniHero2 from './assets/mini_hero_2.png'

const API_BASE = 'http://localhost:3001/api'

export default function App() {
  const [player, setPlayer] = useState(null)
  const [allAreas, setAllAreas] = useState([])
  const [isRolling, setIsRolling] = useState(false)
  const [lastRoll, setLastRoll] = useState(null)
  const [logs, setLogs] = useState(["全国制覇への旅が始まった..."])
  const [battle, setBattle] = useState(null)
  const [rival, setRival] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [isWalking, setIsWalking] = useState(false)
  const [walkImgIdx, setWalkImgIdx] = useState(1)
  const [showEnding, setShowEnding] = useState(false)
  const [showGameOver, setShowGameOver] = useState(false)

  const logEndRef = useRef(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const fetchInitialData = async () => {
    try {
      const [pRes, aRes] = await Promise.all([
        axios.get(`${API_BASE}/player`),
        axios.get(`${API_BASE}/areas`)
      ])
      setPlayer(pRes.data)
      setAllAreas(aRes.data)
      setPos({ x: pRes.data.x, y: pRes.data.y })
    } catch (e) {
      console.error("Failed to fetch data", e)
    }
  }

  const addLog = (msg) => {
    setLogs(prev => [...prev, msg].slice(-20))
  }

  const handleRoll = async () => {
    if (isRolling || battle) return
    setIsRolling(true)
    try {
      const res = await axios.post(`${API_BASE}/sugoroku/roll`)
      const { roll, player: updatedPlayer, event, message } = res.data

      setLastRoll(roll)
      addLog(message)

      // Start Walking Animation
      setIsWalking(true)
      const walkInterval = setInterval(() => {
        setWalkImgIdx(prev => (prev === 1 ? 2 : 1))
      }, 150)

      // Linear move for simplicity in this demo, usually you'd animate through segments
      setPos({ x: updatedPlayer.x, y: updatedPlayer.y })

      setTimeout(async () => {
        clearInterval(walkInterval)
        setIsWalking(false)
        setIsRolling(false)
        setLastRoll(null)
        setPlayer(updatedPlayer)

        if (event === 'battle' || event === 'boss_battle') {
          startBattle(event === 'boss_battle')
        }
      }, 2000)

    } catch (e) {
      setIsRolling(false)
    }
  }

  const startBattle = async (isBoss) => {
    try {
      const res = await axios.post(`${API_BASE}/battle/start`, { isBoss })
      setBattle({ id: res.data.battleId, status: 'active', rival_current_guts: res.data.rival.guts })
      setRival(res.data.rival)
      fetchPrediction()
    } catch (e) {
      console.error("Battle failed to start", e)
    }
  }

  const fetchPrediction = async () => {
    try {
      const res = await axios.post(`${API_BASE}/battle/predict`)
      setPrediction(res.data)
    } catch (e) {
      setPrediction(null)
    }
  }

  const handleBattleAction = async (action) => {
    try {
      const res = await axios.post(`${API_BASE}/battle/action`, { action })
      const { status, logs: battleLogs, player: updatedPlayer, rivalGuts } = res.data

      battleLogs.forEach(l => addLog(l))
      setPlayer(updatedPlayer)
      setBattle(prev => ({ ...prev, status, rival_current_guts: rivalGuts }))

      if (status === 'won') {
        if (rival.is_boss && updatedPlayer.current_area_name === '東京') {
          setShowEnding(true)
        }
        setTimeout(() => {
          setBattle(null)
          setRival(null)
          setPrediction(null)
          fetchInitialData() // Refresh areas to see boss_defeated
        }, 3000)
      } else if (status === 'lost') {
        setShowGameOver(true)
      }
    } catch (e) {
      console.error("Action failed", e)
    }
  }

  const handleRecover = async () => {
    try {
      const res = await axios.post(`${API_BASE}/player/recover`)
      addLog(res.data.message)
      setPlayer(res.data.player)
    } catch (e) {
      addLog("エラー: " + (e.response?.data?.error || "回復できません。"))
    }
  }

  const handleRestart = () => {
    window.location.reload()
  }

  if (!player) return <div className="loading">LOADING NANIWA...</div>

  const currentArea = allAreas.find(a => a.id === player.current_area_id)
  const displaySquare = player.current_square
  const expNeeded = player.level * 100
  const canRecover = currentArea?.order === 1 || currentArea?.boss_defeated;

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="header-section">
        <h1 className="game-logo">九牙式：全国番長無双</h1>
        <div className="header-center">
          <div className="objective-box">
            <div className="label">目的地</div>
            <div className="target-name">東京 / 総代 会長</div>
            <div className="distance">あと <span className="num">{47 - displaySquare}</span> ヶ所</div>
          </div>
        </div>
        <div className="current-loc">
          <MapIcon size={18} />
          <span>現在地: {player.current_area_name}</span>
        </div>
      </header>

      {/* Left Sidebar: Stats */}
      <aside className="sidebar-section">
        <div className="player-profile">
          <div className="player-info">
            <span className="title-badge-sm">{player.title}</span>
            <div className="player-name-lg">{player.name}</div>
          </div>
          <div className="hero-portrait-sidebar">
            <img src={heroImg} alt="hero" />
          </div>
        </div>

        <div className="stats-list">
          <StatRow icon={<div className="icon-box purple">Lv</div>} label={`Level ${player.level}`} value={`${player.exp} / ${expNeeded} Exp`} color="var(--neon-purple)" />
          <StatRow icon={<div className="icon-box red">根</div>} label="根性 (HP)" value={player.guts} max={player.max_guts} color="var(--neon-red)" />
          <StatRow icon={<div className="icon-box blue">気</div>} label="気合 (MP)" value={player.kiai} max={player.max_kiai} color="var(--neon-blue)" />
          <div className="stat-divider"></div>
          <StatRow icon={<Sword size={16} />} label="攻撃力" value={player.strength} color="#fff" />
          <StatRow icon={<Shield size={16} />} label="防御力" value={player.defense} color="#fff" />
          <StatRow icon={<Zap size={16} />} label="メンチ" value={player.menchi} color="var(--neon-yellow)" />
        </div>

        {canRecover && !battle && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="recover-btn"
            onClick={handleRecover}
          >
            飯を食って回復する
          </motion.button>
        )}
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
              data-defeated={area.boss_defeated}
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

        {/* Battle Overlay */}
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
              <h1>死闘の果てに倒れた...</h1>
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
            {isRolling ? "MOVING..." : "メンチを切って進む"}
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
  const row = value > 3 ? 1 : 0;
  const col = (value - 1) % 3;
  const style = {
    backgroundPosition: `-${col * 100}px -${row * 100}px`,
    backgroundImage: "url('/assets/dice.png')",
    width: '100px',
    height: '100px',
    backgroundSize: '300px 200px'
  };
  return <div className="dice-container" style={style}></div>
}

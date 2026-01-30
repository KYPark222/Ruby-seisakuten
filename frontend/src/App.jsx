import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sword, Zap, Map as MapIcon, ChevronRight, MessageSquare, Shield } from 'lucide-react'
import axios from 'axios'
import './App.css'

// Assets
import heroImg from './assets/hero.jpg'
import miniHero1 from './assets/mini_hero_1.png'
import miniHero2 from './assets/mini_hero_2.png'
import diceImg from './assets/dice.png'

const API_BASE = 'http://localhost:3001/api'

export default function App() {
  const [player, setPlayer] = useState(null)
  const [allAreas, setAllAreas] = useState([])
  const [isRolling, setIsRolling] = useState(false)
  const [lastRoll, setLastRoll] = useState(null)
  const [shufflingDice, setShufflingDice] = useState(false)
  const [displayDiceValue, setDisplayDiceValue] = useState(1)
  const [logs, setLogs] = useState(["全国制覇への旅が始まった..."])
  const [battle, setBattle] = useState(null)
  const [rival, setRival] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [isWalking, setIsWalking] = useState(false)
  const [walkImgIdx, setWalkImgIdx] = useState(1)
  const [showEnding, setShowEnding] = useState(false)
  const [showGameOver, setShowGameOver] = useState(false)
  const [selectableAreaIds, setSelectableAreaIds] = useState([])

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

      setLastRoll(null) // Reset lastRoll to show animation
      setShufflingDice(true)

      const shuffleInterval = setInterval(() => {
        setDisplayDiceValue(Math.floor(Math.random() * 6) + 1)
      }, 80)

      setTimeout(async () => {
        clearInterval(shuffleInterval)
        setShufflingDice(false)
        setLastRoll(roll)
        setDisplayDiceValue(roll)
        addLog(`サイコロ：${roll}が出た！移動先を選べ！`)

        // Calculate selectable areas via BFS
        const currentArea = allAreas.find(a => a.id === player.current_area_id)
        if (!currentArea) {
          setIsRolling(false)
          return
        }

        const targetSequence = ['広島', '大阪', '沖縄', '北海道', '東京']

        // Find nodes at exact distance 'roll'
        // We use BFS to find all nodes at distance 'roll'
        // Queued item: { areaId, distance, visited }
        let queue = [{ id: currentArea.id, dist: 0, path: [currentArea.id] }]
        let results = new Set()
        let bossTerminals = new Set()

        while (queue.length > 0) {
          let { id, dist, path } = queue.shift()

          if (dist === roll) {
            results.add(id)
            continue
          }

          // In this game, areas are connected if their 'order' differs by 1
          const area = allAreas.find(a => a.id === id)
          const neighbors = allAreas.filter(a => Math.abs(a.order - area.order) === 1)

          for (let neighbor of neighbors) {
            // Standard rule: no immediate backtracking (A -> B -> A)
            if (path.length >= 2 && neighbor.id === path[path.length - 2]) continue

            // Boss check: If we hit a boss that isn't defeated, we must stop there
            const isBoss = targetSequence.includes(neighbor.name) && !neighbor.boss_defeated

            if (isBoss) {
              bossTerminals.add(neighbor.id)
            } else {
              queue.push({ id: neighbor.id, dist: dist + 1, path: [...path, neighbor.id] })
            }
          }
        }

        // Add both exact distance nodes and boss terminals
        const finalIds = new Set([...results, ...bossTerminals])
        setSelectableAreaIds(Array.from(finalIds))

        setIsRolling(false)
      }, 1200)

    } catch (e) {
      setIsRolling(false)
      setShufflingDice(false)
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

  const handleMove = async (targetAreaId) => {
    if (isRolling || battle) return
    setSelectableAreaIds([])
    setLastRoll(null)

    try {
      setIsWalking(true)
      const walkInterval = setInterval(() => {
        setWalkImgIdx(prev => (prev === 1 ? 2 : 1))
      }, 150)

      const res = await axios.post(`${API_BASE}/sugoroku/move`, { targetAreaId })
      const { player: updatedPlayer, event, message } = res.data

      // Animate movement
      setPos({ x: updatedPlayer.x, y: updatedPlayer.y })

      setTimeout(() => {
        clearInterval(walkInterval)
        setIsWalking(false)
        setPlayer(updatedPlayer)
        addLog(message)

        if (event === 'battle' || event === 'boss_battle') {
          startBattle(event === 'boss_battle')
        }
      }, 1500)
    } catch (e) {
      setIsWalking(false)
      console.error("Movement failed", e)
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

  const handleRestart = async () => {
    try {
      await axios.post(`${API_BASE}/system/reset`)
      window.location.reload()
    } catch (e) {
      console.error("Reset failed", e)
      window.location.reload()
    }
  }

  if (!player) return <div className="loading">LOADING NANIWA...</div>

  const currentArea = allAreas.find(a => a.id === player.current_area_id)
  const displaySquare = player.current_square
  const expNeeded = player.level * 100
  const canRecover = currentArea?.order === 1 || currentArea?.boss_defeated;

  const targetSequence = ['広島', '大阪', '沖縄', '北海道', '東京']
  const currentTargetName = targetSequence.find(name => {
    const area = allAreas.find(a => a.name === name)
    return area && !area.boss_defeated
  }) || '東京'
  const currentTargetArea = allAreas.find(a => a.name === currentTargetName)

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="header-section">
        <h1 className="game-logo">九牙式：全国番長無双</h1>
        <div className="header-center">
          <div className="objective-box">
            <div className="label">目的地</div>
            <div className="target-name">{currentTargetName} / {currentTargetArea?.boss_name || '???'}</div>
            <div className="distance">あと <span className="num">{currentTargetArea ? Math.max(0, currentTargetArea.order - displaySquare) : '??'}</span> ヶ所</div>
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

        <div className="sidebar-footer">
          <button className="system-retry-btn" onClick={handleRestart}>
            RETRY
          </button>
        </div>
      </aside>

      {/* Center: Map */}
      <main className="main-section">
        <div className="map-container-full">
          <AnimatePresence mode="wait">
            {(lastRoll || shufflingDice) && (
              <motion.div
                key={shufflingDice ? 'shuffling' : lastRoll}
                initial={{ rotate: -180, scale: 0, opacity: 0 }}
                animate={{
                  rotate: shufflingDice ? [0, 90, 180, 270, 360] : 0,
                  scale: 1,
                  opacity: 1,
                  y: shufflingDice ? [0, -20, 0] : 0
                }}
                transition={{
                  rotate: { repeat: shufflingDice ? Infinity : 0, duration: 0.5, ease: "linear" },
                  y: { repeat: shufflingDice ? Infinity : 0, duration: 0.3 }
                }}
                exit={{ scale: 0, opacity: 0 }}
                className="dice-overlay"
              >
                <Dice value={shufflingDice ? displayDiceValue : lastRoll} />
              </motion.div>
            )}
          </AnimatePresence>

          {allAreas.map(area => (
            <div
              key={area.id}
              className={`map-dot ${player.current_area_id === area.id ? 'active' : ''} ${selectableAreaIds.includes(area.id) ? 'selectable' : ''} ${currentTargetArea && area.order > currentTargetArea.order ? 'locked' : ''}`}
              style={{ left: `${area.x}%`, top: `${area.y}%` }}
              data-major={targetSequence.includes(area.name)}
              data-defeated={area.boss_defeated}
              onClick={() => selectableAreaIds.includes(area.id) && handleMove(area.id)}
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
    backgroundImage: `url(${diceImg})`,
    width: '100px',
    height: '100px',
    backgroundSize: '300px 200px'
  };
  return <div className="dice-container" style={style}></div>
}

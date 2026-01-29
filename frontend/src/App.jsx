import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Sword, Zap, Coins, MapPin, Skull, ShieldAlert } from 'lucide-react'
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

      if (event === 'battle') {
        startBattle()
      }
    } catch (err) {
      addLog("エラー発生：バックエンドが喧嘩に負けてるようだ")
    } finally {
      setIsRolling(false)
    }
  }

  const startBattle = async () => {
    try {
      const res = await axios.post(`${API_BASE}/battle/start`)
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

      if (updatedBattle.status !== 'active') {
        setTimeout(() => {
          setBattle(null)
          setRival(null)
          setPrediction(null)
        }, 2000)
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading || allAreas.length === 0) return <div className="loading">LOADING GUTS...</div>

  const pos = getPos(displaySquare, allAreas);

  return (
    <div className="yankee-container">
      <AnimatePresence>
        {battle && rival && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="battle-overlay"
          >
            <h2 className="text-4xl font-black italic mb-8 animate-pulse text-neon-red">超次元喧嘩中!!</h2>

            <div className="battle-scene">
              <div className="char-box">
                <div className="char-img hero-img">
                  <img src={heroImg} alt="Protagonist" />
                </div>
                <div className="font-bold text-xl">{player.name}</div>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{ width: `${(player.guts / player.max_guts) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs mt-1">GUTS: {player.guts}/{player.max_guts}</div>
              </div>

              <div className="text-6xl font-black text-neon-yellow italic">VS</div>

              <div className="char-box">
                <div className="char-img">👿</div>
                <div className="font-bold text-xl">{rival.name}</div>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{ width: `${(battle.rival_current_guts / rival.guts) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs mt-1">GUTS: {battle.rival_current_guts}/{rival.guts}</div>
              </div>
            </div>

            {prediction && (
              <div className="prediction-box">
                <div className="prediction-header">
                  <ShieldAlert size={16} className="text-neon-yellow" />
                  <span>ヤンキーの勘 (Powered by Ruby)</span>
                </div>
                <div className="prediction-content">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-xs opacity-70">勝率予測:</span>
                    <span className="text-2xl font-black text-neon-blue">{prediction.win_rate}%</span>
                  </div>
                  <div className="text-sm italic border-l-2 border-neon-yellow pl-3 py-1">
                    「{prediction.advice}」
                  </div>
                </div>
                <div className="prediction-footer">
                  {prediction.engine}
                </div>
              </div>
            )}

            {battle.status === 'active' ? (
              <div className="battle-actions">
                <button className="action-btn" onClick={() => handleBattleAction('attack')}>メンチを切って殴る</button>
                <button className="action-btn" style={{ borderColor: 'var(--neon-purple)' }} disabled>気合で叫ぶ (Lv.5〜)</button>
              </div>
            ) : (
              <div className="text-3xl font-bold uppercase tracking-widest">
                {battle.status === 'won' ? "勝利！！" : "敗北..."}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.h1
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="game-title"
      >
        YANKEE SUGOROKU RPG
      </motion.h1>

      <div className="stats-grid">
        <StatCard
          icon={<div className="hero-portrait"><img src={heroImg} alt="Hero" /></div>}
          label="根性 (GUTS)"
          value={player.guts}
          max={player.max_guts}
          type="guts"
        />
        <StatCard
          icon={<Zap className="text-neon-blue" />}
          label="気合 (KIAI)"
          value={player.kiai}
          max={player.max_kiai}
          type="kiai"
        />
        <StatCard
          icon={<Coins className="text-neon-yellow" />}
          label="メンチ (MENCHI)"
          value={player.menchi}
          type="menchi"
        />
      </div>

      <div className="main-board">
        <div className="map-section">
          <div className="map-inner">
            <AnimatePresence mode="wait">
              {lastRoll && (
                <motion.div
                  key={lastRoll}
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  exit={{ scale: 0 }}
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
              >
                <span className="dot-label">{area.name}</span>
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

            <div className="mt-8 flex flex-col items-center">
              <MapPin className="scanning text-neon-red" size={48} />
              <div style={{ marginTop: '0.5rem', fontWeight: 900, fontSize: '1.5rem', color: 'white', textShadow: '0 0 10px #000' }}>{player.current_area_name}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--neon-yellow)' }}>全国制覇まで: {47 - player.current_square} 県</div>
            </div>
          </div>

          <div className="absolute top-4 left-4 p-4 bg-black bg-opacity-70 rounded-lg">
            <div style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--neon-purple)' }}>Current Mission</div>
            <div style={{ fontWeight: 900 }}>日本制覇・{player.current_area_name?.split(' ')[0] || ''}編</div>
          </div>
        </div>

        <div className="control-panel">
          <div className="log-box">
            {logs.map((log, i) => (
              <div key={i} className="mb-2">{log}</div>
            ))}
            <div ref={logEndRef} />
          </div>

          <button
            className="roll-btn"
            onClick={handleRoll}
            disabled={isRolling || battle}
          >
            {isRolling ? "Rolling..." : "メンチを切って進む"}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, max, type }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`stat-card ${type}`}
    >
      <div className="flex justify-center mb-2">{icon}</div>
      <span className="stat-label">{label}</span>
      <div className="stat-value">{value}{max && <span className="stat-sub"> / {max}</span>}</div>
    </motion.div>
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

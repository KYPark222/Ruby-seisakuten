import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Sword, Zap, Coins, MapPin, Skull, ShieldAlert } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './App.css'

const API_BASE = 'http://localhost:3001/api'

function App() {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState(["全国制覇への道が始まった..."])
  const [isRolling, setIsRolling] = useState(false)
  const [battle, setBattle] = useState(null)
  const [rival, setRival] = useState(null)
  const logEndRef = useRef(null)

  const fetchPlayer = async () => {
    try {
      const res = await axios.get(`${API_BASE}/player`)
      setPlayer(res.data)
      setLoading(false)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchPlayer()
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

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

      setPlayer(updatedPlayer)
      addLog(`${roll} の目が出た！`)
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
      addLog(`${res.data.rival.name}が現れた！`)
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
        }, 2000)
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="loading">LOADING GUTS...</div>

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
                <div className="char-img">👨‍🎓</div>
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
          icon={<Sword className="text-neon-red" />}
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
            <MapPin className="scanning" size={48} />
            <div style={{ marginTop: '1rem' }}>{player.current_area_name}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>マス目: {player.current_square} / 10</div>
          </div>

          <div className="absolute top-4 left-4 p-4">
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

export default App

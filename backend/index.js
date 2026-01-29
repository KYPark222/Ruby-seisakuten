const express = require('express');
const cors = require('cors');
const db = require('./db');
const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Routes ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Yankee Sugoroku API is running' });
});

// Get Player Status
app.get('/api/player', async (req, res) => {
    try {
        const player = await db('players').first();
        const area = await db('areas').where({ id: player.current_area_id }).first();
        res.json({ ...player, current_area_name: area.name, x: area.x, y: area.y });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Areas
app.get('/api/areas', async (req, res) => {
    try {
        const areas = await db('areas').orderBy('order', 'asc');
        res.json(areas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Roll Dice & Move
app.post('/api/sugoroku/roll', async (req, res) => {
    try {
        const roll = Math.floor(Math.random() * 6) + 1;
        const player = await db('players').first();

        // New logic: 1 prefecture = 1 square. Total 47 squares.
        const currentArea = await db('areas').where({ id: player.current_area_id }).first();
        const currentOrder = currentArea.order;
        let nextOrder = currentOrder + roll;
        if (nextOrder > 47) nextOrder = 47;

        // Force Stop at Major Cities Logic
        // Hiroshima(11), Osaka(16), Okinawa(26? No, strictly check names/gimmicks), Hokkaido(46), Tokyo(47)
        // Fetch major boss areas that are strictly between current (exclusive) and target (inclusive)
        const majorCities = ['広島', '大阪', '沖縄', '北海道', '東京'];
        const passedMajorAreas = await db('areas')
            .whereIn('name', majorCities)
            .where('order', '>', currentOrder)
            .where('order', '<=', nextOrder)
            .orderBy('order', 'asc');

        let event = 'nothing';
        let message = `サイコロを振って ${roll} 進んだ！`;
        let forcedStop = false;

        if (passedMajorAreas.length > 0) {
            // Stop at the first major area encountered
            const stopArea = passedMajorAreas[0];
            nextOrder = stopArea.order;
            forcedStop = true;
            event = 'boss_battle';
            message = `${stopArea.name}に到着！強敵の気配がする...`;
        } else {
            const nextAreaTemp = await db('areas').where({ order: nextOrder }).first(); // Check destination
            if (nextOrder === 47 && currentArea.order !== 47) {
                event = 'boss_battle'; // Tokyo allows battle
                message = "日本の頂点、東京に着いたぞ。最後の戦いだ。";
            } else {
                if (Math.random() > 0.6) {
                    event = 'battle';
                    message = `${nextAreaTemp.name}でチンピラに絡まれた！`;
                }
            }
        }

        const nextAreaInfo = await db('areas').where({ order: nextOrder }).first();

        await db('players').where({ id: player.id }).update({
            current_area_id: nextAreaInfo.id,
            current_square: nextOrder
        });

        const updatedPlayer = await db('players').where({ id: player.id }).first();
        res.json({
            roll,
            player: { ...updatedPlayer, current_area_name: nextAreaInfo.name, x: nextAreaInfo.x, y: nextAreaInfo.y },
            event,
            message
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Battle Routes ---

// Start a battle
app.post('/api/battle/start', async (req, res) => {
    try {
        const { isBoss } = req.body;
        const player = await db('players').first();

        let rivalQuery = db('rivals').where({ area_id: player.current_area_id });

        if (isBoss) {
            rivalQuery = rivalQuery.where({ is_boss: true });
        } else {
            rivalQuery = rivalQuery.where({ is_boss: false });
        }

        const rival = await rivalQuery.orderByRaw('RANDOM()').first();

        // Fallback if no boss/minion found (should not happen with correct seeds)
        if (!rival) {
            const anyRival = await db('rivals').where({ area_id: player.current_area_id }).first();
            if (!anyRival) return res.status(404).json({ error: 'No rivals found' });
            // Use fallback
        }

        // Clear old active battles
        await db('active_battles').where({ player_id: player.id }).del();

        const [battleId] = await db('active_battles').insert({
            player_id: player.id,
            rival_id: rival.id,
            rival_current_guts: rival.guts,
            status: 'active'
        }).returning('id');

        res.json({ battleId, rival });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Battle Action
app.post('/api/battle/action', async (req, res) => {
    const { action } = req.body;
    try {
        const activeBattle = await db('active_battles').where({ status: 'active' }).first();
        if (!activeBattle) return res.status(400).json({ error: 'No active battle' });

        const player = await db('players').where({ id: activeBattle.player_id }).first();
        const rival = await db('rivals').where({ id: activeBattle.rival_id }).first();

        let logs = [];
        let playerDmg = 0;
        let rivalDmg = 0;

        // 1. Player Turn Phase
        if (activeBattle.player_stunned) {
            logs.push(`${player.name}はスタンしていて動けない！`);
            activeBattle.player_stunned = false;
        } else {
            // Check Trait: 「噛み砕く根性」
            let currentAtk = player.strength;
            if (player.guts / player.max_guts <= 0.3) {
                currentAtk += 2;
                logs.push(`🦷「噛み砕く根性」発動！ピンチで力がみなぎる！（攻撃力+2）`);
            }

            if (action === 'attack' || action === 'skill') {
                if (action === 'skill') {
                    if (player.kiai < 3) return res.status(400).json({ error: '気合が足りない！' });
                    await db('players').where({ id: player.id }).decrement('kiai', 3);
                    playerDmg = Math.floor(currentAtk * 1.5 * (0.9 + Math.random() * 0.2));
                    logs.push(`👊 必殺「九牙式・一発入魂」！！`);
                } else {
                    playerDmg = Math.floor(currentAtk * (0.8 + Math.random() * 0.4));
                    logs.push(`${player.name}の攻撃！`);
                }

                // Rival Gimmick: Evasion (Osaka)
                if (rival.gimmick === 'evasion' && Math.random() < 0.3) {
                    logs.push(`${rival.name}「見え見えやで」 ヒラリと攻撃をかわされた！`);
                    playerDmg = 0;
                }

                if (playerDmg > 0) {
                    activeBattle.rival_current_guts -= playerDmg;
                    logs.push(`${rival.name}に ${playerDmg} のダメージ！`);

                    // Skill effect: Stun
                    if (action === 'skill' && Math.random() < 0.3) {
                        activeBattle.rival_stunned = true;
                        logs.push(`${rival.name}は衝撃でスタンした！`);
                    }
                }
            }
        }

        // 2. Check Win Phase
        if (activeBattle.rival_current_guts <= 0) {
            activeBattle.rival_current_guts = 0;
            activeBattle.status = 'won';

            const newMenchi = player.menchi + rival.menchi_reward;
            const newExp = player.experience + rival.exp_reward;
            const newMaxGuts = player.max_guts + 2; // Victory growth

            // Title Update
            let newTitle = player.title;
            if (player.current_square >= 30) newTitle = '全国制覇の牙';
            else if (player.current_square >= 10) newTitle = '九州の問題児';

            await db('players').where({ id: player.id }).update({
                menchi: newMenchi,
                experience: newExp,
                max_guts: newMaxGuts,
                title: newTitle
            });

            if (rival.is_boss) {
                logs.push(`伝説の漢、${rival.name}を沈めた！`);
                if (rival.gimmick === 'phase_shift') {
                    logs.push(`「ここが日本の頂点や。今日からワシが“日本最強の高校生”や」`);
                }
            } else {
                logs.push(`${rival.name}をぶっ飛ばした！`);
            }
            logs.push(`${rival.menchi_reward} メンチと ${rival.exp_reward} 経験値、根性最大値+2を獲得。`);
        } else {
            // 3. Rival Turn Phase
            if (activeBattle.rival_stunned) {
                logs.push(`${rival.name}はスタンしていて動けない！`);
                activeBattle.rival_stunned = false;
            } else {
                let currentRivalAtk = rival.strength;

                // Boss Gimmicks
                if (rival.gimmick === 'first_turn_atk' && activeBattle.turn === 1) {
                    currentRivalAtk *= 1.5;
                    logs.push(`${rival.name}「${rival.dialogue}」 初手全力ブチかまし！！`);
                }
                if (rival.gimmick === 'phase_shift' && (activeBattle.rival_current_guts / rival.guts <= 0.5)) {
                    if (!activeBattle.boss_boosted) {
                        activeBattle.boss_boosted = true;
                        logs.push(`${rival.name}「${rival.dialogue}」 覇気が爆裂に高まる！！`);
                    }
                    currentRivalAtk *= 1.3;
                }

                rivalDmg = Math.floor(currentRivalAtk * (0.8 + Math.random() * 0.4));
                rivalDmg = Math.max(1, rivalDmg - player.defense);

                const newGuts = Math.max(0, player.guts - rivalDmg);
                await db('players').where({ id: player.id }).update({ guts: newGuts });
                logs.push(`${rival.name}の攻撃！ ${rivalDmg} のダメージを受けた！`);

                // Boss Gimmick: Kiai Drain (Hokkaido)
                if (rival.gimmick === 'kiai_drain') {
                    const kiaiDrain = 2;
                    const currentPlayer = await db('players').where({ id: player.id }).first();
                    const newKiai = Math.max(0, currentPlayer.kiai - kiaiDrain);
                    await db('players').where({ id: player.id }).update({ kiai: newKiai });
                    logs.push(`${rival.name}の冷気が気合を ${kiaiDrain} 奪い去った！`);
                }

                // Boss Gimmick: Healing (Okinawa)
                if (rival.gimmick === 'healing') {
                    const heal = Math.floor(rival.guts * 0.05);
                    activeBattle.rival_current_guts = Math.min(rival.guts, activeBattle.rival_current_guts + heal);
                    logs.push(`${rival.name}の琉球の風が傷を癒す (+${heal} HP)`);
                }

                if (newGuts <= 0) {
                    activeBattle.status = 'lost';
                    logs.push(`「地面に膝をついた。視界が暗くなる……」`);
                }
            }
        }

        await db('active_battles').where({ id: activeBattle.id }).update({
            rival_current_guts: activeBattle.rival_current_guts,
            status: activeBattle.status,
            turn: activeBattle.turn + 1,
            player_stunned: activeBattle.player_stunned,
            rival_stunned: activeBattle.rival_stunned,
            boss_boosted: activeBattle.boss_boosted
        });

        const updatedPlayer = await db('players').where({ id: player.id }).first();
        res.json({ battle: activeBattle, player: updatedPlayer, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Battle Prediction (Ruby Integration)
app.post('/api/battle/predict', async (req, res) => {
    try {
        const { player_hp, player_atk, enemy_hp, enemy_atk } = req.body;
        const input = JSON.stringify({ player_hp, player_atk, enemy_hp, enemy_atk });

        const scriptPath = path.join(__dirname, 'scripts', 'yankee_intuition.rb');

        // Escape single quotes in input for shell the command
        const escapedInput = input.replace(/'/g, "'\\''");

        exec(`ruby "${scriptPath}" '${escapedInput}'`, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return res.status(500).json({ error: "Ruby prediction failed" });
            }
            try {
                const result = JSON.parse(stdout);
                res.json(result);
            } catch (e) {
                res.status(500).json({ error: "Failed to parse Ruby output" });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

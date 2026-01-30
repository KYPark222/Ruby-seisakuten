const express = require('express');
const cors = require('cors');
const db = require('./db');
const path = require('path');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// --- Helper Functions ---

const calculateExpToNextLevel = (level) => {
    return level * 100; // Simplified scale: 100, 200, 300...
};

// --- API Endpoints ---

// Get player info
app.get('/api/player', async (req, res) => {
    try {
        const player = await db('players')
            .join('areas', 'players.current_area_id', 'areas.id')
            .select('players.*', 'areas.name as current_area_name', 'areas.x', 'areas.y')
            .first();
        res.json(player);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all areas (for map)
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
        res.json({ roll });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Move Player to Selected Area
app.post('/api/sugoroku/move', async (req, res) => {
    try {
        const { targetAreaId } = req.body;
        const player = await db('players').first();
        const targetArea = await db('areas').where({ id: targetAreaId }).first();

        if (!targetArea) return res.status(404).json({ error: 'Area not found' });

        // Update player position
        await db('players').where({ id: player.id }).update({
            current_area_id: targetArea.id,
            current_square: targetArea.order
        });

        // Event Handling (Battle/Boss)
        let event = 'nothing';
        let message = `${targetArea.name}に到着した。`;

        // Check if it's a major city (Boss Battle)
        const majorCities = ['広島', '大阪', '沖縄', '北海道', '東京'];
        if (majorCities.includes(targetArea.name) && !targetArea.boss_defeated) {
            event = 'boss_battle';
            message = `${targetArea.name}に到着！強敵の気配がする...`;
        } else if (targetArea.name === '東京' && !targetArea.boss_defeated) {
            event = 'boss_battle';
            message = "日本の頂点、東京に着いたぞ。最後の戦いだ。";
        } else if (Math.random() > 0.6) {
            event = 'battle';
            message = `${targetArea.name}でチンピラに絡まれた！`;
        }

        const updatedPlayer = await db('players')
            .where('players.id', player.id)
            .join('areas', 'players.current_area_id', 'areas.id')
            .select('players.*', 'areas.name as current_area_name', 'areas.x', 'areas.y')
            .first();

        res.json({ player: updatedPlayer, event, message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Battle
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
        if (!rival) return res.status(404).json({ error: 'No rivals found' });

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

// Battle Action (Attack/Skill)
app.post('/api/battle/action', async (req, res) => {
    try {
        const { action } = req.body;
        const player = await db('players').first();
        const activeBattle = await db('active_battles')
            .where({ player_id: player.id, status: 'active' })
            .first();

        if (!activeBattle) return res.status(400).json({ error: 'No active battle' });

        const rival = await db('rivals').where({ id: activeBattle.rival_id }).first();

        let log = [];
        let playerDmg = 0;
        let rivalDmg = 0;

        // Player Turn
        let baseDmg = player.strength;

        // Player Unique Skill: 根性30%以下の場合、攻撃力+3
        if (player.guts <= player.max_guts * 0.3) {
            baseDmg += 3;
            log.push(`${player.name}の底力が爆発！ 攻撃力がアップした！`);
        }

        if (action === 'skill') {
            if (player.kiai < 3) return res.status(400).json({ error: 'Not enough Kiai' });
            baseDmg *= 3; // "九牙式・一発入魂"
            await db('players').where({ id: player.id }).decrement('kiai', 3);
            log.push(`九牙式・一発入魂！ ${rival.name}に ${baseDmg} の致命傷！`);
        } else {
            // Check for Boss Evasion Gimmick (Osaka)
            if (rival.gimmick === 'evasion' && Math.random() < 0.3) {
                log.push(`${rival.name}は身軽にかわした！ ダメージを与えられない！`);
                baseDmg = 0;
            } else {
                log.push(`${player.name}の攻撃！ ${rival.name}に ${baseDmg} のダメージ！`);
            }
        }
        rivalDmg = baseDmg;

        let newRivalGuts = Math.max(0, activeBattle.rival_current_guts - rivalDmg);

        // Rival Turn (if still alive)
        if (newRivalGuts > 0) {
            let rivalStrength = rival.strength;

            // Boss Gimmicks
            if (rival.gimmick === 'first_turn_atk' && activeBattle.turn === 1) {
                rivalStrength += 4;
                log.push(`${rival.name}の初手強攻撃！ 重い一撃が飛んでくる！`);
            }
            if (rival.gimmick === 'phase_shift' && newRivalGuts <= rival.guts / 2) {
                rivalStrength += 2;
                log.push(`${rival.name}の本気！ 攻撃力が上昇した！`);
            }
            if (rival.gimmick === 'healing') {
                newRivalGuts = Math.min(rival.guts, newRivalGuts + 2);
                log.push(`${rival.name}は傷口を焼いた！ 根性が2回復した。`);
            }
            if (rival.gimmick === 'kiai_drain') {
                const newKiai = Math.max(0, player.kiai - 1);
                await db('players').where({ id: player.id }).update({ kiai: newKiai });
                log.push(`${rival.name}の凶悪な一撃！ ${player.name}の気合が1削られた！`);
            }

            playerDmg = Math.max(1, rivalStrength - player.defense);
            log.push(`${rival.name}の反撃！ ${player.name}は ${playerDmg} のダメージを受けた。`);

            // Fix: Ensure HP doesn't go below 0
            const currentPlayer = await db('players').where({ id: player.id }).first();
            const newPlayerGuts = Math.max(0, (currentPlayer.guts || player.guts) - playerDmg);
            await db('players').where({ id: player.id }).update({ guts: newPlayerGuts });
        }

        // Update turn count
        await db('active_battles').where({ id: activeBattle.id }).increment('turn', 1);

        const updatedPlayer = await db('players')
            .where('players.id', player.id)
            .join('areas', 'players.current_area_id', 'areas.id')
            .select('players.*', 'areas.name as current_area_name', 'areas.x', 'areas.y')
            .first();
        let status = 'active';
        let expGained = 0;
        let leveledUp = false;

        if (newRivalGuts <= 0) {
            status = 'won';

            // Check for Boss Defeat Dialogues
            if (rival.is_boss && rival.defeat_dialogue) {
                if (rival.name === '鬼瓦 鉄丸') {
                    log.push("EFFECT:SHAKE");
                    log.push("EFFECT:SILENCE");
                }
                log.push(rival.defeat_dialogue);

                if (rival.name === '笑門') log.push("EFFECT:HIDE_IMAGE");
                if (rival.name === '島袋 カイ') log.push("EFFECT:FADEOUT_BGM");
                if (rival.name === '氷室 冬牙') log.push("EFFECT:ICE_CRACK");

                if (rival.name === '総代 会長') {
                    log.push("EFFECT:BLACKOUT");
                    log.push("EFFECT:WAIT");
                    log.push("EFFECT:VICTORY_BGM");
                    log.push("九牙 アラシ: 「……これが、俺の全国制覇や」");
                }
            } else {
                log.push(`${rival.name}をぶっ飛ばした！`);
            }

            expGained = rival.exp_reward;
            log.push(`経験値を ${expGained} 獲得した。`);

            // Check Boss Defeat
            if (rival.is_boss) {
                await db('areas').where({ id: player.current_area_id }).update({ boss_defeated: true });
                log.push(`この街の支配権を握った！これからはここでメシ（回復）が食える。`);
            }

            // Level Up Check
            let newExp = player.exp + expGained;
            let currentLv = player.level;
            let expNeeded = calculateExpToNextLevel(currentLv);

            if (newExp >= expNeeded) {
                leveledUp = true;
                currentLv += 1;
                newExp -= expNeeded;
                // Stat Growth
                await db('players').where({ id: player.id }).update({
                    level: currentLv,
                    exp: newExp,
                    max_guts: player.max_guts + 10,
                    guts: player.max_guts + 10, // Heal on level up
                    strength: player.strength + 2,
                    defense: player.defense + 1,
                    max_kiai: player.max_kiai + 2,
                    kiai: player.max_kiai + 2
                });
                log.push(`レベルアップ！ Lv.${currentLv} になった！ 全ステータスが上昇したぞ！`);
            } else {
                await db('players').where({ id: player.id }).update({ exp: newExp });
            }
        } else if (updatedPlayer.guts <= 0) {
            status = 'lost';
            log.push(`${player.name}は意識を失った...`);
            log.push("「……まだ、終われねぇ……」");
            log.push(`福岡からやり直しか...次はゼッテーぶっ飛ばす！！！`);

            // Restart from Fukuoka
            const fukuoka = await db('areas').where({ order: 1 }).first();
            await db('players').where({ id: player.id }).update({
                current_area_id: fukuoka.id,
                current_square: 1,
                guts: player.max_guts, // Recover to max
                kiai: player.max_kiai
            });

            // Re-fetch to return the restarted state
            const restartedPlayer = await db('players')
                .where('players.id', player.id)
                .join('areas', 'players.current_area_id', 'areas.id')
                .select('players.*', 'areas.name as current_area_name', 'areas.x', 'areas.y')
                .first();

            return res.json({
                status: 'lost',
                logs: log,
                player: restartedPlayer,
                rivalGuts: newRivalGuts,
                leveledUp: false
            });
        }

        await db('active_battles').where({ id: activeBattle.id }).update({
            rival_current_guts: newRivalGuts,
            status: status
        });

        res.json({
            status,
            logs: log,
            player: updatedPlayer,
            rivalGuts: newRivalGuts,
            leveledUp
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Recover Player
app.post('/api/player/recover', async (req, res) => {
    try {
        const player = await db('players').first();
        const area = await db('areas').where({ id: player.current_area_id }).first();

        // Check if Fukuoka (Area Order 1) or Boss Defeated
        if (area.order === 1 || area.boss_defeated) {
            await db('players').where({ id: player.id }).update({
                guts: player.max_guts,
                kiai: player.max_kiai
            });
            const updatedPlayer = await db('players')
                .where('players.id', player.id)
                .join('areas', 'players.current_area_id', 'areas.id')
                .select('players.*', 'areas.name as current_area_name', 'areas.x', 'areas.y')
                .first();
            res.json({ message: "メシを食って全回復した！気合十分だ。", player: updatedPlayer });
        } else {
            res.status(403).json({ error: "このエリアにはまだシマを任せられるツレがいねえ。回復はできねえぞ。" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Yankee Intuition (Ruby Integration)
// System Reset (Initialize data)
app.post('/api/system/reset', async (req, res) => {
    try {
        await db.transaction(async trx => {
            // Delete all active battles
            await trx('active_battles').del();

            // Reset all boss_defeated flags in areas
            await trx('areas').update({ boss_defeated: false });

            // Find Fukuoka ID
            const fukuoka = await trx('areas').where({ name: '福岡' }).first();

            // Reset player to initial state
            await trx('players').update({
                title: '博多の無名',
                guts: 30,
                max_guts: 30,
                kiai: 8,
                max_kiai: 8,
                strength: 7,
                defense: 4,
                menchi: 0,
                exp: 0,
                level: 1,
                current_area_id: fukuoka ? fukuoka.id : 1,
                current_square: 1
            });
        });

        res.json({ message: "すべてのデータが初期化されました。博多から再出発や！" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/predict', async (req, res) => {
    try {
        const player = await db('players').first();
        const activeBattle = await db('active_battles').where({ status: 'active' }).first();
        if (!activeBattle) return res.status(400).json({ error: 'No active battle' });
        const rival = await db('rivals').where({ id: activeBattle.rival_id }).first();

        const rubyScriptPath = path.join(__dirname, 'scripts', 'yankee_intuition.rb');
        const inputData = JSON.stringify({
            player_hp: player.guts,
            player_atk: player.strength,
            enemy_hp: activeBattle.rival_current_guts,
            enemy_atk: rival.strength
        });
        const cmd = `ruby "${rubyScriptPath}" '${inputData}'`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) return res.status(500).json({ error: stderr || error.message });
            try {
                const result = JSON.parse(stdout);
                res.json(result);
            } catch (e) {
                res.status(500).json({ error: "Ruby output parsing failed" });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

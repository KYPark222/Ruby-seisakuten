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
            .select('players.*', 'areas.name as current_area_name')
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
        const player = await db('players').first();
        const currentArea = await db('areas').where({ id: player.current_area_id }).first();

        let nextOrder = currentArea.order + roll;
        if (nextOrder > 47) nextOrder = 47;

        // Force Stop at Major Cities Logic
        const majorCities = ['広島', '大阪', '沖縄', '北海道', '東京'];
        const passedMajorAreas = await db('areas')
            .whereIn('name', majorCities)
            .where('order', '>', currentArea.order)
            .where('order', '<=', nextOrder)
            .orderBy('order', 'asc');

        let event = 'nothing';
        let message = `サイコロを振って ${roll} 進んだ！`;

        if (passedMajorAreas.length > 0) {
            const stopArea = passedMajorAreas[0];
            nextOrder = stopArea.order;
            event = 'boss_battle';
            message = `${stopArea.name}に到着！強敵の気配がする...`;
        } else {
            const nextAreaTemp = await db('areas').where({ order: nextOrder }).first();
            if (nextOrder === 47 && currentArea.order !== 47) {
                event = 'boss_battle';
                message = "日本の頂点、東京に着いたぞ。最後の戦いだ。";
            } else if (Math.random() > 0.6) {
                event = 'battle';
                message = `${nextAreaTemp.name}でチンピラに絡まれた！`;
            }
        }

        const nextArea = await db('areas').where({ order: nextOrder }).first();
        await db('players').where({ id: player.id }).update({
            current_area_id: nextArea.id,
            current_square: nextArea.order
        });

        const updatedPlayer = await db('players')
            .where('players.id', player.id)
            .join('areas', 'players.current_area_id', 'areas.id')
            .select('players.*', 'areas.name as current_area_name')
            .first();

        res.json({ roll, player: updatedPlayer, event, message });
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
        if (action === 'skill') {
            if (player.kiai < 3) return res.status(400).json({ error: 'Not enough Kiai' });
            baseDmg *= 3; // "九牙式・一発入魂"
            await db('players').where({ id: player.id }).decrement('kiai', 3);
            log.push(`九牙式・一発入魂！ ${rival.name}に ${baseDmg} の致命傷！`);
        } else {
            log.push(`${player.name}の攻撃！ ${rival.name}に ${baseDmg} のダメージ！`);
        }
        rivalDmg = baseDmg;

        let newRivalGuts = Math.max(0, activeBattle.rival_current_guts - rivalDmg);

        // Rival Turn (if still alive)
        if (newRivalGuts > 0) {
            playerDmg = Math.max(1, rival.strength - player.defense);
            log.push(`${rival.name}の反撃！ ${player.name}は ${playerDmg} のダメージを受けた。`);
            await db('players').where({ id: player.id }).decrement('guts', playerDmg);
        }

        const updatedPlayer = await db('players').where({ id: player.id }).first();
        let status = 'active';
        let expGained = 0;
        let leveledUp = false;

        if (newRivalGuts <= 0) {
            status = 'won';
            log.push(`${rival.name}をぶっ飛ばした！`);
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
            res.json({ message: "メシを食って全回復した！気合十分だ。", player: await db('players').first() });
        } else {
            res.status(403).json({ error: "このエリアにはまだシマを任せられるツレがいねえ。回復はできねえぞ。" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Yankee Intuition (Ruby Integration)
app.post('/api/battle/predict', async (req, res) => {
    try {
        const player = await db('players').first();
        const activeBattle = await db('active_battles').where({ status: 'active' }).first();
        if (!activeBattle) return res.status(400).json({ error: 'No active battle' });
        const rival = await db('rivals').where({ id: activeBattle.rival_id }).first();

        const rubyScriptPath = path.join(__dirname, 'scripts', 'yankee_intuition.rb');
        const cmd = `ruby "${rubyScriptPath}" ${player.guts} ${player.strength} ${player.defense} ${activeBattle.rival_current_guts} ${rival.strength} ${rival.speed}`;

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

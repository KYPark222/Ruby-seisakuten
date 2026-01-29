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
        let nextOrder = currentArea.order + roll;
        if (nextOrder > 47) nextOrder = 47;

        const nextArea = await db('areas').where({ order: nextOrder }).first();

        let event = 'nothing';
        let message = `サイコロを振って ${roll} 進んだ！`;

        if (nextOrder === 47 && currentArea.order !== 47) {
            event = 'goal';
            message = "日本制覇！ついに最北の地、北海道に到達したぞ！";
        } else {
            // Random Event (Combat)
            if (Math.random() > 0.6) {
                event = 'battle';
                message = `${nextArea.name}でチンピラに絡まれた！`;
            }
        }

        await db('players').where({ id: player.id }).update({
            current_area_id: nextArea.id,
            current_square: nextOrder
        });

        const updatedPlayer = await db('players').where({ id: player.id }).first();
        const updatedArea = await db('areas').where({ id: updatedPlayer.current_area_id }).first();
        res.json({
            roll,
            player: { ...updatedPlayer, current_area_name: updatedArea.name, x: updatedArea.x, y: updatedArea.y },
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
        const player = await db('players').first();
        const rival = await db('rivals')
            .where({ area_id: player.current_area_id, is_boss: false })
            .orderByRaw('RANDOM()')
            .first();

        if (!rival) {
            return res.status(404).json({ error: 'No rivals found for this area' });
        }

        // Clear old active battles for this player
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

        // Player Turn
        if (action === 'attack') {
            playerDmg = Math.floor(player.strength * (0.8 + Math.random() * 0.4));
            activeBattle.rival_current_guts -= playerDmg;
            logs.push(`${player.name}の攻撃！ ${rival.name}に ${playerDmg} のダメージ！`);
        }

        // Check Rival Health
        if (activeBattle.rival_current_guts <= 0) {
            activeBattle.rival_current_guts = 0;
            activeBattle.status = 'won';

            // Rewards
            const newMenchi = player.menchi + rival.menchi_reward;
            const newExp = player.experience + rival.exp_reward;
            await db('players').where({ id: player.id }).update({ menchi: newMenchi, experience: newExp });

            logs.push(`${rival.name}をぶっ飛ばした！ ${rival.menchi_reward} メンチと ${rival.exp_reward} 経験値を獲得。`);
        } else {
            // Rival Turn
            rivalDmg = Math.floor(rival.strength * (0.8 + Math.random() * 0.4));
            const newGuts = Math.max(0, player.guts - rivalDmg);
            await db('players').where({ id: player.id }).update({ guts: newGuts });
            logs.push(`${rival.name}の反撃！ ${rivalDmg} のダメージを受けた！`);

            if (newGuts <= 0) {
                activeBattle.status = 'lost';
                logs.push(`${player.name}は力尽きた...`);
            }
        }

        await db('active_battles').where({ id: activeBattle.id }).update({
            rival_current_guts: activeBattle.rival_current_guts,
            status: activeBattle.status,
            turn: activeBattle.turn + 1
        });

        const updatedPlayer = await db('players').where({ id: player.id }).first();
        res.json({ battle: activeBattle, player: updatedPlayer, logs });
    } catch (error) {
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

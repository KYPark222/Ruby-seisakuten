/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
    // Deletes ALL existing entries
    await knex('active_battles').del();
    await knex('rivals').del();
    await knex('players').del();
    await knex('areas').del();

    const prefectureData = [
        // 九州 (Start) - Bottom Left
        { name: '福岡', x: 22, y: 70, labelDir: 'left' },
        { name: '佐賀', x: 19, y: 72, labelDir: 'bottom' },
        { name: '長崎', x: 16, y: 74, labelDir: 'left' },
        { name: '熊本', x: 22, y: 76, labelDir: 'right' },
        { name: '大分', x: 26, y: 71, labelDir: 'top' },
        { name: '宮崎', x: 25, y: 80, labelDir: 'right' },
        { name: '鹿児島', x: 21, y: 84, labelDir: 'right' },

        // 中国・四国 - Moving Right & Slightly Up
        { name: '山口', x: 29, y: 68, labelDir: 'top' },
        { name: '島根', x: 33, y: 63, labelDir: 'top' },
        { name: '鳥取', x: 37, y: 62, labelDir: 'top' },
        { name: '広島', x: 33, y: 67, labelDir: 'bottom', boss: '鬼瓦 鉄丸', school: '紅蓮鉄砲高校', dialogue: '広島の拳は、言葉より早いんじゃ', gimmick: 'first_turn_atk' },
        { name: '岡山', x: 37, y: 66, labelDir: 'right' },

        // Shikoku (Below Chugoku)
        { name: '香川', x: 39, y: 71, labelDir: 'top' },
        { name: '愛媛', x: 35, y: 73, labelDir: 'left' },
        { name: '徳島', x: 41, y: 73, labelDir: 'right' },
        { name: '高知', x: 37, y: 77, labelDir: 'bottom' },

        // 近畿 - Central West
        { name: '兵庫', x: 42, y: 66, labelDir: 'left' },
        { name: '和歌山', x: 44, y: 76, labelDir: 'bottom' },
        { name: '奈良', x: 47, y: 70, labelDir: 'bottom' },
        { name: '三重', x: 50, y: 72, labelDir: 'bottom' },
        { name: '滋賀', x: 47, y: 65, labelDir: 'top' },
        { name: '京都', x: 45, y: 63, labelDir: 'top' },
        { name: '大阪', x: 44, y: 69, labelDir: 'right', boss: '笑門', school: '浪速笑殺高校', dialogue: 'おもろなってきたやん？ほな本気でいくで', gimmick: 'evasion' },

        // 中部 - Central
        { name: '愛知', x: 53, y: 68, labelDir: 'bottom' },
        { name: '静岡', x: 58, y: 70, labelDir: 'bottom' },
        { name: '岐阜', x: 52, y: 62, labelDir: 'top' },
        { name: '福井', x: 49, y: 60, labelDir: 'left' },
        { name: '石川', x: 50, y: 55, labelDir: 'left' },
        { name: '富山', x: 54, y: 56, labelDir: 'right' },

        // 特殊 (沖縄) - Far Bottom Left
        { name: '沖縄', x: 10, y: 88, labelDir: 'bottom', boss: '島袋 カイ', school: '琉覇魂高校', dialogue: '海みたいに、簡単には倒れんさー', gimmick: 'healing' },

        // 中部・関東 - East
        { name: '長野', x: 58, y: 60, labelDir: 'top' },
        { name: '山梨', x: 62, y: 65, labelDir: 'left' },
        { name: '神奈川', x: 67, y: 70, labelDir: 'bottom' },
        { name: '千葉', x: 74, y: 68, labelDir: 'right' },
        { name: '埼玉', x: 68, y: 63, labelDir: 'left' },
        { name: '群馬', x: 65, y: 58, labelDir: 'left' },
        { name: '栃木', x: 69, y: 56, labelDir: 'right' },
        { name: '茨城', x: 73, y: 62, labelDir: 'right' },

        // 東北 - North East
        { name: '新潟', x: 61, y: 50, labelDir: 'left' },
        { name: '福島', x: 72, y: 52, labelDir: 'bottom' },
        { name: '宮城', x: 76, y: 47, labelDir: 'right' },
        { name: '山形', x: 72, y: 46, labelDir: 'left' },
        { name: '岩手', x: 78, y: 40, labelDir: 'right' },
        { name: '秋田', x: 73, y: 40, labelDir: 'left' },
        { name: '青森', x: 76, y: 34, labelDir: 'top' },

        // 北海道 (準ラスボス) - Far Top Right
        { name: '北海道', x: 88, y: 20, labelDir: 'bottom', boss: '氷室 冬牙', school: '白夜極寒高校', dialogue: '寒さに耐えられん根性なら、ここまでや', gimmick: 'kiai_drain' },

        // 東京 (ラスボス) - Center of Kanto
        { name: '東京', x: 68, y: 67, labelDir: 'right', boss: '総代 会長', school: '国会議事堂高校', dialogue: 'ここは力だけでは立てん。覚悟も含めて、試させてもらう', gimmick: 'phase_shift' }
    ];

    const areas = prefectureData.map((p, i) => ({
        name: p.name,
        order: i + 1,
        difficulty: Math.floor(i / 10) + 1,
        boss_name: p.boss || `${p.name}のドン`,
        x: p.x,
        y: p.y,
        label_dir: p.labelDir || 'bottom'
    }));

    await knex('areas').insert(areas);
    const allAreas = await knex('areas').select('*');

    // Insert initial player: 九牙 アラシ
    await knex('players').insert([
        {
            name: '九牙 アラシ',
            title: '博多の無名',
            guts: 20, max_guts: 20,
            kiai: 10, max_kiai: 10,
            strength: 5,
            defense: 3,
            menchi: 0,
            current_area_id: allAreas.find(a => a.name === '福岡').id,
            current_square: 1
        }
    ]);

    // Insert rivals
    const rivalsData = [];
    prefectureData.forEach((pref, i) => {
        const area = allAreas.find(a => a.name === pref.name);
        // Regular minion
        rivalsData.push({
            name: `${pref.name}の不良`,
            school_name: '地元の高校',
            area_id: area.id,
            guts: 10 + i * 2,
            strength: 2 + Math.floor(i / 5),
            speed: 2 + Math.floor(i / 8),
            menchi_reward: 50 + i * 10,
            exp_reward: 10 + (i * 2), // Boosted exp reward
            is_boss: false
        });

        // Boss
        rivalsData.push({
            name: pref.boss || `${pref.name}のドン`,
            school_name: pref.school || `${pref.name}連合`,
            area_id: area.id,
            guts: pref.boss ? (20 + i * 10) : (30 + i * 5),
            strength: pref.boss ? (5 + i) : (4 + Math.floor(i / 2)),
            speed: 5 + Math.floor(i / 4),
            dialogue: pref.dialogue || 'ここから先は通さんぞ！',
            gimmick: pref.gimmick || null,
            menchi_reward: 500 + i * 50,
            exp_reward: 100 + (i * 10), // Bosses give lot of exp
            is_boss: true
        });
    });

    await knex('rivals').insert(rivalsData);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('rivals').del();
  await knex('players').del();
  await knex('areas').del();

  const prefectureData = [
    { name: '沖縄', x: 12, y: 85 }, { name: '鹿児島', x: 18, y: 78 }, { name: '宮崎', x: 22, y: 79 },
    { name: '熊本', x: 19, y: 74 }, { name: '大分', x: 23, y: 72 }, { name: '佐賀', x: 17, y: 71 },
    { name: '長崎', x: 14, y: 72 }, { name: '福岡', x: 20, y: 69 }, { name: '山口', x: 25, y: 67 },
    { name: '島根', x: 28, y: 64 }, { name: '広島', x: 29, y: 67 }, { name: '鳥取', x: 33, y: 64 },
    { name: '岡山', x: 34, y: 67 }, { name: '兵庫', x: 38, y: 66 }, { name: '京都', x: 41, y: 63 },
    { name: '大阪', x: 41, y: 68 }, { name: '奈良', x: 43, y: 69 }, { name: '和歌山', x: 42, y: 74 },
    { name: '滋賀', x: 43, y: 64 }, { name: '三重', x: 45, y: 68 }, { name: '徳島', x: 38, y: 71 },
    { name: '香川', x: 36, y: 70 }, { name: '愛媛', x: 32, y: 72 }, { name: '高知', x: 33, y: 75 },
    { name: '愛知', x: 48, y: 67 }, { name: '岐阜', x: 49, y: 63 }, { name: '静岡', x: 54, y: 68 },
    { name: '福井', x: 46, y: 61 }, { name: '石川', x: 48, y: 56 }, { name: '富山', x: 52, y: 56 },
    { name: '長野', x: 54, y: 60 }, { name: '山梨', x: 58, y: 64 }, { name: '神奈川', x: 61, y: 68 },
    { name: '東京', x: 63, y: 65 }, { name: '埼玉', x: 62, y: 61 }, { name: '千葉', x: 67, y: 67 },
    { name: '茨城', x: 68, y: 60 }, { name: '栃木', x: 66, y: 57 }, { name: '群馬', x: 62, y: 57 },
    { name: '新潟', x: 60, y: 51 }, { name: '福島', x: 68, y: 52 }, { name: '山形', x: 69, y: 47 },
    { name: '宮城', x: 73, y: 47 }, { name: '秋田', x: 70, y: 42 }, { name: '岩手', x: 75, y: 41 },
    { name: '青森', x: 74, y: 36 }, { name: '北海道', x: 85, y: 20 }
  ];

  const areas = prefectureData.map((p, i) => ({
    name: p.name,
    order: i + 1,
    difficulty: Math.floor(i / 5) + 1,
    boss_name: `${p.name}のドン`,
    x: p.x,
    y: p.y
  }));

  await knex('areas').insert(areas);

  // Fetch areas to get IDs
  const allAreas = await knex('areas').select('id', 'order', 'name');

  // Insert initial player
  await knex('players').insert([
    {
      name: 'ぶっちぎり太郎',
      guts: 100, max_guts: 100,
      kiai: 50, max_kiai: 50,
      menchi: 1000,
      current_area_id: allAreas.find(a => a.order === 1).id,
      current_square: 1
    }
  ]);

  // Insert rivals for each area
  const rivalsData = [];
  allAreas.forEach(area => {
    rivalsData.push({
      name: `${area.name}の不良`,
      area_id: area.id,
      guts: 20 + area.order * 5,
      strength: 5 + area.order,
      speed: 5 + area.order,
      menchi_reward: 100 + area.order * 20,
      exp_reward: 10 + area.order,
      is_boss: false
    });
    // Boss for each area
    rivalsData.push({
      name: `${area.name}のドン`,
      area_id: area.id,
      guts: 50 + area.order * 10,
      strength: 10 + area.order * 2,
      speed: 8 + area.order,
      menchi_reward: 500 + area.order * 50,
      exp_reward: 50 + area.order * 2,
      is_boss: true
    });
  });

  await knex('rivals').insert(rivalsData);
};

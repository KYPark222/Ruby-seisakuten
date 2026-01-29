/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('rivals').del();
  await knex('players').del();
  await knex('areas').del();

  // Insert areas
  const areas = await knex('areas').insert([
    { name: '福岡 (武覇血斬高校)', order: 1, difficulty: 1, boss_name: '地元の番長' },
    { name: '広島', order: 2, difficulty: 2, boss_name: '安芸の鬼瓦' },
    { name: '大阪', order: 3, difficulty: 3, boss_name: '道頓堀の龍' },
    { name: '沖縄', order: 4, difficulty: 4, boss_name: 'シーサー・キング' },
    { name: '北海道', order: 5, difficulty: 5, boss_name: '最北の帝王' },
    { name: '東京 (国会議事堂高校)', order: 6, difficulty: 10, boss_name: '伝説の頂点' }
  ]);

  // Fetch areas to get IDs
  const allAreas = await knex('areas').select('id', 'order');
  const getAreaId = (order) => allAreas.find(a => a.order === order).id;

  // Insert initial player
  await knex('players').insert([
    {
      name: 'ぶっちぎり太郎',
      guts: 100, max_guts: 100,
      kiai: 50, max_kiai: 50,
      menchi: 1000,
      current_area_id: getAreaId(1),
      current_square: 0
    }
  ]);

  // Insert rivals for each area
  const rivalsData = [];

  // Fukuoka
  rivalsData.push(
    { name: '駅前のチンピラ', area_id: getAreaId(1), guts: 30, strength: 5, speed: 5, menchi_reward: 100, exp_reward: 10, is_boss: false },
    { name: 'コンビニのガキ', area_id: getAreaId(1), guts: 20, strength: 3, speed: 8, menchi_reward: 50, exp_reward: 5, is_boss: false },
    { name: '地元の番長', area_id: getAreaId(1), guts: 80, strength: 12, speed: 6, menchi_reward: 500, exp_reward: 50, is_boss: true }
  );

  // Hiroshima
  rivalsData.push(
    { name: 'もみじまんじゅう野郎', area_id: getAreaId(2), guts: 50, strength: 10, speed: 8, menchi_reward: 200, exp_reward: 20, is_boss: false },
    { name: '安芸の鬼瓦', area_id: getAreaId(2), guts: 120, strength: 18, speed: 10, menchi_reward: 1000, exp_reward: 100, is_boss: true }
  );

  // Osaka
  rivalsData.push(
    { name: '食い倒れヤンキー', area_id: getAreaId(3), guts: 80, strength: 15, speed: 12, menchi_reward: 400, exp_reward: 40, is_boss: false },
    { name: '道頓堀の龍', area_id: getAreaId(3), guts: 200, strength: 25, speed: 15, menchi_reward: 2000, exp_reward: 200, is_boss: true }
  );

  // Okinawa
  rivalsData.push(
    { name: 'ゴーヤチャンプルー番長', area_id: getAreaId(4), guts: 120, strength: 20, speed: 18, menchi_reward: 600, exp_reward: 60, is_boss: false },
    { name: 'シーサー・キング', area_id: getAreaId(4), guts: 300, strength: 35, speed: 20, menchi_reward: 3000, exp_reward: 300, is_boss: true }
  );

  // Hokkaido
  rivalsData.push(
    { name: '極寒の狂犬', area_id: getAreaId(5), guts: 180, strength: 28, speed: 22, menchi_reward: 800, exp_reward: 80, is_boss: false },
    { name: '最北の帝王', area_id: getAreaId(5), guts: 450, strength: 45, speed: 25, menchi_reward: 5000, exp_reward: 500, is_boss: true }
  );

  // Tokyo
  rivalsData.push(
    { name: 'エリート番長', area_id: getAreaId(6), guts: 250, strength: 40, speed: 30, menchi_reward: 1200, exp_reward: 120, is_boss: false },
    { name: '伝説の頂点', area_id: getAreaId(6), guts: 1000, strength: 80, speed: 50, menchi_reward: 10000, exp_reward: 1000, is_boss: true }
  );

  await knex('rivals').insert(rivalsData);
};

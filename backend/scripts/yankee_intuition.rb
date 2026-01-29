require 'json'

def predict_battle(data)
  player_hp = data['player_hp'].to_i
  player_atk = data['player_atk'].to_i
  enemy_hp = data['enemy_hp'].to_i
  enemy_atk = data['enemy_atk'].to_i

  # 簡易的なターンシミュレーション (Simple turn simulation)
  # 100回シミュレートして勝率を計算 (Simulate 100 times to calculate win rate)
  wins = 0
  100.times do
    p_hp = player_hp
    e_hp = enemy_hp
    
    while p_hp > 0 && e_hp > 0
      # プレイヤーの攻撃 (Player attacks) - 乱数要素あり
      damage_to_enemy = [1, player_atk + rand(-2..2)].max
      e_hp -= damage_to_enemy
      break if e_hp <= 0
      
      # 敵の攻撃 (Enemy attacks) - 乱数要素あり
      damage_to_player = [1, enemy_atk + rand(-2..2)].max
      p_hp -= damage_to_player
    end
    wins += 1 if p_hp > 0
  end

  win_rate = wins
  
  # ヤンキーらしいアドバイス (Yankee-style advice)
  advice = case win_rate
           when 80..100
             "余裕だろ、これ。一発ブチかましてこい！"
           when 50..79
             "五分五分ってとこか…。気合で押し切るしかねぇな！"
           when 20..49
             "ちっと厳しいかもな…。だが、折れなきゃ勝機はあるぜ！"
           else
             "マジかよ、勝てる気しねぇぞ…。特攻する覚悟はできてるか？"
           end

  {
    win_rate: win_rate,
    advice: advice,
    engine: "Ruby #{RUBY_VERSION}"
  }
end

# メイン処理 (Main process)
input_data = JSON.parse(ARGV[0])
result = predict_battle(input_data)
puts result.to_json

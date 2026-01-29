/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .createTable('areas', table => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.integer('order').notNullable().unique(); // 1: 福岡, 2: 広島, etc.
            table.integer('difficulty').notNullable();
            table.string('boss_name');
        })
        .createTable('players', table => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.integer('guts').defaultTo(100);       // HP
            table.integer('max_guts').defaultTo(100);
            table.integer('kiai').defaultTo(50);        // MP
            table.integer('max_kiai').defaultTo(50);
            table.integer('menchi').defaultTo(1000);     // Money
            table.integer('strength').defaultTo(10);
            table.integer('speed').defaultTo(10);
            table.integer('level').defaultTo(1);
            table.integer('experience').defaultTo(0);
            table.integer('current_area_id').references('id').inTable('areas');
            table.integer('current_square').defaultTo(0);
            table.timestamps(true, true);
        })
        .createTable('rivals', table => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.integer('area_id').references('id').inTable('areas');
            table.integer('guts').notNullable();
            table.integer('strength').notNullable();
            table.integer('speed').notNullable();
            table.integer('menchi_reward').notNullable();
            table.integer('exp_reward').notNullable();
            table.boolean('is_boss').defaultTo(false);
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('rivals')
        .dropTableIfExists('players')
        .dropTableIfExists('areas');
};

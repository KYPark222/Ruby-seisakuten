/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('active_battles', table => {
        table.increments('id').primary();
        table.integer('player_id').references('id').inTable('players');
        table.integer('rival_id').references('id').inTable('rivals');
        table.integer('rival_current_guts').notNullable();
        table.integer('turn').defaultTo(1);
        table.string('status').defaultTo('active');
        table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('active_battles');
};

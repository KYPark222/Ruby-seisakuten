/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('active_battles', table => {
        table.boolean('player_stunned').defaultTo(false);
        table.boolean('rival_stunned').defaultTo(false);
        table.boolean('boss_boosted').defaultTo(false); // For Tokyo phase shift
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('active_battles', table => {
        table.dropColumn('player_stunned');
        table.dropColumn('rival_stunned');
        table.dropColumn('boss_boosted');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .table('areas', table => {
            table.boolean('boss_defeated').defaultTo(false);
        })
        .table('rivals', table => {
            table.string('defeat_dialogue');
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .table('rivals', table => {
            table.dropColumn('defeat_dialogue');
        })
        .table('areas', table => {
            table.dropColumn('boss_defeated');
        });
};

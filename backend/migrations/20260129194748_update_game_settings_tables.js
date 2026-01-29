/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .table('players', table => {
            table.integer('defense').defaultTo(3);
            table.string('title').defaultTo('博多の無名');
        })
        .table('rivals', table => {
            table.string('school_name');
            table.string('dialogue');
            table.string('gimmick'); // 'first_turn_atk', 'evasion', 'healing', 'kiai_drain', 'phase_shift'
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .table('players', table => {
            table.dropColumn('defense');
            table.dropColumn('title');
        })
        .table('rivals', table => {
            table.dropColumn('school_name');
            table.dropColumn('dialogue');
            table.dropColumn('gimmick');
        });
};

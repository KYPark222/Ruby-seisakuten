/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('areas', function (table) {
        table.string('label_dir').defaultTo('bottom'); // 'top', 'bottom', 'left', 'right'
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('areas', function (table) {
        table.dropColumn('label_dir');
    });
};

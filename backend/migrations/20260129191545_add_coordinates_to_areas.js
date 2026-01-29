/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('areas', table => {
        table.float('x').nullable();
        table.float('y').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('areas', table => {
        table.dropColumn('x');
        table.dropColumn('y');
    });
};

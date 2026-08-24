/**
 * Shared lookup helpers.
 *
 * Six services each carried their own copy of "distinct values, drop the
 * blanks, sort them for a human" — eleven copies of the same three lines,
 * which is how they quietly drifted: some filtered out archived records,
 * some did not.
 *
 * The roster helper matters more. Every module that asks "who is this for?"
 * built its list from names already used INSIDE that module, so a new team
 * member was not pickable as a tender owner until somebody had already made
 * them one. Person pickers now start from the shared roster and add whatever
 * historical names their own records hold, so nobody has to be typed in twice.
 */
const Milestone = require('../models/Milestone');
const TeamMember = require('../models/TeamMember');

/** Sort names the way a person reads them, blanks removed, no duplicates. */
const tidy = (values) =>
  [...new Set(values.flat().map((v) => (v == null ? '' : String(v).trim())))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

exports.tidy = tidy;

/**
 * Distinct values of one field, ignoring archived records unless asked.
 * Pass several [Model, field] pairs to merge across collections.
 */
exports.distinctList = async (pairs, { includeArchived = false } = {}) => {
  const query = includeArchived ? {} : { archived: { $ne: true } };
  const results = await Promise.all(
    pairs.map(([Model, field]) =>
      // Not every collection has an `archived` flag; asking one that does not
      // for `archived: {$ne: true}` still matches everything, so this is safe.
      Model.distinct(field, query)
    )
  );
  return tidy(results);
};

/**
 * Everyone on the team: the shared roster plus anyone registered as a Team
 * Member milestone. This is the same union the header picker shows, so a name
 * set there is immediately pickable everywhere else.
 */
exports.teamRoster = async () => {
  const [registered, everSet] = await Promise.all([
    Milestone.distinct('participantName', { milestoneType: 'Team Member', active: true }),
    TeamMember.distinct('name'),
  ]);
  return tidy([registered, everSet]);
};

/**
 * A person picker's options: the whole team, plus the historical names this
 * module's own records already carry (somebody who has left, or a name typed
 * before the roster existed, should not vanish from a filter).
 */
exports.peopleFor = async (pairs, options) => {
  const [roster, used] = await Promise.all([
    exports.teamRoster(),
    exports.distinctList(pairs, options),
  ]);
  return tidy([roster, used]);
};

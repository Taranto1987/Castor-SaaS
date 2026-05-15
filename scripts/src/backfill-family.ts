// Family info (familySlug / familyName / size) is now computed at API
// response time in mapProduto() via extractFamilyInfo(). No DB backfill needed.
//
// This script is kept as a placeholder in case the columns are later promoted
// to stored columns for performance reasons.
console.log("[backfill-family] No-op: family fields are computed at query time.");
process.exit(0);

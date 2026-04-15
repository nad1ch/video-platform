-- Drop redundant index: `twitchId` is already covered by the unique constraint.
DROP INDEX IF EXISTS "User_twitchId_idx";

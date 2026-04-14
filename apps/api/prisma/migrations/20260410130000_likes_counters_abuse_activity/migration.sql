-- Denormalized like/dislike counters + anti-abuse + reaction history

ALTER TABLE "User" ADD COLUMN "likesSuspendedUntil" TIMESTAMP(3),
ADD COLUMN "commentsSuspendedUntil" TIMESTAMP(3),
ADD COLUMN "lastCommentAt" TIMESTAMP(3),
ADD COLUMN "likeAbuseStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "commentAbuseStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "accountLockedAt" TIMESTAMP(3);

ALTER TABLE "Post" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dislikeCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Comment" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dislikeCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Match" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dislikeCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LikeBurstLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LikeBurstLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LikeBurstLog_userId_createdAt_idx" ON "LikeBurstLog"("userId", "createdAt");

ALTER TABLE "LikeBurstLog" ADD CONSTRAINT "LikeBurstLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommentBurstLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentBurstLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommentBurstLog_userId_createdAt_idx" ON "CommentBurstLog"("userId", "createdAt");

ALTER TABLE "CommentBurstLog" ADD CONSTRAINT "CommentBurstLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserReactionActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserReactionActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserReactionActivity_userId_createdAt_idx" ON "UserReactionActivity"("userId", "createdAt");

ALTER TABLE "UserReactionActivity" ADD CONSTRAINT "UserReactionActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Post" SET "likeCount" = (
  SELECT COUNT(*)::int FROM "PostLike" pl WHERE pl."postId" = "Post"."id" AND pl."type" = 'LIKE'
);
UPDATE "Post" SET "dislikeCount" = (
  SELECT COUNT(*)::int FROM "PostLike" pl WHERE pl."postId" = "Post"."id" AND pl."type" = 'DISLIKE'
);

UPDATE "Comment" SET "likeCount" = (
  SELECT COUNT(*)::int FROM "CommentLike" cl WHERE cl."commentId" = "Comment"."id" AND cl."type" = 'LIKE'
);
UPDATE "Comment" SET "dislikeCount" = (
  SELECT COUNT(*)::int FROM "CommentLike" cl WHERE cl."commentId" = "Comment"."id" AND cl."type" = 'DISLIKE'
);

UPDATE "Match" SET "likeCount" = (
  SELECT COUNT(*)::int FROM "MatchLike" ml WHERE ml."matchId" = "Match"."id" AND ml."type" = 'LIKE'
);
UPDATE "Match" SET "dislikeCount" = (
  SELECT COUNT(*)::int FROM "MatchLike" ml WHERE ml."matchId" = "Match"."id" AND ml."type" = 'DISLIKE'
);

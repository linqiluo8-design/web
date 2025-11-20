/*
  Warnings:

  - Added the required column `membershipCode` to the `MembershipExportRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderNumber` to the `OrderExportRecord` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MembershipExportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "visitorId" TEXT,
    "membershipCode" TEXT NOT NULL,
    "exportDate" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MembershipExportRecord" ("count", "createdAt", "exportDate", "id", "updatedAt", "userId", "visitorId") SELECT "count", "createdAt", "exportDate", "id", "updatedAt", "userId", "visitorId" FROM "MembershipExportRecord";
DROP TABLE "MembershipExportRecord";
ALTER TABLE "new_MembershipExportRecord" RENAME TO "MembershipExportRecord";
CREATE INDEX "MembershipExportRecord_userId_idx" ON "MembershipExportRecord"("userId");
CREATE INDEX "MembershipExportRecord_visitorId_idx" ON "MembershipExportRecord"("visitorId");
CREATE INDEX "MembershipExportRecord_membershipCode_idx" ON "MembershipExportRecord"("membershipCode");
CREATE INDEX "MembershipExportRecord_exportDate_idx" ON "MembershipExportRecord"("exportDate");
CREATE UNIQUE INDEX "MembershipExportRecord_userId_membershipCode_exportDate_key" ON "MembershipExportRecord"("userId", "membershipCode", "exportDate");
CREATE UNIQUE INDEX "MembershipExportRecord_visitorId_membershipCode_exportDate_key" ON "MembershipExportRecord"("visitorId", "membershipCode", "exportDate");
CREATE TABLE "new_OrderExportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "visitorId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "exportDate" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OrderExportRecord" ("count", "createdAt", "exportDate", "id", "updatedAt", "userId", "visitorId") SELECT "count", "createdAt", "exportDate", "id", "updatedAt", "userId", "visitorId" FROM "OrderExportRecord";
DROP TABLE "OrderExportRecord";
ALTER TABLE "new_OrderExportRecord" RENAME TO "OrderExportRecord";
CREATE INDEX "OrderExportRecord_userId_idx" ON "OrderExportRecord"("userId");
CREATE INDEX "OrderExportRecord_visitorId_idx" ON "OrderExportRecord"("visitorId");
CREATE INDEX "OrderExportRecord_orderNumber_idx" ON "OrderExportRecord"("orderNumber");
CREATE INDEX "OrderExportRecord_exportDate_idx" ON "OrderExportRecord"("exportDate");
CREATE UNIQUE INDEX "OrderExportRecord_userId_orderNumber_exportDate_key" ON "OrderExportRecord"("userId", "orderNumber", "exportDate");
CREATE UNIQUE INDEX "OrderExportRecord_visitorId_orderNumber_exportDate_key" ON "OrderExportRecord"("visitorId", "orderNumber", "exportDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

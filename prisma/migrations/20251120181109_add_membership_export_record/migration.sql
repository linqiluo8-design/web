-- CreateTable
CREATE TABLE "MembershipExportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "visitorId" TEXT,
    "exportDate" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MembershipExportRecord_userId_idx" ON "MembershipExportRecord"("userId");

-- CreateIndex
CREATE INDEX "MembershipExportRecord_visitorId_idx" ON "MembershipExportRecord"("visitorId");

-- CreateIndex
CREATE INDEX "MembershipExportRecord_exportDate_idx" ON "MembershipExportRecord"("exportDate");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipExportRecord_userId_exportDate_key" ON "MembershipExportRecord"("userId", "exportDate");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipExportRecord_visitorId_exportDate_key" ON "MembershipExportRecord"("visitorId", "exportDate");

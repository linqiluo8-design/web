-- CreateTable
CREATE TABLE "OrderExportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "visitorId" TEXT,
    "exportDate" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "OrderExportRecord_userId_idx" ON "OrderExportRecord"("userId");

-- CreateIndex
CREATE INDEX "OrderExportRecord_visitorId_idx" ON "OrderExportRecord"("visitorId");

-- CreateIndex
CREATE INDEX "OrderExportRecord_exportDate_idx" ON "OrderExportRecord"("exportDate");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExportRecord_userId_exportDate_key" ON "OrderExportRecord"("userId", "exportDate");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExportRecord_visitorId_exportDate_key" ON "OrderExportRecord"("visitorId", "exportDate");

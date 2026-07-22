import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mobileBundle = readFileSync(new URL("../mobile/assets/app.js", import.meta.url), "utf8");
const syncService = readFileSync(new URL("../src/lib/services/mobileSyncService.ts", import.meta.url), "utf8");
const stockService = readFileSync(new URL("../src/lib/services/stockService.ts", import.meta.url), "utf8");
const mobileSyncRoute = readFileSync(new URL("../src/app/api/mobile/sync/route.ts", import.meta.url), "utf8");
const trashPage = readFileSync(new URL("../src/app/dashboard/patients/trash/page.tsx", import.meta.url), "utf8");
const trashService = readFileSync(new URL("../src/lib/services/trashService.ts", import.meta.url), "utf8");

test("stock movement retries check the movement table and restored offers verify existence", () => {
  assert.match(syncService, /tx\.stockMovement\.findFirst\(\{ where: \{ id: existingId, organizationId, branchId \}/);
  assert.doesNotMatch(syncService, /entityType === "STOCK_MOVEMENT"[\s\S]{0,300}tx\.stockOffer\.findFirst/);
  assert.match(syncService, /existingId && await tx\.stockOffer\.findFirst/);
});

test("mobile queue never mutates an attempted operation and keeps in-flight deletes ordered", () => {
  assert.match(mobileBundle, /item\.attemptedAt \|\|= attemptedAt/);
  assert.match(mobileBundle, /!item\.attemptedAt && !inFlightOperationIds\.has\(item\.operationId\)/);
  assert.match(mobileBundle, /hasAttemptedCreate/);
  assert.match(mobileBundle, /inFlightOperationIds = new Set\(operations\.map/);
});

test("failed pending changes replace their server twin instead of duplicating it", () => {
  assert.match(mobileBundle, /const mergePending = \(pending, type, serverItems\)/);
  assert.match(mobileBundle, /!pendingServerIds\.has\(String\(item\.serverId\)\)/);
  assert.match(mobileBundle, /state\.patients = mergePending\(pendingPatients, "PATIENT", collections\.PATIENT\)/);
});

test("completed clinical records preserve stock usage across snapshots and restores", () => {
  assert.match(syncService, /treatment\.findMany\([\s\S]*stockMovements/);
  assert.match(mobileBundle, /prepareRestoredClinicalRecords/);
  assert.match(mobileBundle, /safeArray\(payload\.linkedRecipes\)/);
  assert.match(mobileBundle, /queueDelete\("STOCK_ITEM", id\)/);
  assert.doesNotMatch(mobileBundle, /linkedRecipes\.forEach\(\(item\) => queueDelete\("STOCK_RECIPE"/);
});

test("stock trash mutations and their audit records share one transaction", () => {
  assert.match(stockService, /softDeleteStockItem[\s\S]*?return prisma\.\$transaction\(async \(tx\)[\s\S]*?tx\.stockItem\.updateMany[\s\S]*?tx\.auditLog\.create[\s\S]*?SOFT_DELETE_STOCK_ITEM/);
  assert.match(stockService, /restoreStockItem[\s\S]*?return prisma\.\$transaction\(async \(tx\)[\s\S]*?tx\.stockItem\.updateMany[\s\S]*?tx\.auditLog\.create[\s\S]*?RESTORE_STOCK_ITEM/);
  assert.doesNotMatch(stockService, /writeAuditLog/);
});

test("mobile stock delete and restore require trash management and write idempotent transactional audits", () => {
  assert.match(syncService, /operation\.action === "DELETE"\) \{\s*if \(!canManageTrash\(session\.role\)\)/);
  assert.match(syncService, /if \(restore && !canManageTrash\(session\.role\)\)/);
  assert.match(syncService, /tx\.auditLog\.create\([\s\S]*?SOFT_DELETE_STOCK_ITEM/);
  assert.match(syncService, /if \(restore\) \{\s*await tx\.auditLog\.create\([\s\S]*?RESTORE_STOCK_ITEM/);
  assert.match(syncService, /if \(existing\) \{\s*if \(existing\.payloadHash !== hash\)[\s\S]*?return existing\.serverEntityId/);
  assert.match(mobileSyncRoute, /item\.entityType === "STOCK_ITEM" && item\.action === "DELETE" && !canManageTrash\(session\.role\)/);
});

test("stock trash uses reachable deterministic pages instead of a silent fixed cap", () => {
  assert.match(stockService, /skip: \(page - 1\) \* pageSize/);
  assert.match(stockService, /take: pageSize/);
  assert.match(stockService, /orderBy: \[\{ deletedAt: "desc" \}, \{ id: "desc" \}\]/);
  assert.doesNotMatch(stockService, /take: 200/);
  assert.match(trashPage, /stockPage=\$\{stockTrash\.page - 1\}/);
  assert.match(trashPage, /stockPage=\$\{stockTrash\.page \+ 1\}/);
  assert.match(trashPage, /Sayfa \{stockTrash\.page\} \/ \{stockTrash\.totalPages\}/);
});

test("retired survey and recall modules cannot mutate or leak through mobile sync", () => {
  assert.match(mobileSyncRoute, /\["SURVEY", "SURVEY_RESPONSE"\]\.includes\(item\.entityType\).*Anketler modülü kaldırıldı/);
  assert.match(mobileSyncRoute, /item\.entityType === "RECALL".*Recall modülü kaldırıldı/);
  assert.match(syncService, /\["SURVEY", "SURVEY_RESPONSE", "RECALL"\]\.includes\(operation\.entityType\)/);
  assert.doesNotMatch(syncService, /prisma\.(?:survey|surveyResponse|recall)\.findMany/);
  assert.doesNotMatch(syncService, /surveys: surveys\.map|surveyResponses: surveyResponses\.map|recalls: recalls\.map/);
});

test("mobile managers receive branch-scoped deleted stocks and trash permission", () => {
  assert.match(syncService, /permissions:[\s\S]*trash: canManageTrash\(session\.role\)/);
  assert.match(syncService, /deletedAt: \{ not: null \}, purgeAt: \{ gt: now \}, \.\.\.branch/);
  assert.match(syncService, /deletedStockItems: deletedStocks\.map/);
  assert.match(syncService, /\.\.\.deletedStocks\.map\(\(item\) => \["STOCK_ITEM", item\.id\]\)/);
});

test("expired stock purge and immutable audit are committed atomically", () => {
  assert.match(trashService, /for \(const item of expiredStockItems\)[\s\S]*?prisma\.\$transaction\(async \(tx\)/);
  assert.match(trashService, /tx\.auditLog\.create[\s\S]*?PURGE_STOCK_ITEM[\s\S]*?tx\.stockItem\.deleteMany/);
});

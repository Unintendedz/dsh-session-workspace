// src/migration.js
import { randomUUID as nodeRandomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, link, mkdir, open, readFile, readdir, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { constants as zlibConstants, zstdCompress, zstdDecompress } from "node:zlib";
var zstdCompressAsync = promisify(zstdCompress);
var zstdDecompressAsync = promisify(zstdDecompress);
var checksumOptions = {
  params: { [zlibConstants.ZSTD_c_checksumFlag]: 1 }
};
var movingSessions = /* @__PURE__ */ new Set();
var WorkspaceMoveError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkspaceMoveError";
    this.code = code;
  }
};
function fail(code, message) {
  throw new WorkspaceMoveError(code, message);
}
function newlineAt(content) {
  const at = content.indexOf("\n");
  if (at <= 0) fail("invalid-artifact", "the session artifact has no complete header line");
  return at;
}
function rewriteRawArtifact(content, targetPath) {
  if (typeof content !== "string") fail("invalid-artifact", "the session artifact is not text");
  if (typeof targetPath !== "string" || !isAbsolute(targetPath)) {
    fail("invalid-workspace-path", "the target workspace path must be absolute");
  }
  const at = newlineAt(content);
  let meta;
  try {
    meta = JSON.parse(content.slice(0, at));
  } catch {
    fail("invalid-artifact", "the session artifact header is not valid JSON");
  }
  if (meta === null || typeof meta !== "object" || Array.isArray(meta) || meta.type !== "session" || typeof meta.id !== "string") {
    fail("invalid-artifact", "the session artifact has an invalid session header");
  }
  const next = { ...meta, cwd: targetPath };
  return {
    meta: next,
    content: JSON.stringify(next) + content.slice(at)
  };
}
async function encodeRawArtifact(content, path) {
  if (path.endsWith(".jsonl")) return Buffer.from(content);
  if (!path.endsWith(".jsonl.zstd")) {
    fail("unsupported-persistence", `unsupported session artifact ${JSON.stringify(path)}`);
  }
  const at = newlineAt(content) + 1;
  const [header, body] = await Promise.all([
    zstdCompressAsync(content.slice(0, at), checksumOptions),
    zstdCompressAsync(content.slice(at), checksumOptions)
  ]);
  return Buffer.concat([header, body]);
}
async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
function sameRevision(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeNs === right.mtimeNs;
}
async function syncedWrite(path, content) {
  const handle = await open(path, "wx", 384);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncDirectory(path) {
  if (process.platform === "win32") return;
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncFile(path) {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function removeIfPresent(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
function defaultBackupRoot(source) {
  const sessionRoot = dirname(dirname(dirname(source)));
  return join(dirname(sessionRoot), "session-workspace-backups");
}
function assertPayload(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    fail("bad-request", "move payload must be an object");
  }
  const keys = Object.keys(payload);
  if (keys.some((key) => key !== "sessionId" && key !== "workspaceId" && key !== "position")) {
    fail("bad-request", "move payload contains an unknown field");
  }
  if (typeof payload.sessionId !== "string" || payload.sessionId.trim() === "") {
    fail("bad-request", "sessionId must be a non-empty string");
  }
  if (typeof payload.workspaceId !== "string" || payload.workspaceId.trim() === "") {
    fail("bad-request", "workspaceId must be a non-empty string");
  }
  if (payload.position !== void 0) {
    const position = payload.position;
    if (position === null || typeof position !== "object" || Array.isArray(position) || Object.keys(position).some((key) => key !== "anchorSessionId" && key !== "side")) {
      fail("bad-request", "position must contain only anchorSessionId and side");
    }
    if (typeof position.anchorSessionId !== "string" || position.anchorSessionId.trim() === "") {
      fail("bad-request", "position.anchorSessionId must be a non-empty string");
    }
    if (position.side !== "before" && position.side !== "after") {
      fail("bad-request", "position.side must be before or after");
    }
  }
}
function targetInsertionAnchor(target, sessionId, position) {
  if (position === void 0) return void 0;
  const targetSessionIds = target.sessionIds;
  const anchorIndex = targetSessionIds.indexOf(position.anchorSessionId);
  if (anchorIndex === -1 || position.anchorSessionId === sessionId) {
    fail("workspace-anchor-not-found", `anchor session ${JSON.stringify(position.anchorSessionId)} is not a member of the target workspace`);
  }
  return position.side === "before" ? position.anchorSessionId : targetSessionIds[anchorIndex + 1];
}
function workspaceAccounts(workspaces, sessionId) {
  return workspaces.flatMap((workspace) => {
    const sessionIds = workspace.sessionIds;
    const index = sessionIds.indexOf(sessionId);
    return index === -1 ? [] : [{
      workspaceId: workspace.id,
      beforeSessionId: sessionIds[index + 1]
    }];
  });
}
async function refreshWorkspaceHeaders(ctx) {
  const refresh = ctx.workspaceRegistry.replaceHeaderIndex;
  if (typeof refresh !== "function") {
    fail("unsupported-dsh-version", "this DSH build does not expose the workspace header refresh used by the plugin");
  }
  const snapshots = await ctx.sessionPersistence.list();
  await refresh.call(ctx.workspaceRegistry, snapshots.map((row) => row.header ?? row));
}
function supportsNativeWorkspaceMove(persistence) {
  const format = persistence.generationFormat;
  return (format?.currentVersion === 3 && typeof format.createRestore === "function" || format?.currentVersion === 4) && typeof persistence.open === "function" && typeof persistence.locate === "function" && typeof persistence.acquireWriteLease === "function";
}
async function validateCurrentArtifact(persistence, content) {
  const lines = content.trimEnd().split("\n");
  const header = JSON.parse(lines.shift());
  let restore;
  if (persistence.generationFormat.currentVersion === 3) {
    restore = persistence.generationFormat.createRestore(header);
  } else {
    const { sessionFormatCatalog } = await import("@deepseek-ai/dsh-session-format-catalog");
    if (sessionFormatCatalog.currentVersion !== 4) {
      fail("unsupported-dsh-version", "the installed Session catalog does not match the V4 persistence backend");
    }
    restore = sessionFormatCatalog.createRestore(header, { recovery: "strict", validation: "current" });
  }
  for (const line of lines) restore.decodeRow(JSON.parse(line));
  restore.finish();
}
async function generationFiles(directory) {
  try {
    return (await readdir(directory)).filter((name2) => /^session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/.test(name2)).sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}
async function decodeArtifact(raw, path) {
  if (!path.endsWith(".zstd")) return raw.toString("utf8");
  const chunks = [];
  let offset = 0;
  while (offset < raw.length) {
    const decoded = await zstdDecompressAsync(raw.subarray(offset), { info: true });
    const consumed = decoded.engine.bytesWritten;
    if (!Number.isSafeInteger(consumed) || consumed <= 0 || consumed > raw.length - offset) {
      fail("invalid-artifact", "the compressed session frame did not decode completely");
    }
    chunks.push(decoded.buffer);
    offset += consumed;
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function moveNativeSession(ctx, sessionId, target, workspaces, originalWorkspaceAccounts, position, beforeSessionId, options) {
  const persistence = ctx.sessionPersistence;
  let handle, destinationLease, temporary;
  const moved = [];
  let destination, published = false, sourceDirectory;
  try {
    try {
      handle = await persistence.open(sessionId, "write");
    } catch (error) {
      if (error?.name === "SessionAlreadyOwnedError") fail("session-active", error.message);
      throw error;
    }
    const header = handle.header;
    if (header.id !== sessionId) fail("invalid-artifact", "the stored session id does not match the requested id");
    const sourceLocation = persistence.locate(header);
    if (sourceLocation?.kind !== "jsonl" || typeof sourceLocation.path !== "string") {
      fail("unsupported-persistence", "session workspace moves require the JSONL persistence backend");
    }
    const source = sourceLocation.path;
    sourceDirectory = dirname(source);
    const names = await generationFiles(sourceDirectory);
    const revisions = /* @__PURE__ */ new Map();
    for (const name2 of names) revisions.set(name2, await stat(join(sourceDirectory, name2), { bigint: true }));
    const raw = await readFile(source);
    const content = await decodeArtifact(raw, source);
    const rewritten = rewriteRawArtifact(content, target.path);
    if (rewritten.meta.id !== sessionId || JSON.parse(content.slice(0, newlineAt(content))).cwd !== header.cwd) {
      fail("source-changed", "the stored header changed while preparing the move");
    }
    if (!rewritten.content.endsWith("\n")) fail("invalid-artifact", "the session artifact has an incomplete final line");
    await validateCurrentArtifact(persistence, rewritten.content);
    const destinationLocation = persistence.locate({ ...header, cwd: target.path });
    if (destinationLocation?.kind !== "jsonl" || typeof destinationLocation.path !== "string") {
      fail("unsupported-persistence", "the target session artifact cannot be located");
    }
    destination = destinationLocation.path;
    if (source === destination) fail("same-workspace", "the target workspace resolves to the current session location");
    const assertDestinationEmpty = async () => {
      if ((await generationFiles(dirname(destination))).length > 0) {
        fail("destination-exists", "refusing to overwrite an existing destination session generation");
      }
    };
    await assertDestinationEmpty();
    destinationLease = await persistence.acquireWriteLease({ ...header, cwd: target.path });
    await assertDestinationEmpty();
    const jobId = (options.randomUUID ?? nodeRandomUUID)();
    const backupDirectory = join(options.backupRoot ?? defaultBackupRoot(source), jobId);
    await mkdir(backupDirectory, { recursive: true, mode: 448 });
    for (const name2 of names) {
      const backup = join(backupDirectory, name2);
      await copyFile(join(sourceDirectory, name2), backup, fsConstants.COPYFILE_EXCL);
      await syncFile(backup);
    }
    await syncDirectory(backupDirectory);
    await syncDirectory(dirname(backupDirectory));
    await syncDirectory(dirname(dirname(backupDirectory)));
    temporary = join(dirname(destination), `.session-workspace-${jobId}.tmp`);
    await syncedWrite(temporary, await encodeRawArtifact(rewritten.content, destination));
    const currentNames = await generationFiles(sourceDirectory);
    if (JSON.stringify(currentNames) !== JSON.stringify(names)) fail("source-changed", "session generations changed while preparing the move");
    for (const name2 of names) {
      if (!sameRevision(revisions.get(name2), await stat(join(sourceDirectory, name2), { bigint: true }))) {
        fail("source-changed", "a session generation changed while preparing the move");
      }
    }
    if (ctx.sessions.get(sessionId) !== void 0 || ctx.agents.get(sessionId) !== void 0) {
      fail("session-active", "the session became active while preparing the move");
    }
    try {
      for (const name2 of names) {
        const original = join(sourceDirectory, name2);
        const tombstone = join(sourceDirectory, `.dsh-moving-${jobId}-${name2}`);
        await rename(original, tombstone);
        moved.push({ original, tombstone });
      }
      await link(temporary, destination);
      published = true;
      await removeIfPresent(temporary);
      temporary = void 0;
      await syncDirectory(sourceDirectory);
      await syncDirectory(dirname(destination));
      await refreshWorkspaceHeaders(ctx);
      for (const workspace of workspaces) {
        if (workspace.id !== target.id) await workspace.detachSession(sessionId);
      }
      await target.attachSession(sessionId);
      if (position !== void 0) await target.insertSessionBefore(sessionId, beforeSessionId);
    } catch (error) {
      const failures = [error];
      try {
        if (published) await removeIfPresent(destination);
        for (const item of moved.toReversed()) await rename(item.tombstone, item.original);
        await syncDirectory(sourceDirectory);
        await syncDirectory(dirname(destination));
      } catch (rollbackError) {
        failures.push(rollbackError);
      }
      try {
        await refreshWorkspaceHeaders(ctx);
        await restoreWorkspaceAccounts(ctx, sessionId, originalWorkspaceAccounts);
      } catch (rollbackError) {
        failures.push(rollbackError);
      }
      if (failures.length > 1) throw new AggregateError(failures, `session move failed and rollback was incomplete: ${String(error)}`);
      throw error;
    }
    for (const item of moved) await removeIfPresent(item.tombstone);
    await syncDirectory(sourceDirectory);
    return { sessionId, workspaceId: target.id, path: target.path, backupPath: join(backupDirectory, basename(source)) };
  } finally {
    try {
      if (temporary !== void 0) await removeIfPresent(temporary);
    } finally {
      try {
        await handle?.close();
      } finally {
        await destinationLease?.release();
      }
    }
  }
}
async function restoreWorkspaceAccounts(ctx, sessionId, originalWorkspaceAccounts) {
  const original = new Set(originalWorkspaceAccounts.map((account) => account.workspaceId));
  for (const workspace of ctx.workspaceRegistry.list()) {
    if (!original.has(workspace.id)) await workspace.detachSession(sessionId);
  }
  const workspaces = ctx.workspaceRegistry.list();
  for (const account of originalWorkspaceAccounts) {
    const workspace = workspaces.find((candidate) => candidate.id === account.workspaceId);
    if (workspace === void 0) {
      fail("workspace-not-found", `workspace ${JSON.stringify(account.workspaceId)} disappeared during rollback`);
    }
    await workspace.attachSession(sessionId);
    await workspace.insertSessionBefore(sessionId, account.beforeSessionId);
  }
}
async function rollbackPhysicalMove({ source, destination, tombstone, rollbackFile }) {
  if (await pathExists(destination)) await rename(destination, rollbackFile);
  if (await pathExists(tombstone)) await rename(tombstone, source);
  await removeIfPresent(rollbackFile);
  await syncDirectory(dirname(source));
  await syncDirectory(dirname(destination));
}
async function moveSessionWorkspace(ctx, payload, options = {}) {
  assertPayload(payload);
  const { sessionId, workspaceId } = payload;
  if (movingSessions.has(sessionId)) fail("move-in-progress", `session ${JSON.stringify(sessionId)} is already moving`);
  movingSessions.add(sessionId);
  let temporary;
  try {
    if (ctx.sessions.get(sessionId) !== void 0 || ctx.agents.get(sessionId) !== void 0) {
      fail("session-active", `session ${JSON.stringify(sessionId)} is active; close it before moving it`);
    }
    const target = ctx.workspaceRegistry.get(workspaceId);
    if (target === void 0) fail("workspace-not-found", `workspace ${JSON.stringify(workspaceId)} was not found`);
    if (typeof ctx.workspaceRegistry.replaceHeaderIndex !== "function") {
      fail("unsupported-dsh-version", "this DSH build does not expose the workspace header refresh used by the plugin");
    }
    const workspaces = ctx.workspaceRegistry.list();
    const originalWorkspaceAccounts = workspaceAccounts(workspaces, sessionId);
    const position = payload.position;
    if (originalWorkspaceAccounts.some((account) => account.workspaceId === target.id)) {
      fail("same-workspace", `session ${JSON.stringify(sessionId)} already belongs to ${JSON.stringify(target.title)}`);
    }
    const beforeSessionId = targetInsertionAnchor(target, sessionId, position);
    if (position !== void 0 && typeof target.insertSessionBefore !== "function") {
      fail("unsupported-dsh-version", "this DSH build does not expose durable workspace session ordering");
    }
    if (supportsNativeWorkspaceMove(ctx.sessionPersistence)) {
      return await moveNativeSession(ctx, sessionId, target, workspaces, originalWorkspaceAccounts, position, beforeSessionId, options);
    }
    if (!ctx.sessionPersistence.supportsRawArtifacts || typeof ctx.sessionPersistence.readRaw !== "function") {
      fail("unsupported-persistence", "session workspace moves require per-session JSONL artifacts");
    }
    const inspection = await ctx.sessionPersistence.load(sessionId);
    if (inspection.meta.id !== sessionId) fail("invalid-artifact", "the stored session id does not match the requested id");
    const sourceLocation = ctx.sessionPersistence.locate(inspection.meta);
    if (sourceLocation?.kind !== "jsonl" || typeof sourceLocation.path !== "string") {
      fail("unsupported-persistence", "session workspace moves require the JSONL persistence backend");
    }
    const source = sourceLocation.path;
    const before = await stat(source, { bigint: true });
    const artifact = await ctx.sessionPersistence.readRaw(sessionId);
    if (artifact === void 0) fail("session-not-found", `session ${JSON.stringify(sessionId)} was not found`);
    if (artifact.meta.id !== sessionId || artifact.meta.cwd !== inspection.meta.cwd) {
      fail("source-changed", `session ${JSON.stringify(sessionId)} changed while its snapshot was read`);
    }
    const afterRead = await stat(source, { bigint: true });
    if (!sameRevision(before, afterRead)) {
      fail("source-changed", `session ${JSON.stringify(sessionId)} changed while its snapshot was read`);
    }
    const rewritten = rewriteRawArtifact(artifact.content, target.path);
    const destinationLocation = ctx.sessionPersistence.locate(rewritten.meta);
    if (destinationLocation?.kind !== "jsonl" || typeof destinationLocation.path !== "string") {
      fail("unsupported-persistence", "the target session artifact cannot be located");
    }
    const destination = destinationLocation.path;
    if (source === destination) fail("same-workspace", "the target workspace resolves to the current session location");
    if (await pathExists(destination)) {
      fail("destination-exists", `refusing to overwrite existing artifact ${JSON.stringify(destination)}`);
    }
    const encoded = await encodeRawArtifact(rewritten.content, destination);
    const jobId = (options.randomUUID ?? nodeRandomUUID)();
    const backupRoot = options.backupRoot ?? defaultBackupRoot(source);
    const backupDirectory = join(backupRoot, jobId);
    const backupPath = join(backupDirectory, destination.endsWith(".zstd") ? "session.jsonl.zstd" : "session.jsonl");
    await mkdir(backupDirectory, { recursive: true, mode: 448 });
    await copyFile(source, backupPath, fsConstants.COPYFILE_EXCL);
    await syncFile(backupPath);
    await syncDirectory(backupDirectory);
    await syncDirectory(dirname(backupDirectory));
    await syncDirectory(dirname(dirname(backupDirectory)));
    await mkdir(dirname(destination), { recursive: true, mode: 448 });
    temporary = join(dirname(destination), `.session-workspace-${jobId}.tmp`);
    await syncedWrite(temporary, encoded);
    const afterBackup = await stat(source, { bigint: true });
    if (!sameRevision(before, afterBackup)) {
      fail("source-changed", `session ${JSON.stringify(sessionId)} changed while its move was prepared`);
    }
    if (ctx.sessions.get(sessionId) !== void 0 || ctx.agents.get(sessionId) !== void 0) {
      fail("session-active", `session ${JSON.stringify(sessionId)} became active while its move was prepared`);
    }
    const tombstone = `${source}.moving-${jobId}`;
    const rollbackFile = `${destination}.rollback-${jobId}`;
    await rename(source, tombstone);
    try {
      await rename(temporary, destination);
      temporary = void 0;
      await syncDirectory(dirname(source));
      await syncDirectory(dirname(destination));
    } catch (error) {
      await rename(tombstone, source);
      throw error;
    }
    try {
      await refreshWorkspaceHeaders(ctx);
      for (const workspace of workspaces) {
        if (workspace.id !== target.id) await workspace.detachSession(sessionId);
      }
      await target.attachSession(sessionId);
      if (position !== void 0) await target.insertSessionBefore(sessionId, beforeSessionId);
    } catch (error) {
      const rollbackErrors = [];
      try {
        await rollbackPhysicalMove({ source, destination, tombstone, rollbackFile });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      try {
        await refreshWorkspaceHeaders(ctx);
        await restoreWorkspaceAccounts(ctx, sessionId, originalWorkspaceAccounts);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], `session move failed and rollback was incomplete: ${String(error)}`);
      }
      throw error;
    }
    await removeIfPresent(tombstone);
    await syncDirectory(dirname(source));
    return { sessionId, workspaceId, path: target.path, backupPath };
  } finally {
    if (temporary !== void 0) await removeIfPresent(temporary);
    movingSessions.delete(sessionId);
  }
}

// src/index.js
var name = "dsh-session-workspace";
var inject = ["connection", "webServer", "agents", "sessions", "sessionPersistence", "workspaceRegistry"];
function assertStatePayload(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => key !== "sessionId") || typeof payload.sessionId !== "string" || payload.sessionId.trim() === "") {
    throw new WorkspaceMoveError("bad-request", "state payload requires only a non-empty sessionId");
  }
}
async function sessionWorkspaceState(ctx, payload) {
  assertStatePayload(payload);
  const { sessionId } = payload;
  const live = ctx.sessions.get(sessionId);
  const header = live?.header ?? (await ctx.sessionPersistence.list()).map((row) => row.header ?? row).find((candidate) => candidate.id === sessionId);
  if (header === void 0) {
    throw new WorkspaceMoveError("session-not-found", `session ${JSON.stringify(sessionId)} was not found`);
  }
  const workspaces = ctx.workspaceRegistry.list();
  const current = workspaces.find((workspace) => workspace.sessionIds.includes(sessionId));
  const supported = (supportsNativeWorkspaceMove(ctx.sessionPersistence) || ctx.sessionPersistence.supportsRawArtifacts === true && typeof ctx.sessionPersistence.readRaw === "function") && typeof ctx.workspaceRegistry.replaceHeaderIndex === "function";
  return {
    sessionId,
    currentWorkspaceId: current?.id,
    currentPath: header.cwd,
    active: live !== void 0 || ctx.agents.get(sessionId) !== void 0,
    supported,
    positionSupported: supported && workspaces.every((workspace) => typeof workspace.insertSessionBefore === "function"),
    workspaces: workspaces.map((workspace) => ({
      workspaceId: workspace.id,
      title: workspace.title,
      path: workspace.path
    }))
  };
}
function createRpcHandler(ctx) {
  return async (endpoint, payload) => {
    try {
      if (endpoint !== "state" && endpoint !== "move") {
        throw new WorkspaceMoveError("bad-request", `unknown dsh-session-workspace endpoint ${JSON.stringify(endpoint)}`);
      }
      return {
        ok: true,
        value: endpoint === "state" ? await sessionWorkspaceState(ctx, payload) : await moveSessionWorkspace(ctx, payload)
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: error instanceof WorkspaceMoveError ? error.code : "internal",
          message: error instanceof Error ? error.message : String(error),
          details: {}
        }
      };
    }
  };
}
function apply(ctx) {
  ctx.effect(
    () => typeof ctx.connection.register === "function" ? ctx.connection.register(ctx, "/dsh-session-workspace", createRpcHandler(ctx)) : ctx.connection.rpc.handle("/dsh-session-workspace", createRpcHandler(ctx), { authority: "trusted-host" }),
    "dsh-session-workspace: rpc"
  );
}
export {
  apply,
  createRpcHandler,
  inject,
  name,
  sessionWorkspaceState
};

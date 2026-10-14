window.__ModuleLoader__.load({id:"dsh-session-workspace",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  sessionIdFromElement: () => sessionIdFromElement,
  workspaceDialogModel: () => workspaceDialogModel
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);
var NS = "dsh-session-workspace";
var STYLE_ID = "dsh-session-workspace-style";
var RPC_PATH = "/dsh-session-workspace";
var SESSION_MENU_SLOT = "sidebar.workspaces.session.menu.item";
var MENU_ITEM_ID = `${NS}.move`;
var CROSS_WORKSPACE_TREE_ATTRIBUTE = "data-dsw-cross-workspace-drop-active";
var NATIVE_WORKSPACE_SLOT = "sidebar.workspaces";
var NATIVE_VIEW_PERSIST = "dsh.workspace.view.v5";
var FLAT_SESSION_ORDER_KEY = "__flat_session_order__";
var zh = {
  "menu.move": "\u79FB\u52A8\u5230\u5176\u4ED6\u5DE5\u4F5C\u533A",
  "dialog.title": "\u79FB\u52A8\u4F1A\u8BDD",
  "dialog.help": "\u4F1A\u8BDD ID \u4FDD\u6301\u4E0D\u53D8\uFF1B\u4E4B\u540E\u7684\u6587\u4EF6\u64CD\u4F5C\u4F1A\u4EE5\u65B0\u5DE5\u4F5C\u533A\u4E3A\u6839\u76EE\u5F55\u3002\u539F\u59CB session \u6587\u4EF6\u4F1A\u4FDD\u7559\u4E00\u4EFD\u5907\u4EFD\u3002",
  "dialog.current": "\u5F53\u524D\u5DE5\u4F5C\u533A",
  "dialog.ungrouped": "\u672A\u5206\u7EC4",
  "dialog.target": "\u76EE\u6807\u5DE5\u4F5C\u533A",
  "dialog.cancel": "\u53D6\u6D88",
  "dialog.move": "\u79FB\u52A8",
  "dialog.moving": "\u6B63\u5728\u5B89\u5168\u79FB\u52A8\u2026",
  "dialog.moved": "\u5DF2\u79FB\u52A8\u5230\u201C{title}\u201D\u3002",
  "drag.moved": "\u5DF2\u79FB\u52A8\u5230\u201C{title}\u201D\u3002",
  "reason.session-active": "\u8FD9\u4E2A\u4F1A\u8BDD\u4ECD\u7531 Host Agent \u52A0\u8F7D\uFF0C\u4F46\u5F53\u524D\u540E\u7AEF\u4E0D\u652F\u6301\u5B89\u5168\u79FB\u52A8\u5DF2\u52A0\u8F7D\u4F1A\u8BDD\u3002",
  "reason.session-busy": "\u8FD9\u4E2A\u4F1A\u8BDD\u4ECD\u6709\u6B63\u5728\u8FD0\u884C\u6216\u6392\u961F\u7684\u5DE5\u4F5C\u3002\u8BF7\u7B49\u5B83\u7A7A\u95F2\u540E\u518D\u79FB\u52A8\uFF1B\u79FB\u52A8\u64CD\u4F5C\u4E0D\u4F1A\u505C\u6B62\u5DE5\u4F5C\u3002",
  "reason.unsupported": "\u5F53\u524D DSH \u7248\u672C\u6216\u6301\u4E45\u5316\u540E\u7AEF\u4E0D\u652F\u6301\u5B89\u5168\u8FC1\u79FB\u3002",
  "reason.no-targets": "\u6CA1\u6709\u5176\u4ED6\u53EF\u7528\u5DE5\u4F5C\u533A\u3002",
  "error.load": "\u65E0\u6CD5\u8BFB\u53D6\u5DE5\u4F5C\u533A\uFF1A{message}",
  "error.move": "\u79FB\u52A8\u5931\u8D25\uFF1A{message}",
  "error.already-moving": "\u8FD9\u4E2A\u4F1A\u8BDD\u5DF2\u6709\u4E00\u4E2A\u79FB\u52A8\u64CD\u4F5C\u6B63\u5728\u8FDB\u884C\u3002",
  "error.order-unavailable": "\u65E0\u6CD5\u8BFB\u53D6\u5B8C\u6574\u7684\u539F\u751F\u4FA7\u680F\u987A\u5E8F\uFF1B\u8FD9\u6B21\u6CA1\u6709\u79FB\u52A8\u4F1A\u8BDD\u3002\u8BF7\u7B49\u4FA7\u680F\u52A0\u8F7D\u5B8C\u6210\u540E\u91CD\u8BD5\u3002",
  "error.order-boundary": "\u539F\u751F\u4FA7\u680F\u56FA\u5B9A\u4E86\u65B0\u4F1A\u8BDD\u548C\u7F6E\u9876\u5206\u533A\uFF0C\u8FD9\u4E2A\u63D2\u5165\u8FB9\u754C\u65E0\u6CD5\u5B9E\u73B0\uFF1B\u4F1A\u8BDD\u6CA1\u6709\u79FB\u52A8\u3002",
  "error.position-unsupported": "\u5F53\u524D\u540E\u7AEF\u4E0D\u652F\u6301\u4F1A\u8BDD\u884C\u95F4\u5B9A\u4F4D\uFF1B\u8BF7\u91CD\u65B0\u52A0\u8F7D\u672C\u63D2\u4EF6\u540E\u91CD\u8BD5\uFF0C\u6216\u62D6\u5230\u5DE5\u4F5C\u533A\u6807\u9898/\u7559\u767D\u5904\u79FB\u52A8\u3002",
  "error.order-save": "\u4F1A\u8BDD\u5DF2\u79FB\u52A8\uFF0C\u4F46\u65E0\u6CD5\u4FDD\u5B58\u4FA7\u680F\u63D2\u5165\u4F4D\u7F6E\uFF1A{message}",
  "error.view-unavailable": "\u65E0\u6CD5\u6838\u5B9E\u6216\u91CA\u653E\u5F53\u524D\u4F1A\u8BDD\u89C6\u56FE\uFF1B\u672A\u53D1\u9001\u79FB\u52A8\u8BF7\u6C42\u3002",
  "error.view-release": "\u5F53\u524D\u4F1A\u8BDD\u4ECD\u88AB\u5176\u4ED6\u7EC4\u4EF6\u4FDD\u7559\uFF0C\u672A\u53D1\u9001\u79FB\u52A8\u8BF7\u6C42\u3002",
  "error.view-release-restore": "\u65E0\u6CD5\u51C6\u5907\u5F53\u524D\u4F1A\u8BDD\u89C6\u56FE\uFF1A{message}\uFF1B\u6062\u590D\u539F\u4F1A\u8BDD\u4E5F\u5931\u8D25\uFF1A{restoreMessage}\u3002\u672A\u53D1\u9001\u79FB\u52A8\u8BF7\u6C42\u3002",
  "error.move-restore": "\u79FB\u52A8\u5931\u8D25\uFF1A{moveMessage}\uFF1B\u5E76\u4E14\u65E0\u6CD5\u6062\u590D\u539F\u4F1A\u8BDD\u89C6\u56FE\uFF1A{restoreMessage}",
  "error.view-restore": "\u4F1A\u8BDD\u5DF2\u79FB\u52A8\uFF0C\u4F46\u65E0\u6CD5\u5237\u65B0\u5E76\u91CD\u65B0\u6253\u5F00\u539F\u4F1A\u8BDD\uFF1A{message}"
};
var en = {
  "menu.move": "Move to another workspace",
  "dialog.title": "Move session",
  "dialog.help": "The session ID stays the same. Future file operations use the new workspace, and the original session artifact is backed up.",
  "dialog.current": "Current workspace",
  "dialog.ungrouped": "Ungrouped",
  "dialog.target": "Target workspace",
  "dialog.cancel": "Cancel",
  "dialog.move": "Move",
  "dialog.moving": "Moving safely\u2026",
  "dialog.moved": "Moved to \u201C{title}\u201D.",
  "drag.moved": "Moved to \u201C{title}\u201D.",
  "reason.session-active": "This session still has a loaded Host Agent, and the current backend cannot safely move loaded sessions.",
  "reason.session-busy": "This session has running or queued work. Wait until it is idle; moving will not stop that work.",
  "reason.unsupported": "This DSH version or persistence backend cannot move sessions safely.",
  "reason.no-targets": "No other workspace is available.",
  "error.load": "Could not load workspaces: {message}",
  "error.move": "Move failed: {message}",
  "error.already-moving": "A move for this session is already in progress.",
  "error.order-unavailable": "The complete native sidebar order is unavailable, so the session was not moved. Wait for the sidebar to finish loading and try again.",
  "error.order-boundary": "The native sidebar keeps new and pinned sessions in fixed sections, so this insertion boundary cannot be honored. The session was not moved.",
  "error.position-unsupported": "The current backend does not support insertion between session rows. Reload this plugin and try again, or drop on the workspace header or empty area to move the session.",
  "error.order-save": "The session moved, but its sidebar position could not be saved: {message}",
  "error.view-unavailable": "The current session view cannot be verified or released; no move was sent.",
  "error.view-release": "Another component still retains this session, so it was not moved.",
  "error.view-release-restore": "Could not prepare the current session view: {message}; restoring the original session also failed: {restoreMessage}. No move was sent.",
  "error.move-restore": "The move failed: {moveMessage}; the original session view could not be restored: {restoreMessage}",
  "error.view-restore": "The session moved, but its view could not be refreshed and reopened: {message}"
};
var inject = ["locale", "connection", "slots", "sessions", "workspaces", "uiWorkspace"];
function workspaceDialogModel(state) {
  const choices = state.workspaces.filter((workspace) => workspace.workspaceId !== state.currentWorkspaceId);
  const reason = state.busy === true ? "session-busy" : state.active === true && state.warmMoveSupported !== true ? "session-active" : !state.supported ? "unsupported" : choices.length === 0 ? "no-targets" : void 0;
  return { canMove: reason === void 0, reason, choices };
}
function sessionIdFromElement(element2) {
  const row = element2?.closest?.('[data-row-key^="session:"]') ?? element2;
  const key = row?.getAttribute?.("data-row-key") ?? row?.dataset?.rowKey;
  if (typeof key !== "string" || !key.startsWith("session:")) return void 0;
  const sessionId = key.slice("session:".length);
  return sessionId.trim() === "" ? void 0 : sessionId;
}
function resultError(result) {
  return result?.ok === false && typeof result.error?.message === "string" ? result.error.message : "unknown error";
}
function sessionIdFromLegacyFiber(element2) {
  const key = Object.getOwnPropertyNames(element2).find((name) => name.startsWith("__reactFiber$"));
  let fiber = key === void 0 ? void 0 : element2[key];
  for (let depth = 0; fiber !== void 0 && fiber !== null && depth < 64; depth += 1) {
    const sessionId = fiber.memoizedProps?.node?.id;
    if (typeof sessionId === "string" && sessionId.trim() !== "") return sessionId;
    fiber = fiber.return;
  }
  return void 0;
}
function element(name, className, text) {
  const node = document.createElement(name);
  if (className !== void 0) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
}
function currentWorkspaceLabel(state, t) {
  return state.workspaces.find((workspace) => workspace.workspaceId === state.currentWorkspaceId)?.title ?? state.currentPath ?? t("dialog.ungrouped");
}
function focusable(dialog) {
  return Array.from(dialog.querySelectorAll("button:not(:disabled), select:not(:disabled)"));
}
function showToast(message, { error = false, duration = 3e3 } = {}) {
  const toast = element("div", "dsw-toast", message);
  toast.setAttribute("role", error ? "alert" : "status");
  toast.dataset.error = String(error);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
function localizedError(t, key, values) {
  const error = new Error(t(key, values));
  error.localUserMessage = true;
  return error;
}
function serviceFromContext(ctx, name) {
  try {
    const service = typeof ctx.get === "function" ? ctx.get(name) : void 0;
    return service ?? ctx[name];
  } catch {
    return ctx[name];
  }
}
function readMainViewState(ctx, sessionId, t) {
  const sessions = serviceFromContext(ctx, "sessions");
  const snapshot = sessions?.list?.getSnapshot?.();
  const summary = snapshot?.byId?.[sessionId];
  const retention = sessions?.retainInfo?.(sessionId)?.getSnapshot?.();
  if (snapshot?.phase !== "ready" || snapshot.byId === null || typeof snapshot.byId !== "object" || summary === void 0 || retention === void 0 || retention.retainedBy === null || typeof retention.retainedBy !== "object" || !Number.isSafeInteger(retention.referenceCount) || retention.referenceCount < 0) {
    throw localizedError(t, "error.view-unavailable");
  }
  const retainedMainView = retention.retainedBy.mainView ?? 0;
  if (!Number.isSafeInteger(retainedMainView)) {
    throw localizedError(t, "error.view-unavailable");
  }
  const rows = Object.entries(snapshot.byId);
  const summariesHaveRetention = rows.every(([, candidate]) => candidate?.retainedBy !== null && typeof candidate?.retainedBy === "object");
  const currentIds = [];
  for (const [id, candidate] of rows) {
    let mainView = candidate.retainedBy?.mainView ?? 0;
    if (!summariesHaveRetention) {
      const candidateRetention = sessions.retainInfo?.(id)?.getSnapshot?.();
      if (candidateRetention?.retainedBy === null || typeof candidateRetention?.retainedBy !== "object") {
        throw localizedError(t, "error.view-unavailable");
      }
      mainView = candidateRetention.retainedBy.mainView ?? 0;
    }
    if (!Number.isSafeInteger(mainView)) throw localizedError(t, "error.view-unavailable");
    if (candidate.retainedBy !== void 0 && candidate.retainedBy !== null && typeof candidate.retainedBy === "object" && (candidate.retainedBy.mainView ?? 0) !== mainView) {
      throw localizedError(t, "error.view-unavailable");
    }
    if (mainView > 0) currentIds.push(id);
  }
  const summaryHasRetention = summary.retainedBy !== null && typeof summary.retainedBy === "object";
  const summaryMainView = summaryHasRetention ? summary.retainedBy.mainView ?? 0 : retainedMainView;
  if (currentIds.length > 1 || retainedMainView > 0 !== (currentIds[0] === sessionId)) {
    throw localizedError(t, "error.view-unavailable");
  }
  if (!Number.isSafeInteger(summaryMainView) || summaryMainView !== retainedMainView) {
    throw localizedError(t, "error.view-unavailable");
  }
  return {
    sessions,
    retention,
    currentSessionId: currentIds[0]
  };
}
function requireMainViewRelease(ctx, sessionId, state, t) {
  if (state.sessionId !== sessionId) throw localizedError(t, "error.view-unavailable");
  const before = readMainViewState(ctx, sessionId, t);
  if (typeof before.sessions.refresh !== "function") {
    throw localizedError(t, "error.view-unavailable");
  }
  if (before.currentSessionId !== sessionId) {
    return { ...before, sessionId, wasCurrent: false };
  }
  if (state.warmMoveSupported !== true) {
    throw localizedError(t, "error.view-unavailable");
  }
  const uiWorkspace = serviceFromContext(ctx, "uiWorkspace");
  if (typeof uiWorkspace?.clearMain !== "function" || typeof uiWorkspace?.openSession !== "function") {
    throw localizedError(t, "error.view-unavailable");
  }
  return { ...before, uiWorkspace, sessionId, wasCurrent: true };
}
function mainViewIsVacant(ctx, sessionId, t) {
  return readMainViewState(ctx, sessionId, t).currentSessionId === void 0;
}
function restoreMainSessionIfVacant(ctx, release, t) {
  if (!release.wasCurrent) return void 0;
  try {
    if (!mainViewIsVacant(ctx, release.sessionId, t)) return void 0;
    release.uiWorkspace.openSession(release.sessionId);
    const restored = readMainViewState(ctx, release.sessionId, t);
    if (restored.currentSessionId !== release.sessionId) throw localizedError(t, "error.view-unavailable");
    return void 0;
  } catch (error) {
    return error;
  }
}
async function moveSessionSafely(ctx, t, state, workspaceId, position, afterCommit) {
  const model = workspaceDialogModel(state);
  if (!model.canMove) throw localizedError(t, `reason.${model.reason ?? "unsupported"}`);
  const release = requireMainViewRelease(ctx, state.sessionId, state, t);
  if (release.wasCurrent) {
    try {
      release.uiWorkspace.clearMain();
      const afterRelease = readMainViewState(ctx, state.sessionId, t);
      if (afterRelease.currentSessionId !== void 0 || afterRelease.retention.referenceCount !== 0) {
        throw localizedError(t, "error.view-release");
      }
    } catch (error) {
      const restoreError2 = restoreMainSessionIfVacant(ctx, release, t);
      if (restoreError2 !== void 0) {
        throw localizedError(t, "error.view-release-restore", {
          message: error instanceof Error ? error.message : String(error),
          restoreMessage: restoreError2 instanceof Error ? restoreError2.message : String(restoreError2)
        });
      }
      throw error;
    }
  }
  let result;
  try {
    result = await ctx.connection.rpc.call(RPC_PATH, "move", {
      sessionId: state.sessionId,
      workspaceId,
      ...position === void 0 ? {} : { position }
    });
    if (!result?.ok) throw new Error(resultError(result));
  } catch (error) {
    const restoreError2 = restoreMainSessionIfVacant(ctx, release, t);
    if (restoreError2 !== void 0) {
      throw localizedError(t, "error.move-restore", {
        moveMessage: error instanceof Error ? error.message : String(error),
        restoreMessage: restoreError2 instanceof Error ? restoreError2.message : String(restoreError2)
      });
    }
    throw error;
  }
  let postMoveError;
  try {
    await afterCommit?.();
  } catch (error) {
    postMoveError = error;
  }
  try {
    await release.sessions.refresh();
  } catch (error) {
    postMoveError ??= error;
  }
  const restoreError = restoreMainSessionIfVacant(ctx, release, t);
  postMoveError ??= restoreError;
  if (postMoveError !== void 0) {
    if (postMoveError.localUserMessage === true) throw postMoveError;
    const message = postMoveError instanceof Error ? postMoveError.message : String(postMoveError);
    const error = localizedError(t, afterCommit === void 0 ? "error.view-restore" : "error.order-save", { message });
    error.moved = true;
    throw error;
  }
  return result.value;
}
function openDialog(ctx, anchor, sessionId, state, t) {
  const model = workspaceDialogModel(state);
  const overlay = element("div", "dsw-overlay");
  const dialog = element("section", "dsw-dialog");
  const titleId = `dsw-title-${crypto.randomUUID()}`;
  const helpId = `dsw-help-${crypto.randomUUID()}`;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.setAttribute("aria-describedby", helpId);
  const title = element("h2", "dsw-title", t("dialog.title"));
  title.id = titleId;
  const help = element("p", "dsw-help", t("dialog.help"));
  help.id = helpId;
  const currentLabel = element("span", "dsw-label", t("dialog.current"));
  const current = element("div", "dsw-current", currentWorkspaceLabel(state, t));
  const targetLabel = element("label", "dsw-label", t("dialog.target"));
  const select = element("select", "dsw-select");
  const selectId = `dsw-select-${crypto.randomUUID()}`;
  select.id = selectId;
  targetLabel.htmlFor = selectId;
  for (const workspace of model.choices) {
    const option = element("option", void 0, workspace.title);
    option.value = workspace.workspaceId;
    option.title = workspace.path;
    select.appendChild(option);
  }
  select.disabled = !model.canMove;
  const status = element("p", "dsw-status");
  status.setAttribute("aria-live", "polite");
  if (model.reason !== void 0) {
    status.textContent = t(`reason.${model.reason}`);
    status.dataset.error = "true";
  }
  const actions = element("div", "dsw-actions");
  const cancel = element("button", "dsw-button", t("dialog.cancel"));
  cancel.type = "button";
  const confirm = element("button", "dsw-button dsw-primary", t("dialog.move"));
  confirm.type = "button";
  confirm.disabled = !model.canMove;
  actions.append(cancel, confirm);
  dialog.append(title, help, currentLabel, current, targetLabel, select, status, actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  let busy = false;
  const close = () => {
    if (busy) return;
    document.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
    if (anchor.isConnected) anchor.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable(dialog);
    if (items.length === 0) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", onKeyDown, true);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close();
  });
  cancel.addEventListener("click", close);
  confirm.addEventListener("click", async () => {
    if (busy || !model.canMove) return;
    if (movingSessions.has(sessionId)) {
      status.dataset.error = "true";
      status.textContent = t("error.already-moving");
      return;
    }
    busy = true;
    movingSessions.add(sessionId);
    select.disabled = true;
    cancel.disabled = true;
    confirm.disabled = true;
    status.dataset.error = "false";
    status.textContent = t("dialog.moving");
    const workspace = model.choices.find((choice) => choice.workspaceId === select.value);
    try {
      await moveSessionSafely(ctx, t, state, select.value);
      status.textContent = t("dialog.moved", { title: workspace?.title ?? select.value });
      busy = false;
      setTimeout(close, 700);
    } catch (error) {
      busy = false;
      select.disabled = false;
      cancel.disabled = false;
      confirm.disabled = false;
      status.dataset.error = "true";
      status.textContent = error?.localUserMessage === true ? error.message : t("error.move", { message: error instanceof Error ? error.message : String(error) });
      select.focus();
    } finally {
      movingSessions.delete(sessionId);
    }
  });
  (model.canMove ? select : cancel).focus();
}
async function loadAndOpenDialog(ctx, anchor, sessionId, t) {
  try {
    const result = await ctx.connection.rpc.call(RPC_PATH, "state", { sessionId });
    if (!result?.ok) throw new Error(resultError(result));
    openDialog(ctx, anchor, sessionId, result.value, t);
  } catch (error) {
    showToast(t("error.load", { message: error instanceof Error ? error.message : String(error) }), { error: true });
  }
}
function MoveSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, moveSession, t }) {
  const [, setMenuOpen] = useMenuOpenState();
  return import_react.default.createElement(
    "button",
    {
      type: "button",
      role: "menuitem",
      className: "dsw-menu-item",
      title: displayTitle,
      onClick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(false);
        void moveSession(sessionId, event.currentTarget);
      }
    },
    import_react.default.createElement("span", { className: "dsw-menu-icon", "aria-hidden": "true" }, "\u2197"),
    import_react.default.createElement("span", void 0, t("menu.move"))
  );
}
function registerSessionMenu(ctx, t) {
  return ctx.slots.inject(SESSION_MENU_SLOT, () => ctx.slots.register({
    name: SESSION_MENU_SLOT,
    id: MENU_ITEM_ID,
    order: 500,
    locale: NS,
    inject: () => ({
      moveSession: (sessionId, anchor) => loadAndOpenDialog(ctx, anchor, sessionId, t)
    })
  }, MoveSessionMenuItem));
}
function nearestLegacyMenu(anchor) {
  const anchorRect = anchor.getBoundingClientRect();
  return Array.from(document.querySelectorAll('[role="menu"]')).filter((menu) => {
    const rect = menu.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && menu.querySelector('[role="menuitem"]') !== null;
  }).sort((left, right) => {
    const a = left.getBoundingClientRect();
    const b = right.getBoundingClientRect();
    const aDistance = Math.abs(a.left - anchorRect.left) + Math.abs(a.top - anchorRect.bottom);
    const bDistance = Math.abs(b.left - anchorRect.left) + Math.abs(b.top - anchorRect.bottom);
    return aDistance - bDistance;
  })[0];
}
function legacyMoveIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries({
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true"
  })) svg.setAttribute(name, value);
  for (const attributes of [
    { d: "M2.5 4.5h4l1.2 1.4h5.8v6.6h-11z", stroke: "currentColor", "stroke-width": "1.4", "stroke-linejoin": "round" },
    { d: "M5 9h5m-1.7-1.7L10 9l-1.7 1.7", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round", "stroke-linejoin": "round" }
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    for (const [name, value] of Object.entries(attributes)) path.setAttribute(name, value);
    svg.appendChild(path);
  }
  return svg;
}
function mountLegacyMenuItem(ctx, anchor, sessionId, t) {
  const menu = nearestLegacyMenu(anchor);
  if (menu === void 0) return false;
  if (menu.querySelector("[data-dsh-session-workspace]") !== null) return true;
  const template = menu.querySelector('[role="menuitem"]');
  if (template === null) return false;
  const item = template.cloneNode(false);
  item.dataset.dshSessionWorkspace = sessionId;
  const icon = element("span");
  icon.className = template.firstElementChild?.className ?? "";
  icon.appendChild(legacyMoveIcon());
  const label = element("span", template.lastElementChild?.className ?? "", t("menu.move"));
  item.append(icon, label);
  item.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    anchor.click();
    void loadAndOpenDialog(ctx, anchor, sessionId, t);
  });
  menu.insertBefore(item, template.nextSibling);
  window.dispatchEvent(new Event("resize"));
  return true;
}
function installLegacyMenuFallback(ctx, t) {
  const onClick = (event) => {
    const target = event.target;
    if (typeof target?.closest !== "function") return;
    const button = target.closest("button");
    if (button === null || button.closest('[role="treeitem"]') === null) return;
    const sessionId = sessionIdFromLegacyFiber(button);
    if (sessionId === void 0) return;
    let attempt = 0;
    const mount = () => {
      if (mountLegacyMenuItem(ctx, button, sessionId, t)) return;
      attempt += 1;
      if (attempt < 5) setTimeout(mount, 20);
    };
    setTimeout(mount, 0);
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
function hasModernSessionMenuSlot(ctx) {
  if (typeof ctx.slots.snapshot !== "function") return true;
  return ctx.slots.snapshot(SESSION_MENU_SLOT).length > 0;
}
function workspaceIdFromElement(element2) {
  const row = element2?.closest?.('[data-row-key^="workspace:"]');
  const key = row?.getAttribute?.("data-row-key") ?? row?.dataset?.rowKey;
  if (typeof key !== "string" || !key.startsWith("workspace:")) return void 0;
  const workspaceId = key.slice("workspace:".length);
  return workspaceId.trim() === "" ? void 0 : workspaceId;
}
function rowFromSingleChildBranch(branch, tree) {
  for (let node = branch; node !== null && node !== void 0 && node !== tree; ) {
    const key = node.getAttribute?.("data-row-key") ?? node.dataset?.rowKey;
    if (typeof key === "string" && (key.startsWith("workspace:") || key.startsWith("session:"))) return node;
    const role = node.getAttribute?.("role");
    if (role === "tree" || role === "group" || role === "treeitem") return void 0;
    if (node.children?.length !== 1) return void 0;
    node = node.children[0];
  }
  return void 0;
}
function workspaceDropTargetFromElement(element2, sourceTree) {
  const origin = element2?.nodeType === 1 ? element2 : element2?.parentElement;
  const targetTree = origin?.closest?.('[role="tree"]');
  if (sourceTree === void 0 || targetTree !== sourceTree) return void 0;
  let target;
  for (let container = origin; container !== null && container !== void 0 && container !== sourceTree; container = container.parentElement) {
    if (container.getAttribute?.("role") === "group") break;
    const workspaceRows = Array.from(container.children ?? []).map((child) => rowFromSingleChildBranch(child, sourceTree)).filter((row) => {
      const key = row?.getAttribute?.("data-row-key") ?? row?.dataset?.rowKey;
      return typeof key === "string" && key.startsWith("workspace:");
    });
    if (workspaceRows.length !== 1) continue;
    const workspaceId = workspaceIdFromElement(workspaceRows[0]);
    if (workspaceId !== void 0) target = { workspaceId, container };
  }
  return target;
}
function sessionDropPosition(event, targetContainer, sourceTree) {
  const origin = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
  const row = origin?.closest?.('[data-row-key^="session:"]');
  if (row === null || row === void 0 || row.closest?.('[role="tree"]') !== sourceTree) return void 0;
  const rowTarget = workspaceDropTargetFromElement(row, sourceTree);
  if (rowTarget?.container !== targetContainer) return void 0;
  const anchorSessionId = sessionIdFromElement(row);
  if (anchorSessionId === void 0) return void 0;
  const rect = row.getBoundingClientRect();
  if (!Number.isFinite(event.clientY) || !Number.isFinite(rect.top) || !Number.isFinite(rect.height) || rect.height <= 0) return void 0;
  const side = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  return { anchorSessionId, side, rect };
}
function orderByRecency(sessionIds, summaries) {
  return sessionIds.flatMap((id) => {
    const summary = summaries[id];
    return summary === void 0 ? [] : [{ id, rank: summary.updatedAt }];
  }).sort((a, b) => {
    if (a.rank !== b.rank) return b.rank - a.rank;
    return a.id < b.id ? -1 : 1;
  }).map((member) => member.id);
}
function reconcileManualOrder(memberIds, savedOrder, summaries, pinnedSessionIds, archivedSessionIds) {
  const members = new Map(memberIds.map((id) => [id, id]));
  const included = /* @__PURE__ */ new Set();
  const ordered = [];
  for (const key of savedOrder ?? []) {
    const id = members.get(key);
    if (id === void 0 || included.has(key)) continue;
    ordered.push(id);
    included.add(key);
  }
  const archived = new Set(archivedSessionIds);
  const pins = [];
  for (const id of pinnedSessionIds) {
    if (!members.has(id) || included.has(id) || archived.has(id) || summaries[id] === void 0) continue;
    pins.push(id);
    included.add(id);
  }
  const ordinary = [];
  const archives = [];
  for (const id of orderByRecency(memberIds.filter((memberId) => !included.has(memberId)), summaries)) {
    if (archived.has(id)) archives.push(id);
    else ordinary.push(id);
  }
  const result = [...pins, ...ordered, ...ordinary, ...archives];
  const pending = new Set(ordinary);
  const placeFork = (id) => {
    if (!pending.delete(id)) return;
    const parentId = summaries[id]?.parentId;
    if (parentId === void 0 || parentId === id || !result.includes(parentId)) return;
    placeFork(parentId);
    result.splice(result.indexOf(id), 1);
    result.splice(result.indexOf(parentId), 0, id);
  };
  for (const id of [...ordinary].reverse()) placeFork(id);
  return result;
}
function nativeMainSessionId(summaries) {
  return Object.values(summaries).find((summary) => (summary.retainedBy?.mainView ?? 0) > 0)?.id;
}
function completeNativeSessionOrders(workspaceSnapshot, sessionSnapshot, viewSnapshot) {
  if (workspaceSnapshot.phase !== "ready" || workspaceSnapshot.state === "loading" || sessionSnapshot.phase !== "ready") return void 0;
  if (!Array.isArray(workspaceSnapshot.items) || !Array.isArray(sessionSnapshot.ids) || !Array.isArray(workspaceSnapshot.pinnedSessionIds) || !Array.isArray(workspaceSnapshot.archivedSessionIds) || sessionSnapshot.byId === null || typeof sessionSnapshot.byId !== "object" || workspaceSnapshot.items.some((workspace) => typeof workspace.workspaceId !== "string" || !Array.isArray(workspace.sessionIds))) return void 0;
  if (viewSnapshot.orderBy !== "updated" && viewSnapshot.orderBy !== "manual") return void 0;
  const summaries = sessionSnapshot.byId;
  const workspaces = workspaceSnapshot.items;
  const pinnedSessionIds = Array.isArray(workspaceSnapshot.pinnedSessionIds) ? workspaceSnapshot.pinnedSessionIds : [];
  const archivedSessionIds = Array.isArray(workspaceSnapshot.archivedSessionIds) ? workspaceSnapshot.archivedSessionIds : [];
  const accounted = new Set(workspaces.flatMap((workspace) => Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []));
  const current = nativeMainSessionId(summaries);
  const currentBlank = current !== void 0 && summaries[current]?.blank === true ? current : void 0;
  const members = Object.fromEntries([
    ...workspaces.map((workspace) => [workspace.workspaceId, [...workspace.sessionIds]]),
    ["", sessionSnapshot.ids.filter((id) => summaries[id] !== void 0 && !accounted.has(id))],
    [FLAT_SESSION_ORDER_KEY, sessionSnapshot.ids.filter((id) => {
      const summary = summaries[id];
      return summary !== void 0 && summary.origin !== "subagent" && (!summary.blank || id === current);
    })]
  ]);
  const savedOrders = viewSnapshot.sessionOrderByAccount ?? {};
  const orders = Object.fromEntries(Object.entries(members).map(([accountKey, memberIds]) => {
    const ordered = viewSnapshot.orderBy === "updated" ? orderByRecency(memberIds, summaries) : reconcileManualOrder(memberIds, savedOrders[accountKey], summaries, pinnedSessionIds, archivedSessionIds);
    if (currentBlank !== void 0 && memberIds.includes(currentBlank)) {
      ordered.splice(0, ordered.length, currentBlank, ...ordered.filter((id) => id !== currentBlank));
    }
    for (const id of memberIds) if (summaries[id] === void 0 && !ordered.includes(id)) ordered.push(id);
    return [accountKey, ordered];
  }));
  return { members, orders, summaries, current, currentBlank, pinnedSessionIds, archivedSessionIds, viewSnapshot };
}
function nativeSessionOrderSeed(ctx, current) {
  try {
    const slots = ctx.get("slots");
    const entry = slots.entriesOfSlot(NATIVE_WORKSPACE_SLOT).find((candidate) => candidate.store?.spec?.persist === NATIVE_VIEW_PERSIST);
    const view = entry?.store?.create?.();
    const workspaces = ctx.get("workspaces");
    const sessions = ctx.get("sessions");
    if (view?.getSnapshot === void 0 || typeof view.actions?.setSessionOrder !== "function" || workspaces?.list?.getSnapshot === void 0 || sessions?.list?.getSnapshot === void 0) return void 0;
    const viewSnapshot = view.getSnapshot();
    const workspaceSnapshot = workspaces.list.getSnapshot();
    const sessionSnapshot = sessions.list.getSnapshot();
    const cached = current.nativeOrderSeed;
    if (cached?.view === view && cached.viewSnapshot === viewSnapshot && cached.workspaceSnapshot === workspaceSnapshot && cached.sessionSnapshot === sessionSnapshot) return cached;
    const complete = completeNativeSessionOrders(workspaceSnapshot, sessionSnapshot, viewSnapshot);
    if (complete === void 0) return void 0;
    const seed = { view, viewSnapshot, workspaceSnapshot, sessionSnapshot, ...complete };
    current.nativeOrderSeed = seed;
    return seed;
  } catch {
    return void 0;
  }
}
function nativeVisibleSessions(accountOrder, seed) {
  const archived = new Set(seed.archivedSessionIds);
  const pinned = new Set(seed.pinnedSessionIds);
  const filter = seed.viewSnapshot.archivedFilter ?? "default";
  const visible = accountOrder.filter((id) => {
    const summary = seed.summaries[id];
    if (summary === void 0 || summary.origin === "subagent" || summary.blank && id !== seed.current) return false;
    if (filter === "default") return !archived.has(id);
    if (filter === "only") return archived.has(id);
    return true;
  });
  const blanks = [];
  const pins = [];
  const ordinary = [];
  for (const id of visible) {
    if (seed.summaries[id].blank) blanks.push(id);
    else if (!archived.has(id) && pinned.has(id)) pins.push(id);
    else ordinary.push(id);
  }
  return { blanks, pins, ordinary, visible: [...blanks, ...pins, ...ordinary] };
}
function insertRelative(order, sessionId, anchorSessionId, side) {
  const next = order.filter((id) => id !== sessionId);
  const index = next.indexOf(anchorSessionId);
  if (index === -1) return void 0;
  next.splice(index + (side === "after" ? 1 : 0), 0, sessionId);
  return next;
}
function insertionForPartitionBoundary(order, sessionId, seed, parts, boundary, sourcePinned, pointerPosition) {
  const pinStart = parts.blanks.length;
  const pinEnd = pinStart + parts.pins.length;
  const targetId = pointerPosition.anchorSessionId;
  const targetSummary = seed.summaries[targetId];
  const targetArchived = seed.archivedSessionIds.includes(targetId);
  const targetPinned = !targetArchived && seed.pinnedSessionIds.includes(targetId);
  const targetBlank = targetSummary.blank === true;
  if (sourcePinned && targetPinned || !sourcePinned && !targetPinned && !targetBlank) {
    return insertRelative(order, sessionId, targetId, pointerPosition.side);
  }
  let anchorSessionId;
  let side;
  if (sourcePinned && boundary === pinStart) {
    if (parts.pins.length > 0) {
      anchorSessionId = parts.pins[0];
      side = "before";
    } else if (parts.blanks.length > 0) {
      anchorSessionId = parts.blanks.at(-1);
      side = "after";
    } else if (parts.ordinary.length > 0) {
      anchorSessionId = parts.ordinary[0];
      side = "before";
    }
  } else if (sourcePinned && boundary === pinEnd) {
    if (parts.pins.length > 0) {
      anchorSessionId = parts.pins.at(-1);
      side = "after";
    } else if (parts.ordinary.length > 0) {
      anchorSessionId = parts.ordinary[0];
      side = "before";
    } else if (parts.blanks.length > 0) {
      anchorSessionId = parts.blanks.at(-1);
      side = "after";
    }
  } else if (!sourcePinned && boundary === pinEnd) {
    if (targetBlank && parts.pins.length === 0) {
      anchorSessionId = targetId;
      side = "after";
    } else if (parts.ordinary.length > 0) {
      anchorSessionId = parts.ordinary[0];
      side = "before";
    } else if (parts.pins.length > 0) {
      anchorSessionId = parts.pins.at(-1);
      side = "after";
    } else if (parts.blanks.length > 0) {
      anchorSessionId = parts.blanks.at(-1);
      side = "after";
    }
  }
  return anchorSessionId === void 0 ? void 0 : insertRelative(order, sessionId, anchorSessionId, side);
}
function nativeSessionOrderPlan(ctx, current, targetWorkspaceId, pointerPosition) {
  const seed = nativeSessionOrderSeed(ctx, current);
  if (seed === void 0) return { error: "unavailable" };
  const sourceKey = current.sourceWorkspaceId ?? "";
  const sourceMembers = seed.members[sourceKey];
  const targetMembers = seed.members[targetWorkspaceId];
  const sourceSummary = seed.summaries[current.sessionId];
  const targetSummary = seed.summaries[pointerPosition.anchorSessionId];
  const targetOrder = seed.orders[targetWorkspaceId];
  if (!Array.isArray(sourceMembers) || !sourceMembers.includes(current.sessionId) || !Array.isArray(targetMembers) || !targetMembers.includes(pointerPosition.anchorSessionId) || !Array.isArray(targetOrder) || !Array.isArray(seed.orders[sourceKey]) || sourceSummary === void 0 || targetSummary === void 0 || !targetOrder.includes(pointerPosition.anchorSessionId)) return { error: "unavailable" };
  if (sourceSummary.blank === true || sourceSummary.origin === "subagent" || seed.archivedSessionIds.includes(current.sessionId)) return { error: "boundary" };
  const parts = nativeVisibleSessions(targetOrder, seed);
  const targetIndex = parts.visible.indexOf(pointerPosition.anchorSessionId);
  if (targetIndex === -1) return { error: "unavailable" };
  const boundary = targetIndex + (pointerPosition.side === "after" ? 1 : 0);
  const pinStart = parts.blanks.length;
  const pinEnd = pinStart + parts.pins.length;
  const sourcePinned = seed.pinnedSessionIds.includes(current.sessionId) && !seed.archivedSessionIds.includes(current.sessionId);
  const boundaryIsRepresentable = sourcePinned ? boundary >= pinStart && boundary <= pinEnd : boundary >= pinEnd && boundary <= parts.visible.length;
  if (!boundaryIsRepresentable) return { error: "boundary" };
  const nextOrder = insertionForPartitionBoundary(targetOrder, current.sessionId, seed, parts, boundary, sourcePinned, pointerPosition);
  if (nextOrder === void 0) return { error: "unavailable" };
  const initialOrders = Object.fromEntries(Object.entries(seed.orders).map(([accountKey, order]) => [
    accountKey,
    accountKey === sourceKey ? order.filter((id) => id !== current.sessionId) : accountKey === targetWorkspaceId ? [...nextOrder] : [...order]
  ]));
  return {
    view: seed.view,
    targetWorkspaceId,
    pointerPosition,
    nextOrder,
    initialOrders
  };
}
var movingSessions = /* @__PURE__ */ new Set();
function installSessionDragAndDrop(ctx, t) {
  let drag;
  let highlighted;
  let sessionMarker;
  const clearHighlight = () => {
    highlighted?.removeAttribute("data-dsw-drop-target");
    highlighted = void 0;
  };
  const setNativeMarkerHidden = (current, hidden) => {
    if (current?.sourceTree?.isConnected !== true) return;
    if (hidden) current.sourceTree.setAttribute(CROSS_WORKSPACE_TREE_ATTRIBUTE, "true");
    else current.sourceTree.removeAttribute(CROSS_WORKSPACE_TREE_ATTRIBUTE);
  };
  const clearSessionMarker = () => {
    sessionMarker?.remove();
    sessionMarker = void 0;
  };
  const showSessionMarker = (position) => {
    if (sessionMarker === void 0) {
      sessionMarker = element("div", "dsw-session-drop-marker");
      sessionMarker.setAttribute("aria-hidden", "true");
      document.body.appendChild(sessionMarker);
    }
    sessionMarker.dataset.side = position.side;
    sessionMarker.style.left = `${position.rect.left}px`;
    sessionMarker.style.top = `${position.side === "before" ? position.rect.top - 7 : position.rect.bottom - 5}px`;
    sessionMarker.style.width = `${position.rect.width}px`;
  };
  const onDragStart = (event) => {
    const sessionId = sessionIdFromElement(event.target);
    if (sessionId === void 0) return;
    clearHighlight();
    clearSessionMarker();
    setNativeMarkerHidden(drag, false);
    const sourceRow = event.target?.closest?.('[data-row-key^="session:"]') ?? event.target;
    const sourceTree = sourceRow?.closest?.('[role="tree"]');
    const sourceWorkspaceId = workspaceDropTargetFromElement(sourceRow, sourceTree)?.workspaceId;
    const current = { sessionId, sourceTree, sourceWorkspaceId, state: void 0, handled: false };
    drag = current;
    current.statePromise = Promise.resolve().then(() => ctx.connection.rpc.call(RPC_PATH, "state", { sessionId })).then((result) => {
      if (!result?.ok) throw new Error(resultError(result));
      current.state = result.value;
      const model = workspaceDialogModel(current.state);
      if (drag === current && !current.handled && model.reason !== void 0) {
        current.reasonShown = true;
        showToast(t(`reason.${model.reason}`), { error: true });
      }
      return current.state;
    }).catch((error) => {
      current.failureMessage = error instanceof Error ? error.message : String(error);
      if (drag === current && !current.handled) {
        current.failureShown = true;
        showToast(t("error.load", { message: current.failureMessage }), { error: true });
      }
      return void 0;
    });
  };
  const onDragOver = (event) => {
    const current = drag;
    if (current === void 0) return;
    const dropTarget = workspaceDropTargetFromElement(event.target, current.sourceTree);
    if (dropTarget === void 0) {
      clearHighlight();
      clearSessionMarker();
      setNativeMarkerHidden(current, false);
      return;
    }
    const { workspaceId } = dropTarget;
    const dataTransfer = event.dataTransfer;
    if (current.state === void 0) {
      clearSessionMarker();
      setNativeMarkerHidden(current, false);
      if (workspaceId === current.sourceWorkspaceId) {
        clearHighlight();
        return;
      }
      if (current.failureMessage !== void 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (dataTransfer !== null) dataTransfer.dropEffect = "move";
      return;
    }
    const model = workspaceDialogModel(current.state);
    if (!model.canMove || workspaceId === current.state.currentWorkspaceId || !model.choices.some((workspace) => workspace.workspaceId === workspaceId)) {
      clearHighlight();
      clearSessionMarker();
      setNativeMarkerHidden(current, false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (dataTransfer !== null) dataTransfer.dropEffect = "move";
    setNativeMarkerHidden(current, true);
    const pointerPosition = sessionDropPosition(event, dropTarget.container, current.sourceTree);
    const orderPlan = pointerPosition === void 0 || current.state.positionSupported !== true ? void 0 : nativeSessionOrderPlan(ctx, current, workspaceId, pointerPosition);
    if (orderPlan === void 0 || orderPlan.error !== void 0) clearSessionMarker();
    else showSessionMarker(pointerPosition);
    clearHighlight();
    dropTarget.container.setAttribute("data-dsw-drop-target", "true");
    highlighted = dropTarget.container;
  };
  const onDrop = (event) => {
    const current = drag;
    if (current === void 0) return;
    const dropTarget = workspaceDropTargetFromElement(event.target, current.sourceTree);
    if (dropTarget === void 0) {
      clearHighlight();
      clearSessionMarker();
      setNativeMarkerHidden(current, false);
      return;
    }
    const { workspaceId } = dropTarget;
    if (current.handled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const state = current.state;
    if (state === void 0 && workspaceId === current.sourceWorkspaceId) {
      clearHighlight();
      clearSessionMarker();
      setNativeMarkerHidden(current, false);
      return;
    }
    if (state !== void 0) {
      const model = workspaceDialogModel(state);
      if (!model.canMove || workspaceId === state.currentWorkspaceId || !model.choices.some((workspace) => workspace.workspaceId === workspaceId)) {
        clearHighlight();
        clearSessionMarker();
        setNativeMarkerHidden(current, false);
        return;
      }
    }
    const pointerPosition = sessionDropPosition(event, dropTarget.container, current.sourceTree);
    let orderPlan = pointerPosition === void 0 || state?.positionSupported !== true ? void 0 : nativeSessionOrderPlan(ctx, current, workspaceId, pointerPosition);
    event.preventDefault();
    event.stopPropagation();
    current.handled = true;
    clearHighlight();
    clearSessionMarker();
    setNativeMarkerHidden(current, false);
    if (orderPlan?.error !== void 0) {
      showToast(t(orderPlan.error === "boundary" ? "error.order-boundary" : "error.order-unavailable"), { error: true });
      return;
    }
    void (async () => {
      const resolvedState = state ?? await current.statePromise;
      if (resolvedState === void 0) {
        if (current.failureMessage !== void 0 && !current.failureShown) {
          current.failureShown = true;
          showToast(t("error.load", { message: current.failureMessage }), { error: true });
        }
        return;
      }
      const model = workspaceDialogModel(resolvedState);
      if (!model.canMove) {
        if (model.reason !== void 0 && !current.reasonShown) {
          current.reasonShown = true;
          showToast(t(`reason.${model.reason}`), { error: true });
        }
        return;
      }
      if (workspaceId === resolvedState.currentWorkspaceId || !model.choices.some((workspace2) => workspace2.workspaceId === workspaceId)) return;
      if (pointerPosition !== void 0 && resolvedState.positionSupported !== true) {
        showToast(t("error.position-unsupported"), { error: true });
        return;
      }
      if (pointerPosition !== void 0 && orderPlan === void 0) {
        orderPlan = nativeSessionOrderPlan(ctx, current, workspaceId, pointerPosition);
      }
      if (orderPlan?.error !== void 0) {
        showToast(t(orderPlan.error === "boundary" ? "error.order-boundary" : "error.order-unavailable"), { error: true });
        return;
      }
      const workspace = model.choices.find((choice) => choice.workspaceId === workspaceId);
      if (movingSessions.has(current.sessionId)) {
        showToast(t("error.already-moving"), { error: true });
        return;
      }
      movingSessions.add(current.sessionId);
      try {
        await moveSessionSafely(
          ctx,
          t,
          resolvedState,
          workspaceId,
          orderPlan === void 0 ? void 0 : { anchorSessionId: orderPlan.pointerPosition.anchorSessionId, side: orderPlan.pointerPosition.side },
          orderPlan === void 0 ? void 0 : () => orderPlan.view.actions.setSessionOrder(orderPlan.targetWorkspaceId, orderPlan.nextOrder, orderPlan.initialOrders)
        );
        showToast(t("drag.moved", { title: workspace?.title ?? workspaceId }), { duration: 2200 });
      } catch (error) {
        if (error?.localUserMessage === true) showToast(error.message, { error: true });
        else showToast(t("error.move", { message: error instanceof Error ? error.message : String(error) }), { error: true });
      } finally {
        movingSessions.delete(current.sessionId);
      }
    })();
  };
  const onDragEnd = () => {
    clearHighlight();
    clearSessionMarker();
    setNativeMarkerHidden(drag, false);
    drag = void 0;
  };
  document.addEventListener("dragstart", onDragStart, true);
  document.addEventListener("dragover", onDragOver, true);
  document.addEventListener("drop", onDrop, true);
  document.addEventListener("dragend", onDragEnd, true);
  return () => {
    document.removeEventListener("dragstart", onDragStart, true);
    document.removeEventListener("dragover", onDragOver, true);
    document.removeEventListener("drop", onDrop, true);
    document.removeEventListener("dragend", onDragEnd, true);
    clearHighlight();
    clearSessionMarker();
    setNativeMarkerHidden(drag, false);
    drag = void 0;
  };
}
function installStyles() {
  if (document.getElementById(STYLE_ID) !== null) return () => {
  };
  const style = element("style");
  style.id = STYLE_ID;
  style.textContent = `
.dsw-overlay{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.48)}
.dsw-menu-item{box-sizing:border-box;width:100%;min-height:32px;display:flex;align-items:center;gap:8px;padding:6px 10px;border:0;border-radius:6px;color:var(--dsw-alias-label-primary);background:transparent;text-align:left;font:inherit;cursor:pointer}.dsw-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsw-menu-item:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.dsw-menu-icon{width:16px;flex:none;text-align:center}
[data-dsw-drop-target="true"]{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px;background:var(--dsw-alias-interactive-bg-hover)}
[role="tree"][data-dsw-cross-workspace-drop-active="true"] [data-row-key^="session:"]::before,[role="tree"][data-dsw-cross-workspace-drop-active="true"] [data-row-key^="session:"]::after{content:none!important;display:none!important}
.dsw-session-drop-marker{box-sizing:border-box;position:fixed;z-index:1290;height:12px;pointer-events:none;background:linear-gradient(55deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 0/5px 7px no-repeat,linear-gradient(125deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 5px/5px 7px no-repeat,linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px/calc(100% - 4px) 2px no-repeat}
.dsw-dialog{box-sizing:border-box;width:min(480px,100%);padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu,var(--dsw-alias-bg-base));box-shadow:var(--dsw-shadow-lv3);font-family:var(--dsw-font-family,ui-sans-serif,system-ui,sans-serif)}
.dsw-title{margin:0;font-size:18px;line-height:26px}.dsw-help{margin:6px 0 18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.dsw-label{display:block;margin:12px 0 6px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}.dsw-current{min-height:20px;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px;text-overflow:ellipsis;white-space:nowrap}.dsw-select{box-sizing:border-box;width:100%;min-height:44px;padding:9px 34px 9px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));font:inherit;font-size:14px}.dsw-select:disabled{opacity:.55}.dsw-status{min-height:20px;margin:10px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px}.dsw-status[data-error=true]{color:var(--dsw-alias-state-error-primary)}.dsw-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.dsw-button{min-width:80px;min-height:40px;padding:8px 13px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:transparent;font:inherit;font-size:13px;cursor:pointer}.dsw-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsw-primary{border-color:var(--dsw-alias-state-business-primary);color:#fff;background:var(--dsw-alias-state-business-primary)}.dsw-button:disabled{opacity:.5;cursor:not-allowed}.dsw-button:focus-visible,.dsw-select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.dsw-toast{position:fixed;right:20px;bottom:20px;z-index:1350;max-width:min(420px,calc(100vw - 40px));padding:11px 14px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu,var(--dsw-alias-bg-base));box-shadow:var(--dsw-shadow-lv2);font:13px/20px var(--dsw-font-family,ui-sans-serif,system-ui,sans-serif)}
@media(max-width:600px){.dsw-overlay{align-items:flex-end;padding:12px}.dsw-dialog{padding:18px}.dsw-button{min-height:44px;flex:1}.dsw-actions{width:100%}}
@media(prefers-reduced-motion:reduce){.dsw-dialog,.dsw-toast{scroll-behavior:auto}}
`;
  document.head.appendChild(style);
  return () => style.remove();
}
function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(installStyles);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }));
  if (hasModernSessionMenuSlot(ctx)) ctx.effect(() => registerSessionMenu(ctx, t));
  else ctx.effect(() => installLegacyMenuFallback(ctx, t));
  ctx.effect(() => installSessionDragAndDrop(ctx, t));
}
return module.exports;}});

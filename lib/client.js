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
  "reason.session-active": "\u8FD9\u4E2A\u4F1A\u8BDD\u4ECD\u5904\u4E8E\u6D3B\u52A8\u72B6\u6001\u3002\u8BF7\u5148\u5207\u6362\u5230\u53E6\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u5F85\u5B83\u5173\u95ED\u540E\u518D\u79FB\u52A8\u3002",
  "reason.unsupported": "\u5F53\u524D DSH \u7248\u672C\u6216\u6301\u4E45\u5316\u540E\u7AEF\u4E0D\u652F\u6301\u5B89\u5168\u8FC1\u79FB\u3002",
  "reason.no-targets": "\u6CA1\u6709\u5176\u4ED6\u53EF\u7528\u5DE5\u4F5C\u533A\u3002",
  "error.load": "\u65E0\u6CD5\u8BFB\u53D6\u5DE5\u4F5C\u533A\uFF1A{message}",
  "error.move": "\u79FB\u52A8\u5931\u8D25\uFF1A{message}",
  "error.already-moving": "\u8FD9\u4E2A\u4F1A\u8BDD\u5DF2\u6709\u4E00\u4E2A\u79FB\u52A8\u64CD\u4F5C\u6B63\u5728\u8FDB\u884C\u3002"
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
  "reason.session-active": "This session is still active. Switch to another session, wait for it to close, then try again.",
  "reason.unsupported": "This DSH version or persistence backend cannot move sessions safely.",
  "reason.no-targets": "No other workspace is available.",
  "error.load": "Could not load workspaces: {message}",
  "error.move": "Move failed: {message}",
  "error.already-moving": "A move for this session is already in progress."
};
var inject = ["locale", "connection", "slots"];
function workspaceDialogModel(state) {
  const choices = state.workspaces.filter((workspace) => workspace.workspaceId !== state.currentWorkspaceId);
  const reason = state.active ? "session-active" : !state.supported ? "unsupported" : choices.length === 0 ? "no-targets" : void 0;
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
      const result = await ctx.connection.rpc.call(RPC_PATH, "move", {
        sessionId,
        workspaceId: select.value
      });
      if (!result?.ok) throw new Error(resultError(result));
      status.textContent = t("dialog.moved", { title: workspace?.title ?? select.value });
      busy = false;
      setTimeout(close, 700);
    } catch (error) {
      busy = false;
      select.disabled = false;
      cancel.disabled = false;
      confirm.disabled = false;
      status.dataset.error = "true";
      status.textContent = t("error.move", { message: error instanceof Error ? error.message : String(error) });
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
var movingSessions = /* @__PURE__ */ new Set();
function installSessionDragAndDrop(ctx, t) {
  let drag;
  let highlighted;
  const clearHighlight = () => {
    highlighted?.removeAttribute("data-dsw-drop-target");
    highlighted = void 0;
  };
  const onDragStart = (event) => {
    const sessionId = sessionIdFromElement(event.target);
    if (sessionId === void 0) return;
    clearHighlight();
    const current = { sessionId, state: void 0, handled: false };
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
    const workspaceId = workspaceIdFromElement(event.target);
    if (current === void 0) return;
    if (workspaceId === void 0) {
      clearHighlight();
      return;
    }
    const dataTransfer = event.dataTransfer;
    if (current.state === void 0) {
      if (current.failureMessage !== void 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (dataTransfer !== null) dataTransfer.dropEffect = "move";
      return;
    }
    const model = workspaceDialogModel(current.state);
    if (!model.canMove || workspaceId === current.state.currentWorkspaceId || !model.choices.some((workspace) => workspace.workspaceId === workspaceId)) {
      clearHighlight();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (dataTransfer !== null) dataTransfer.dropEffect = "move";
    clearHighlight();
    const row = event.target.closest('[data-row-key^="workspace:"]');
    row?.setAttribute("data-dsw-drop-target", "true");
    highlighted = row;
  };
  const onDrop = (event) => {
    const current = drag;
    const workspaceId = workspaceIdFromElement(event.target);
    if (current === void 0 || workspaceId === void 0) return;
    if (current.handled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const state = current.state;
    if (state !== void 0) {
      const model = workspaceDialogModel(state);
      if (!model.canMove || workspaceId === state.currentWorkspaceId || !model.choices.some((workspace) => workspace.workspaceId === workspaceId)) return;
    }
    event.preventDefault();
    event.stopPropagation();
    current.handled = true;
    clearHighlight();
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
      const workspace = model.choices.find((choice) => choice.workspaceId === workspaceId);
      if (movingSessions.has(current.sessionId)) {
        showToast(t("error.already-moving"), { error: true });
        return;
      }
      movingSessions.add(current.sessionId);
      try {
        const result = await ctx.connection.rpc.call(RPC_PATH, "move", {
          sessionId: current.sessionId,
          workspaceId
        });
        if (!result?.ok) throw new Error(resultError(result));
        showToast(t("drag.moved", { title: workspace?.title ?? workspaceId }), { duration: 2200 });
      } catch (error) {
        showToast(t("error.move", { message: error instanceof Error ? error.message : String(error) }), { error: true });
      } finally {
        movingSessions.delete(current.sessionId);
      }
    })();
  };
  const onDragEnd = () => {
    clearHighlight();
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

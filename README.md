# dsh-session-workspace

English | [中文](./README.zh.md)

Move an existing DeepSeek Harness session to another registered workspace without changing its session ID or conversation history.

Use either **Move to another workspace** in the session's sidebar menu or drag the session row onto another workspace's folder/title row. Both entry points use the same authenticated migration handler. The session ID and complete event history are retained; the persisted `cwd` and workspace account change. Older generation files are retained in the backup outside the indexed session root.

## Safety

- Only cold sessions with no Host Agent or open write handle can move. In DSH `0.2.0-rc.2`, switching to another session does not close these resources.
- The destination must be an existing workspace registered in DSH.
- Existing destination artifacts are never overwritten.
- The source revision is checked before commit. A session that changes during preparation is rejected.
- Native source and destination write leases exclude other DSH writers during a move.
- Durable copies of every original generation are kept under `<DSH_HOME>/session-workspace-backups/<uuid>/`.
- Workspace-update failures roll the artifact and workspace account back to their original state.

## Requirements

- DeepSeek Harness `0.2.0-rc.2` for the V4 backend and both sidebar entry points. Its first-party `@deepseek-ai/dsh-session-format-catalog` validates the complete prepared artifact. The existing V3 native backend and bounded `0.1.5` menu fallback are retained.
- The published `v0.2.0` tag targets DSH `0.1.5-rc.1`; use a checkout containing the V4 changes for DSH `0.2.0-rc.2`. Keep plugin `0.1.1` with DSH `0.1.1-rc.2`.
- The default per-session JSONL persistence backend (`.jsonl.zstd` or `.jsonl`). Shared SQLite session persistence is rejected because it does not expose an independent artifact that can be re-homed safely.
- Node.js with the Zstandard APIs used by DSH (the DSH-supported Node runtime already provides them).

## Install

Build and install the checked-out version:

```sh
npm ci
npm run build
npm pack
dsh plugin --profile web add ./dsh-session-workspace-0.2.2.tgz
```

Use `--profile desktop` instead of `--profile web` for the official desktop app.

Restart the DSH web process after installation. The package's `cordis.patch.yml` mounts both the trusted-host RPC handler and the browser client.

## Update

Install the built archive and reload its profile. The native path supports V3 and V4 JSONL generation and write-lease hooks. V4 uses the first-party format catalog because DSH no longer exposes `createRestore` on the persistence backend. Compressed artifacts are decoded across all frames. The complete prepared artifact is validated before publication; authentication and trusted-host checks remain owned by DSH. Future storage versions require a compatibility check.

## Use

1. Use a cold session with no Host Agent or open write handle. In DSH `0.2.0-rc.2`, switching to another session releases the UI view but keeps the Host Agent and its write handle. After a normal, safe DSH restart, move the session before opening it again.
2. Use either entry point:
   - **Menu:** open that session's **⋯** menu, select **Move to another workspace**, choose the destination and confirm.
   - **Drag:** in a workspace-grouped sidebar, drag the session row onto the destination workspace's folder/title row and release. A result or refusal is shown in a toast.

Same-workspace session reordering and dragging workspace groups remain native DSH actions. Flat-list mode has no workspace drop targets; use the menu there.

The session remains at the same ID and appears under the destination workspace. Future shell, filesystem, and sandbox operations use the destination workspace path.

## Uninstall

```sh
dsh plugin --profile web remove dsh-session-workspace
```

## Development

```sh
npm test
npm pack --dry-run
```

Set `DSH_NATIVE_ROOT` to an installed DSH package root containing its `node_modules` to include native persistence and real durable workspace-registry tests:

```sh
DSH_NATIVE_ROOT=/path/to/installed/dsh node --expose-internals --test tests/*.test.mjs
```

Tests create their own temporary session/storage roots. The native registry cases recreate the entire service stack to check ID, full history, membership, pin/archive state and subsequent appends after restart. DOM tests exercise both entry points, same-workspace drag pass-through, concurrent-drop suppression, visible refusals, and disposal.

The tests use real temporary files and Node's Zstandard codec. They cover successful moves, backups, active-session refusal, destination conflicts, revision races, rollback, RPC results, and sidebar session targeting.

## License

MIT

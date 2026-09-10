# dsh-session-workspace

English | [中文](./README.zh.md)

Move an existing DeepSeek Harness session to another registered workspace without changing its session ID or conversation history.

The plugin adds **Move to another workspace** to each session's sidebar menu. It changes the session's persisted `cwd`, moves its current JSONL generation, refreshes DSH's workspace index, and updates the workspace account. Older generation files are retained in the backup outside the indexed session root.

## Safety

- Only cold sessions can move. If the session is open or running, switch to another session and try again after it closes.
- The destination must be an existing workspace registered in DSH.
- Existing destination artifacts are never overwritten.
- The source revision is checked before commit. A session that changes during preparation is rejected.
- Native source and destination write leases exclude other DSH writers during a move.
- Durable copies of every original generation are kept under `<DSH_HOME>/session-workspace-backups/<uuid>/`.
- Workspace-update failures roll the artifact and workspace account back to their original state.

## Requirements

- DeepSeek Harness `0.1.5-rc.1` for plugin `0.2.0`. Keep plugin `0.1.1` with DSH `0.1.1-rc.2`.
- The default per-session JSONL persistence backend (`.jsonl.zstd` or `.jsonl`). Shared SQLite session persistence is rejected because it does not expose an independent artifact that can be re-homed safely.
- Node.js with the Zstandard APIs used by DSH (the DSH-supported Node runtime already provides them).

## Install

```sh
dsh plugin --profile web add github:Unintendedz/dsh-session-workspace#v0.2.0
```

Restart the DSH web process after installation. The package's `cordis.patch.yml` mounts both the trusted-host RPC handler and the browser client.

## Update

Install the pinned tag above and restart the DSH Web process. Version `0.2.0` uses native session handles, V3 snapshot headers, and the DSH 0.1.5 JSONL generation and write-lease hooks. Compressed artifacts are decoded across all frames. The complete prepared artifact is validated before publication; authentication and trusted-host checks remain owned by DSH. Future storage versions require a compatibility check.

## Use

1. Switch away from the session you want to move so it is no longer active.
2. Open that session's sidebar menu.
3. Select **Move to another workspace**.
4. Choose the destination and confirm.

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

Set `DSH_NATIVE_ROOT` to a DSH package root containing its `node_modules` to include native V3 persistence, compressed migration, foreign-writer refusal, and complete rollback tests. Use a fresh temporary `DSH_HOME` and named test profile.

The tests use real temporary files and Node's Zstandard codec. They cover successful moves, backups, active-session refusal, destination conflicts, revision races, rollback, RPC results, and sidebar session targeting.

## License

MIT

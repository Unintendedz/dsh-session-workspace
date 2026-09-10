# dsh-session-workspace

[English](./README.md) | 中文

把现有 DeepSeek Harness session 移动到另一个已注册工作区，同时保持 session ID 和对话历史不变。

插件会在每个 session 的侧边栏菜单中加入 **移动到其他工作区**。它会修改 session 持久化 header 中的 `cwd`、迁移当前代际 JSONL 文件、刷新 DSH 工作区索引并更新工作区账本。旧代际文件保留在会话索引目录外的备份中。

## 安全设计

- 只允许迁移冷 session。若 session 正在打开或运行，请先切换到另一个 session，等它关闭后再操作。
- 目标必须是 DSH 中已经注册的现有工作区。
- 绝不覆盖目标位置已有的 session 文件。
- 提交前会再次核对源文件修订；准备期间发生变化会直接拒绝。
- 移动期间持有源位置和目标位置的原生写入锁，排除其他 DSH 写入者。
- 所有原始代际文件都会持久备份到 `<DSH_HOME>/session-workspace-backups/<uuid>/`。
- 如果更新工作区账本失败，文件和原工作区归属都会自动回滚。

## 要求

- 插件 `0.2.0` 要求 DeepSeek Harness `0.1.5-rc.1`；DSH `0.1.1-rc.2` 请继续使用插件 `0.1.1`。
- 默认的逐 session JSONL 持久化后端（`.jsonl.zstd` 或 `.jsonl`）。共享 SQLite 后端没有独立 session 文件，插件会明确拒绝，避免不安全改库。
- 支持 DSH 所用 Zstandard API 的 Node.js；DSH 官方支持的 Node 运行时已经具备。

## 安装

```sh
dsh plugin --profile web add github:Unintendedz/dsh-session-workspace#v0.2.0
```

安装后重启 DSH Web 进程。包内的 `cordis.patch.yml` 会同时挂载 trusted-host RPC 和浏览器客户端。

## 更新

安装上述固定 tag 后重启 DSH Web 进程。`0.2.0` 使用原生会话句柄、V3 快照 header，以及 DSH 0.1.5 的 JSONL generation 和 write-lease hook。压缩文件会逐帧完整解码，准备好的完整文件会在发布前重新验证；身份认证和 trusted-host 检查仍由 DSH 执行。未来存储版本需要重新检查兼容性。

## 使用

1. 先切换离开要迁移的 session，让它不再处于活动状态。
2. 打开该 session 的侧边栏菜单。
3. 点击 **移动到其他工作区**。
4. 选择目标工作区并确认。

迁移后 session ID 不变，会出现在目标工作区下；后续 shell、文件系统和 sandbox 操作都会使用目标工作区路径。

## 卸载

```sh
dsh plugin --profile web remove dsh-session-workspace
```

## 开发验证

```sh
npm test
npm pack --dry-run
```

将 `DSH_NATIVE_ROOT` 指向包含 `node_modules` 的 DSH 包根目录，可运行原生 V3 持久化、压缩迁移、外部写入锁拒绝和完整回滚测试。使用全新临时 `DSH_HOME` 与明确命名的测试 profile。

测试使用真实临时文件和 Node Zstandard codec，覆盖成功迁移、备份、活动 session 拒绝、目标冲突、修订竞态、失败回滚、RPC 返回和侧边栏 session 定位。

## 许可证

MIT

# dsh-session-workspace

把现有 DeepSeek Harness session 移动到另一个已注册工作区，同时保持 session ID 和对话历史不变。

插件会在每个 session 的侧边栏菜单中加入 **移动到其他工作区**。它会修改 session 持久化 header 中的 `cwd`、迁移 JSONL 文件、刷新 DSH 工作区索引并更新工作区账本。这是真正迁移工作区，不是只改变界面分组。

## 安全设计

- 只允许迁移冷 session。若 session 正在打开或运行，请先切换到另一个 session，等它关闭后再操作。
- 目标必须是 DSH 中已经注册的现有工作区。
- 绝不覆盖目标位置已有的 session 文件。
- 提交前会再次核对源文件修订；准备期间发生变化会直接拒绝。
- 原文件会持久备份到 `<DSH_HOME>/session-workspace-backups/<uuid>/`。
- 如果更新工作区账本失败，文件和原工作区归属都会自动回滚。

## 要求

- DeepSeek Harness `0.1.1-rc.2`。
- 默认的逐 session JSONL 持久化后端（`.jsonl.zstd` 或 `.jsonl`）。共享 SQLite 后端没有独立 session 文件，插件会明确拒绝，避免不安全改库。
- 支持 DSH 所用 Zstandard API 的 Node.js；DSH 官方支持的 Node 运行时已经具备。

## 安装

```sh
dsh plugin --profile web add github:Unintendedz/dsh-session-workspace
```

安装后重启 DSH Web 进程。包内的 `cordis.patch.yml` 会同时挂载 trusted-host RPC 和浏览器客户端。

## 使用

1. 先切换离开要迁移的 session，让它不再处于活动状态。
2. 打开该 session 的侧边栏菜单。
3. 点击 **移动到其他工作区**。
4. 选择目标工作区并确认。

迁移后 session ID 不变，会出现在目标工作区下；后续 shell、文件系统和 sandbox 操作都会使用目标工作区路径。

## 开发验证

```sh
npm test
npm pack --dry-run
```

测试使用真实临时文件和 Node Zstandard codec，覆盖成功迁移、备份、活动 session 拒绝、目标冲突、修订竞态、失败回滚、RPC 返回和侧边栏 session 定位。

## 许可证

MIT

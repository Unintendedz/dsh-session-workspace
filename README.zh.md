# dsh-session-workspace

[English](./README.md) | 中文

把现有 DeepSeek Harness session 移动到另一个已注册工作区，同时保持 session ID 和对话历史不变。

插件提供两个入口：会话 **⋯ → 移动到其他工作区 → 选择目标**，以及把会话行拖到目标工作区的文件夹／标题行。两个入口共用经过 DSH 认证的迁移接口，保留原会话 ID 和完整事件历史，更新持久化的 `cwd` 与工作区归属。旧代际文件保留在会话索引目录外的备份中。

## 安全设计

- 只允许迁移没有 Host Agent 或打开写入句柄的冷 session。DSH `0.2.0-rc.2` 切换到其他 session 不会关闭这些资源。
- 目标必须是 DSH 中已经注册的现有工作区。
- 绝不覆盖目标位置已有的 session 文件。
- 提交前会再次核对源文件修订；准备期间发生变化会直接拒绝。
- 移动期间持有源位置和目标位置的原生写入锁，排除其他 DSH 写入者。
- 所有原始代际文件都会持久备份到 `<DSH_HOME>/session-workspace-backups/<uuid>/`。
- 如果更新工作区账本失败，文件和原工作区归属都会自动回滚。

## 要求

- V4 后端和两个侧边栏入口支持 DeepSeek Harness `0.2.0-rc.2`，通过第一方 `@deepseek-ai/dsh-session-format-catalog` 校验准备好的完整日志；原有 V3 原生迁移分支与 `0.1.5` 的有限菜单兼容路径保留。
- 已发布的 `v0.2.0` tag 针对 DSH `0.1.5-rc.1`；在 DSH `0.2.0-rc.2` 上请使用包含 V4 修改的源码版本。DSH `0.1.1-rc.2` 请继续使用插件 `0.1.1`。
- 默认的逐 session JSONL 持久化后端（`.jsonl.zstd` 或 `.jsonl`）。共享 SQLite 后端没有独立 session 文件，插件会明确拒绝，避免不安全改库。
- 支持 DSH 所用 Zstandard API 的 Node.js；DSH 官方支持的 Node 运行时已经具备。

## 安装

```sh
npm ci
npm run build
npm pack
dsh plugin --profile web add ./dsh-session-workspace-0.2.2.tgz
```

官方桌面应用请改用 `--profile desktop`。

安装后重启 DSH Web 进程。包内的 `cordis.patch.yml` 会同时挂载 trusted-host RPC 和浏览器客户端。

## 更新

安装构建后的归档并重新加载 profile。原生迁移分支支持 V3 与 V4 的 JSONL generation 和 write-lease hook。V4 使用第一方格式 catalog，因为新版持久化后端已不再提供 `createRestore`。压缩文件逐帧完整解码，准备好的完整文件在发布前重新验证；身份认证和 trusted-host 检查仍由 DSH 执行。未来存储版本需要重新检查兼容性。

## 使用

1. 待迁移会话必须是没有 Host Agent 或打开写入句柄的冷会话。DSH `0.2.0-rc.2` 切换到其他会话只释放界面引用，不会关闭 Host Agent 和写入句柄；在正常、安全地重启 DSH 后，请先移动，再打开该会话。
2. 任选一个入口：
   - **菜单：** 打开该会话的 **⋯**，点击 **移动到其他工作区**，选择目标工作区并确认。
   - **拖动：** 在按工作区分组的侧边栏中，把会话行拖到目标工作区的文件夹／标题行后松手；结果或拒绝原因会以提示显示。

同工作区内的会话排序、工作区分组拖动仍由 DSH 处理。平铺列表没有工作区拖放目标，请使用菜单。

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

将 `DSH_NATIVE_ROOT` 指向包含 `node_modules` 的已安装 DSH 包根目录，可运行原生持久化与真实持久工作区账本测试：

```sh
DSH_NATIVE_ROOT=/path/to/installed/dsh node --expose-internals --test tests/*.test.mjs
```

测试自行创建临时会话／存储根目录。真实账本测试会重建整个服务栈，检查重启后的 ID、完整历史、归属、置顶／归档状态和后续写入。DOM 测试覆盖两个入口、原生排序透传、重复拖放抑制、可见拒绝与卸载清理。

测试使用真实临时文件和 Node Zstandard codec，覆盖成功迁移、备份、活动 session 拒绝、目标冲突、修订竞态、失败回滚、RPC 返回和侧边栏 session 定位。

## 许可证

MIT

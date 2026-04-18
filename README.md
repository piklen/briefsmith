# Prompt Skill Runtime

本项目当前已经从“本地 prompt 采集菜单栏应用”收敛为一个 **skill-first 的 Prompt Memory / Prompt Compiler 运行时**。

当前目标不是先做 GUI，而是先把下面这条链路做实：

`本地历史 prompt 导入 -> 查找 / 收藏 -> 用户 profile 刷新 -> 模糊输入编译`

## 当前能力

- 导入本地已落盘的历史 prompt
  - `Codex`
  - `Claude Code`
  - `OpenCode`
  - `Gemini`（当前仅支持可解析的 JSON / JSONL）
- 本地 SQLite 存储
- `find / show / star / unstar`
- `favorites list`
- `tags add / remove / list`
- `profile show / profile refresh`
- `compile`
- `start / stop`
- `doctor`

## 运行环境

- Node.js `>= 22.13.0`
- npm `>= 10`

当前开发环境已验证通过：

- Node.js `v25.9.0`
- npm `11.12.1`

## 安装依赖

```bash
npm install
```

## 构建

```bash
npm run build
```

可执行入口：

```bash
node dist/src/cli/index.js
```

## 常用命令

### 检查环境

```bash
node dist/src/cli/index.js doctor
```

### 导入历史 prompt

```bash
node dist/src/cli/index.js import
```

### 查找历史 prompt

```bash
node dist/src/cli/index.js find "优化"
```

### 查看某条 prompt

```bash
node dist/src/cli/index.js show <prompt-id>
```

### 收藏 / 取消收藏

```bash
node dist/src/cli/index.js star <prompt-id>
node dist/src/cli/index.js unstar <prompt-id>
```

### 查看收藏列表

```bash
node dist/src/cli/index.js favorites list
```

### 管理 tags

```bash
node dist/src/cli/index.js tags add <prompt-id> <tag>
node dist/src/cli/index.js tags remove <prompt-id> <tag>
node dist/src/cli/index.js tags list <prompt-id>
```

### 刷新用户 profile

```bash
node dist/src/cli/index.js profile refresh
```

### 编译当前输入

```bash
node dist/src/cli/index.js compile "优化这个导入逻辑，不要改变外部命令行为，输出一个 superpowers 可直接消费的任务说明" --framework superpowers
```

每次 `compile` 都会写入本地 `compile_sessions`，用于后续调试和复盘。

支持的 framework 输出：

- `plain`
- `superpowers`
- `gsd`
- `gstack`

### 当前项目停用 / 启用 prompt 检查

```bash
node dist/src/cli/index.js stop
node dist/src/cli/index.js start
```

## 数据目录

macOS 默认数据目录：

```text
~/Library/Application Support/PromptSkill/
```

当前会写入：

- `skill.db`

当前项目级策略文件：

```text
.prompt-skill/config.json
```

## 测试

```bash
npm test
npm run check
npm run build
```

## 当前边界

- 只读取本地已落盘的会话/日志数据
- 不做键盘监听
- 不做 Accessibility 输入拦截
- 不做屏幕 OCR
- 不做云同步
- Gemini 当前只支持可解析的结构化 JSON / JSONL 历史数据；本机现状下未发现可直接导入的历史文件

## 下一步

接下来优先做：

1. host adapter 安装与诊断
2. 更完整的 `compile -> clarify -> render` 闭环
3. tags / favorites / framework output 的进一步完善
4. Claude Code / Codex 的接入模板

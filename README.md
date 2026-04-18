# Prompt Skill Runtime

本项目当前已经从“本地 prompt 采集菜单栏应用”收敛为一个 **skill-first 的 Prompt Memory / Prompt Compiler 运行时**。

当前目标不是先做 GUI，而是先把下面这条链路做实：

`本地历史 prompt 导入 -> 查找 / 收藏 -> 用户 profile 刷新 -> preflight 追问或编译 -> host adapter 消费`

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
- `preflight`
- `start / stop`
- `doctor`
- host adapters
  - `Claude Code`
  - `Codex`
  - `OpenCode`（首版为命令 / 指令型接入，不声明官方 hook）

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

## 快速开始

```bash
npm install
npm run build
node dist/src/cli/index.js import
node dist/src/cli/index.js profile refresh
node dist/src/cli/index.js preflight "优化一下这个导入逻辑" --host codex --json
```

`preflight` 会返回三类动作：

- `ask`：信息不足，应该先问用户。
- `compile`：信息足够，使用 `compiledPrompt` 作为执行前上下文。
- `skip`：当前项目已通过 `prompt stop` 关闭 prompt 检查。

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

### 执行前 preflight

```bash
node dist/src/cli/index.js preflight "优化一下这个导入逻辑" --host codex --json
node dist/src/cli/index.js preflight "优化一下这个导入逻辑" --host opencode --framework superpowers --json
```

`preflight` 是给 Codex / OpenCode / 其他 host adapter 使用的稳定入口。它会先检查项目策略，再检索历史 prompt、读取用户 profile，并决定是追问还是生成可执行上下文。

### 查看 compile 历史

```bash
node dist/src/cli/index.js compile latest
node dist/src/cli/index.js compile history
node dist/src/cli/index.js compile show <compile-session-id>
```

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

### 安装 host adapters

```bash
node dist/src/cli/index.js adapters list
node dist/src/cli/index.js adapters install claude --scope project
node dist/src/cli/index.js adapters install codex --scope project
node dist/src/cli/index.js adapters install opencode --scope project
node dist/src/cli/index.js adapters doctor
```

当前 adapter 形态：

- `claude`：项目级 `.claude/settings.json` hook + skill 模板。
- `codex`：项目级 `AGENTS.md` 托管块，或全局 Codex skill。
- `opencode`：项目级 `.opencode/prompt-memory.md` 或全局 `~/.config/opencode/prompt-memory.md` 指令文件。它是 command-first 接入，需要在 OpenCode 指令体系中加载或粘贴该文件。

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

1. 让 OpenCode adapter 从指令型接入升级到可检测的官方入口（如果当前版本提供稳定 hook）。
2. 给 `preflight` 增加更多可解释的命中证据。
3. 把用户风格学习沉淀为可读的 profile 文档。
4. 增加面向发布的安装脚本和 release 包装。

# Prompt Skill Runtime

本项目当前已经从“本地 prompt 采集菜单栏应用”收敛为一个 **Prompt Quality Gate / Task Brief Compiler**。

它解决的核心问题不是“prompt 写得够不够漂亮”，而是：

- 用户给 AI 的输入经常只有模糊意图，例如“帮我优化”。
- AI 真正需要的是可执行任务说明，而不是一句未展开的口语化请求。
- 如果能从历史、profile 和项目上下文里高置信补全，就直接补全。
- 如果仍然缺关键信息，就应该明确追问，而不是让 AI 瞎猜。

因此这个项目的当前目标，是把下面这条链路做实：

`本地历史 prompt 导入 -> 查找 / 收藏 -> 用户 profile 刷新 -> preflight 追问或编译 -> host adapter 消费`

更准确地说：

- `import / find / favorites / profile` 是输入质量增强的支撑能力。
- `compile / preflight / adapters` 才是产品主链路。
- 这个仓库的核心价值是把模糊用户输入压缩成更稳定、更低歧义的执行前 brief。

当前 skill-first 打包约定：

- `[.agents/skills/prompt-memory/SKILL.md](/Library/Code/AI/prompt/.agents/skills/prompt-memory/SKILL.md)` 是仓库内唯一权威 skill 源。
- `templates/*` 是从 canonical skill 派生出来的宿主快照，不再作为手写真源维护。
- `prompt adapters install <host>` 和 `prompt adapters install all` 负责自动落盘宿主侧配置；如缺少运行时产物，会先自动执行 `npm run build`。

详细定位说明见：

- `docs/superpowers/specs/2026-04-18-prompt-skill-runtime-design.md`
- `docs/superpowers/specs/2026-04-19-prompt-quality-gate-positioning-design.md`

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
- `policy show / mode / threshold`
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

同时会返回 `evidence`，用于解释这次判断为什么成立：

- `policyMode`：当前项目策略模式
- `initialMissingSlots`：最初检测到缺失的槽位
- `unresolvedSlots`：到 preflight 结束仍未解决的槽位
- `lowConfidenceSlots`：已自动补全且置信度低于当前槽位阈值的槽位
- `confidenceThreshold`：当前 host 的默认追问阈值
- `slotConfidenceThresholds`：当前 host 每个槽位使用的置信度阈值
- `confidenceGateApplied`：这次是否真的按低置信度规则拦截并追问
- `resolvedSlotSources`：每个已补全槽位来自 `input / history / heuristic / default`
- `resolvedSlotConfidence`：每个已补全槽位的置信度，范围 `0-1`
- `historyMatchCount`：本次命中的历史 prompt 数量
- `historyMatches`：命中的历史 prompt 摘要数组，包含 `id / tool / preview`

当前默认阈值：

- `cli`: `0`
- `claude`: `0.65`
- `codex`: `0.7`
- `opencode`: `0.75`

可以在项目级策略文件里覆盖：

```json
{
  "enabled": true,
  "mode": "suggest",
  "hostConfidenceThresholds": {
    "codex": 0.6,
    "opencode": 0.8
  },
  "hostSlotConfidenceThresholds": {
    "codex": {
      "success_criteria": 0.55
    }
  }
}
```

语义约定：

- `hostConfidenceThresholds.<host>` 是该 host 的默认阈值。
- `hostSlotConfidenceThresholds.<host>.<slot>` 可以覆盖某个槽位。
- 当你执行 `prompt policy threshold codex 0.62` 时，Codex 的默认槽位阈值会一起刷新到 `0.62`。
- 当你再执行 `prompt policy threshold codex success_criteria 0.58` 时，只覆盖 `success_criteria`，其他槽位保持默认值。
- `prompt start` / `prompt stop` 只切换 `enabled` 和 `mode`，不会清掉你已经设置的 host / slot 阈值。
- `mode = "auto-compile"` 会绕过低置信度追问，但不会隐藏 `lowConfidenceSlots` 和相关证据。

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

默认编译原则：

- 保留用户明确写出的边界，例如“不要改外部行为”“保持 API 不变”。
- 优先复用命中的历史 prompt 和用户 profile，不重复追问已经稳定的信息。
- 只有缺少真正影响执行结果的约束时才追问。
- `auto-compile` 只放宽拦截，不篡改 evidence，方便 host adapter 继续做自己的提示或审计。

如果你在接 host adapter，推荐直接消费 JSON 输出里的这几个字段：

- `action`
- `questions`
- `compiledPrompt`
- `resolvedSlots`
- `usedHistoryIds`
- `evidence`

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

### 查看和修改项目策略

```bash
node dist/src/cli/index.js policy show
node dist/src/cli/index.js policy mode off
node dist/src/cli/index.js policy mode suggest
node dist/src/cli/index.js policy mode auto-compile
node dist/src/cli/index.js policy threshold codex 0.62
node dist/src/cli/index.js policy threshold codex success_criteria 0.58
```

适用场景：

- `mode off`：当前项目完全停用 prompt 检查。
- `mode suggest`：低置信度时优先追问。
- `mode auto-compile`：始终编译，但 evidence 里保留低置信度提示，适合 host 自己决定是否再追问。

### 安装 host adapters

```bash
node dist/src/cli/index.js adapters list
node dist/src/cli/index.js adapters install all --scope project
node dist/src/cli/index.js adapters install claude --scope project
node dist/src/cli/index.js adapters install codex --scope project
node dist/src/cli/index.js adapters install opencode --scope project
node dist/src/cli/index.js adapters doctor
```

当前 adapter 形态：

- `claude`：项目级 `.claude/settings.json` hook + canonical skill 安装。
- `codex`：项目级 `AGENTS.md` 托管块，或全局 Codex skill。
- `opencode`：项目级 `.opencode/prompt-memory.md` 或全局 `~/.config/opencode/prompt-memory.md` 指令文件。

安装说明：

- `install all` 会在当前项目里一次性安装 `Claude + Codex + OpenCode`。
- 如果 `dist/src/cli/index.js` 或 `dist/src/host/claude/hook-entry.js` 缺失，安装命令会自动先执行 `npm run build`。

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

## 开源协作

- 许可证：`MIT`，见 [`LICENSE`](/Library/Code/AI/prompt/LICENSE)
- 贡献说明：见 [`CONTRIBUTING.md`](/Library/Code/AI/prompt/CONTRIBUTING.md)
- 安全披露：见 [`SECURITY.md`](/Library/Code/AI/prompt/SECURITY.md)
- 协作规范：见 [`CODE_OF_CONDUCT.md`](/Library/Code/AI/prompt/CODE_OF_CONDUCT.md)

GitHub Actions 会在 `push` 和 `pull_request` 上执行：

- `npm test`
- `npm run check`
- `npm run build`

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

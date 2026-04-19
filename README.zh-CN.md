# Briefsmith

[English](README.md) | [简体中文](README.zh-CN.md)

> 一个把模糊用户请求转换成可执行任务说明的 prompt quality gate，面向 AI coding hosts。

Briefsmith 用在 Codex、Claude Code、OpenCode 这类宿主前面，在真正执行前先判断“这句话到底够不够执行”。

当用户只说一句“帮我优化”时，Briefsmith 会先回答三个问题：

1. 这条请求是否已经足够明确，可以高置信直接执行？
2. 是否可以用本地 prompt 历史、profile 推断和项目策略把缺失上下文补齐？
3. 如果还是不够，宿主最少应该追问什么？

所以它不是一个单纯“润色 prompt”的工具，而是一个执行前置层。

## 为什么做这个

很多 AI 输出质量差，并不是模型能力不够，而是任务描述本身太弱。

常见失败路径：

- 用户给的是模糊意图
- 宿主 AI 自行猜测目标或约束
- 关键边界条件丢失
- 最终输出看起来合理，但其实做错了事

Briefsmith 的作用就是在执行前，先尽量用本地上下文把这段差距补上。

## 核心流程

```text
local prompt history
-> retrieval and reuse
-> profile inference
-> project policy check
-> ask / compile / skip
-> host AI execution
```

## 能力概览

| 能力 | 作用 |
| --- | --- |
| `import` / `find` / `show` / favorites / tags | 把本地 prompt 历史变成可复用上下文 |
| `profile refresh` | 从历史 prompt 中推断用户长期偏好 |
| `compile` | 把原始意图编译成更可执行的任务 brief |
| `preflight` | 判断宿主应该追问、编译还是跳过 |
| `policy` / `start` / `stop` | 控制项目级行为和置信度阈值 |
| `adapters` | 安装 Claude Code、Codex、OpenCode 的接入层 |

打包约定：

- [`.agents/skills/prompt-memory/SKILL.md`](.agents/skills/prompt-memory/SKILL.md) 是唯一权威 skill 源
- `templates/*` 是派生出来的宿主快照，不是手写真源
- `briefsmith adapters install <host>` 在需要时会自动构建运行时产物

## 快速开始

### 安装

```bash
npm install -g briefsmith
briefsmith --help
```

单次使用：

```bash
npx briefsmith --help
```

### 跑通主链路

```bash
briefsmith import
briefsmith profile refresh
briefsmith preflight "优化这个导入流程，但不要改变外部行为" --host codex --json
```

### 安装宿主适配层

```bash
briefsmith adapters install all --scope project
briefsmith adapters doctor
```

## `preflight` 是怎么工作的

`preflight` 是宿主适配层最重要的稳定入口。

它会返回三种动作：

| 动作 | 含义 |
| --- | --- |
| `ask` | 关键执行信息仍然缺失，应该先追问 |
| `compile` | 上下文足够，可以生成更强的任务说明 |
| `skip` | 当前项目已经关闭 prompt 检查 |

示例：

```bash
briefsmith preflight "optimize this import flow" --host codex --json
```

主要输出字段：

| 字段 | 含义 |
| --- | --- |
| `action` | `ask`、`compile` 或 `skip` |
| `questions` | 建议宿主向用户追问的问题 |
| `compiledPrompt` | `compile` 时生成的任务说明 |
| `resolvedSlots` | 本次补齐的任务槽位 |
| `usedHistoryIds` | 本次使用到的历史 prompt |
| `evidence` | 为什么 Briefsmith 会做出这个判断 |

最重要的 evidence 字段：

| 字段 | 含义 |
| --- | --- |
| `policyMode` | 当前项目策略模式 |
| `initialMissingSlots` | 补全前缺失了什么 |
| `unresolvedSlots` | 补全后仍然缺失什么 |
| `lowConfidenceSlots` | 已补全但置信度仍低于阈值的槽位 |
| `historyMatchCount` | 命中的历史 prompt 数量 |
| `resolvedSlotSources` | 每个槽位来自哪里 |
| `resolvedSlotConfidence` | 每个槽位的置信度 |

## Host Adapters

| 宿主 | 接入形态 |
| --- | --- |
| Claude Code | 项目级 `.claude/settings.json` hook 加 canonical skill 安装 |
| Codex | `AGENTS.md` 托管块，或者全局 Codex skill 安装 |
| OpenCode | 项目级 `.opencode/prompt-memory.md` 或全局 `~/.config/opencode/prompt-memory.md` 指令文件 |

相关命令：

```bash
briefsmith adapters list
briefsmith adapters install claude --scope project
briefsmith adapters install codex --scope project
briefsmith adapters install opencode --scope project
briefsmith adapters doctor
```

## 项目策略

项目级策略文件位置：

```text
.prompt-skill/config.json
```

示例：

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

策略模式：

| 模式 | 含义 |
| --- | --- |
| `off` | 当前项目禁用 prompt 检查 |
| `suggest` | 置信度不足时优先追问 |
| `auto-compile` | 始终编译，但保留低置信度证据 |

常用命令：

```bash
briefsmith policy show
briefsmith policy mode suggest
briefsmith policy threshold codex 0.62
briefsmith policy threshold codex success_criteria 0.58
briefsmith start
briefsmith stop
```

语义说明：

- `briefsmith start` 和 `briefsmith stop` 只会切换 `enabled` 和 `mode`
- 不会清掉你已经设置的 host 阈值和槽位阈值
- `briefsmith policy threshold codex 0.62` 会更新 Codex 的默认阈值
- `briefsmith policy threshold codex success_criteria 0.58` 只覆盖这个槽位

## CLI 概览

### 历史检索

```bash
briefsmith import
briefsmith find "优化"
briefsmith show <prompt-id>
briefsmith star <prompt-id>
briefsmith unstar <prompt-id>
briefsmith favorites list
briefsmith tags add <prompt-id> <tag>
briefsmith tags remove <prompt-id> <tag>
briefsmith tags list <prompt-id>
```

### Profile 与编译

```bash
briefsmith profile show
briefsmith profile refresh
briefsmith compile "优化这个导入逻辑，不要改变外部行为" --framework superpowers
briefsmith compile latest
briefsmith compile history
briefsmith compile show <compile-session-id>
briefsmith preflight "优化一下这个导入逻辑" --host codex --json
```

### 健康检查

```bash
briefsmith doctor
briefsmith adapters doctor
```

支持的 framework 渲染器：

- `plain`
- `superpowers`
- `gsd`
- `gstack`

## 本地开发

要求：

- Node.js `>= 22.13.0`
- npm `>= 10`

当前开发机已验证：

- Node.js `v25.9.0`
- npm `11.12.1`

本地运行：

```bash
npm install
npm run build
node dist/src/cli/index.js --help
```

验证命令：

```bash
npm test
npm run check
npm run build
npm run pack:check
```

## 数据存储

macOS 默认数据目录：

```text
~/Library/Application Support/PromptSkill/
```

当前会写入：

- `skill.db`

## 发布流程

本仓库使用 Changesets 管理版本和 npm 发布。

贡献者流程：

```bash
npm run changeset
```

维护者流程：

1. 把带 changeset 的功能分支合并到 `main`
2. GitHub Actions 自动打开或更新 version PR
3. 合并 version PR 后发布到 npm，并生成 git tag
4. 发布工作流会串行化，避免 `main` 上并发发布

需要配置的 GitHub Secret：

- `NPM_TOKEN`

## 当前边界

- 只读取本地已落盘的会话或日志数据
- 不做键盘监听
- 不做 Accessibility 输入拦截
- 不做屏幕 OCR
- 不做云同步
- Gemini 当前只支持可解析的 JSON 或 JSONL 历史数据

## 文档与项目文件

- 产品定位：[`docs/superpowers/specs/2026-04-19-prompt-quality-gate-positioning-design.md`](docs/superpowers/specs/2026-04-19-prompt-quality-gate-positioning-design.md)
- 运行时设计：[`docs/superpowers/specs/2026-04-18-prompt-skill-runtime-design.md`](docs/superpowers/specs/2026-04-18-prompt-skill-runtime-design.md)
- 许可证：[`LICENSE`](LICENSE)
- 贡献说明：[`CONTRIBUTING.md`](CONTRIBUTING.md)
- 安全披露：[`SECURITY.md`](SECURITY.md)
- 协作规范：[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)

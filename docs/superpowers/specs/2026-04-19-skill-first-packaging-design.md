# Skill-First Packaging 设计

## 1. 目标

把当前项目进一步收敛成一个 **skill-first 的本地 runtime**：

- 仓库内有一份权威 `prompt-memory` skill 源。
- 宿主侧产物从这份 skill 源派生，而不是手写多份近似文案。
- 最终用户通过自动化命令完成安装，不需要手工复制 skill 或拼接 hook 配置。

一句话定义：

`canonical skill source -> host-specific render -> automatic install`

## 2. 已确认约束

- `.agents/skills/prompt-memory/` 是项目正式内容，不是临时目录。
- 第一阶段正式支持：
  - `Codex`
  - `Claude`
  - `OpenCode`
- `Gemini` 当前保留历史导入能力，但不纳入第一阶段 skill 安装闭环。
- 安装体验以“越简单越好”为优先目标。
- CLI 入口继续保留 `prompt adapters install <host>`。
- 需要新增一键安装能力，避免用户逐个宿主执行。

## 3. 现状问题

当前仓库里有三类重复表达：

- canonical-like skill：`.agents/skills/prompt-memory/SKILL.md`
- 宿主模板：`templates/codex/*`、`templates/claude/*`、`templates/opencode/*`
- 宿主安装逻辑：`src/host/*/install.ts`

问题不在“文件多”，而在“真源不唯一”：

- 多份 `SKILL.md` 会逐渐漂移。
- 产品定位升级后，容易漏改某个宿主模板。
- 用户看到的安装结果，可能落后于项目真实能力。

## 4. 设计结论

### 4.1 单一真源

`.agents/skills/prompt-memory/SKILL.md` 作为唯一权威 skill 源。

这里定义：

- 触发条件
- 核心职责
- 边界
- 对“模糊输入 -> 可执行 brief”这件事的统一描述

### 4.2 宿主派生层

宿主产物不再各自维护完整 skill 文案，而是从 canonical skill 源派生：

- `Codex`
  - global skill：直接安装 canonical skill
  - project rules：在 `AGENTS.md` 受管块中注入 host-specific runtime 使用说明
- `Claude`
  - project/global skill：直接安装 canonical skill
  - hook 配置继续由安装器维护
- `OpenCode`
  - project/global instructions：复用 canonical skill 的主体说明，并附加 host-specific runtime 步骤

### 4.3 自动安装

CLI 保持面向终端用户的简单体验：

- `prompt adapters install claude`
- `prompt adapters install codex`
- `prompt adapters install opencode`
- `prompt adapters install all`

`install all` 会在当前项目里安装全部第一阶段支持的宿主产物。

### 4.4 自动构建保障

安装命令依赖 `dist/` 中的 runtime 文件：

- `dist/src/cli/index.js`
- `dist/src/host/claude/hook-entry.js`

因此安装前应自动检查构建产物：

- 若产物存在，直接安装。
- 若产物缺失，自动执行 `npm run build`。
- 若构建后仍缺失产物，明确报错。

这一步的目标是减少“还要先手工 build 一次”的额外认知负担。

## 5. 文件职责调整

### 5.1 新的职责划分

- `.agents/skills/prompt-memory/SKILL.md`
  - 唯一 skill 真源
- `src/host/prompt-memory-skill.ts`
  - 读取 canonical skill
  - 渲染 Codex / Claude / OpenCode 产物
- `src/host/runtime-build.ts`
  - 确保安装前所需运行时产物存在
- `src/host/*/install.ts`
  - 只负责落盘和安全更新用户文件
- `templates/*`
  - 仓库内保留的派生产物快照，用于验证与打包

### 5.2 模板的地位

`templates/*` 不再被当作人工维护的真源，而是 canonical skill 的派生快照。

这意味着：

- 安装逻辑不应依赖手写模板文本。
- 测试需要验证模板快照与 renderer 输出一致，避免漂移。

## 6. 测试策略

需要覆盖三类风险：

### 6.1 单一真源是否成立

验证 renderer 输出与仓库内模板快照一致，避免 canonical skill 更新后宿主产物未同步。

### 6.2 自动安装是否完整

验证 `install all` 能写出：

- `AGENTS.md` 受管块
- `.claude/settings.json`
- `.claude/skills/prompt-memory/SKILL.md`
- `.opencode/prompt-memory.md`

### 6.3 自动构建是否可靠

验证：

- 构建产物已存在时不重复 build
- 缺失时会触发 build
- 无法构建时明确失败

## 7. 非目标

这一轮不做：

- Gemini skill 安装
- GUI 打包
- 发布到外部 marketplace
- 改动 compile/preflight 的判定语义

本轮只解决两个核心问题：

1. skill 真源统一
2. 安装体验简化

## Project Context

本项目的真实目标不是“功能很多的 prompt 工具”，也不是回到早期的菜单栏采集应用方向。

它当前要做的是一个 **AI Coding Request Preflight / Request Compiler**：

- 用户输入经常只是模糊意图，例如“帮我优化”。
- AI 真正需要的是可执行 coding brief，而不是一句未展开的口语化请求。
- 本项目要在 agent 真正动手前，决定是 ask、compile，还是 skip。
- 历史 prompt、用户 profile、项目策略和最小必要追问，都是为了让这个 preflight 决策更稳。

核心链路：

`历史 prompt 导入 -> 检索复用 -> profile 推断 -> slot 检测/补全 -> ask / compile / skip -> host/framework 渲染 -> 宿主 AI 消费`

产品原则：

- 能高置信补全的，就补全。
- 不能确认的，就明确追问，不替用户擅自拍板。
- 目标是提升请求可执行性和执行正确率，不是把 prompt 改写得更长。
- `import / find / favorites / profile` 都是支撑信号，核心产品价值在 `preflight / compile / adapter` 这条链路。

当前已落地的核心槽位：

- `target`
- `problem_signal`
- `success_criteria`
- `constraints`
- `verification`
- `output_format`

后续优先补强方向：

- `non_goals`
- `scope`
- `risk_boundary`

## Git Workflow

从 2026-04-19 起，这个仓库默认采用分支开发流程：

- 不要直接在 `main` 上开发、提交或堆叠新功能。
- 开始任何新开发前，先从最新 `main` 拉出功能分支。
- 在功能分支上完成实现、验证、提交和推送。
- 确认无误后，再把功能分支合并回 `main`。
- 功能分支合并完成后，远端只保留 `main`；已合并的远端功能分支应及时删除。

<!-- prompt-skill:start -->
## Prompt Skill Runtime

When the user request is vague, under-specified, or refers to earlier good prompts:

1. Check `.prompt-skill/config.json` if it exists. If prompt checks are disabled for this project, do not force preflight or compilation.
2. Use `node dist/src/cli/index.js preflight "<raw input>" --host codex --json` to decide whether to ask, compile, or skip before acting.
3. If `action` is `ask`, ask only the returned follow-up questions before executing.
4. If `action` is `compile`, treat `compiledPrompt` as additional execution context before you act.
5. Use `node dist/src/cli/index.js find "<query>"` when the user is trying to recover a previous prompt.
6. Preserve explicit user boundaries like "不要改外部行为" or "keep API unchanged".
<!-- prompt-skill:end -->

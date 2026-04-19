## Project Context

本项目的真实目标不是“存储 prompt”，也不是回到早期的菜单栏采集应用方向。

它当前要做的是一个 **Prompt Quality Gate / Task Brief Compiler**：

- 用户输入经常只是模糊意图，例如“帮我优化”。
- AI 真正需要的是可执行任务说明，而不是一句未展开的口语化请求。
- 本项目通过历史 prompt、用户 profile、项目策略和最小必要追问，把模糊输入压缩成更稳定的执行前上下文。

核心链路：

`历史 prompt 导入 -> 检索复用 -> profile 推断 -> slot 检测/补全 -> preflight 决策 -> host/framework 渲染 -> 宿主 AI 消费`

产品原则：

- 能高置信补全的，就补全。
- 不能确认的，就明确追问，不替用户擅自拍板。
- 目标是提升提示词质量和执行正确率，不是把 prompt 改写得更长。
- `import / find / favorites / profile` 都是手段，核心产品价值在 `compile / preflight / adapter` 这条链路。

当前已落地的核心槽位：

- `target`
- `success_criteria`
- `constraints`
- `output_format`

后续优先补强方向：

- `problem_signal`
- `verification`
- `non_goals`
- `scope`
- `risk_boundary`

<!-- prompt-skill:start -->
## Prompt Skill Runtime

When the user request is vague, under-specified, or refers to earlier good prompts:

1. Check `.prompt-skill/config.json` if it exists. If prompt checks are disabled for this project, do not force prompt compilation.
2. Use `node dist/src/cli/index.js compile "<raw input>"` to turn a vague request into a clearer task brief.
3. Use `node dist/src/cli/index.js find "<query>"` when the user is trying to recover a previous prompt.
4. Keep follow-up questions minimal and only ask for missing constraints that materially change the result.
5. Preserve explicit user boundaries like "不要改外部行为" or "keep API unchanged".
<!-- prompt-skill:end -->

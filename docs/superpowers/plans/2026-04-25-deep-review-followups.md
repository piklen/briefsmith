# 2026-04-25 Deep Review Follow-ups

## 背景

这份清单来自 2026-04-25 对 Briefsmith 当前分支的深度审查。

本轮已经修复了三类直接影响信任的问题：

- Claude hook 与 CLI preflight 语义不一致：已补齐 compile session 持久化、history provenance、Claude 项目阈值 gate。
- CLI 非法 `--host` / `--framework` 静默降级：已改为显式失败。
- README 对 `auto-compile` 的语义过度承诺：已改成“绕过低置信度 gate，但关键槽位缺失仍然 ask”。

下面记录的是本轮刻意没有展开的后续工作。它们不是低价值 polish，而是会影响产品可信度、长期维护和开源 adoption 的问题。

## P1：建立 Preflight 决策评测集（已启动）

### 问题

当前 `ask / compile / skip` 的核心判断仍主要依赖正则、固定置信度和少量单元测试。测试能证明已有样例不回归，但还不能证明真实模糊请求下的误判率可接受。

### 风险

- 把低质量启发式包装成可靠决策。
- 过早 compile，导致宿主拿到看似完整但实际猜测过多的 brief。
- ask 太多，让工具变成摩擦源。
- ask 太少，让工具失去 preflight gate 的意义。

### 建议方案

建立 `tests/fixtures/preflight-cases/` 或类似结构，维护一组人工标注样本：

- raw input
- repo/project context
- optional history entries
- policy
- expected action
- expected missing / resolved slots
- expected used history IDs
- reason

再增加一个批量评测测试，要求所有 golden cases 通过。

### 验收标准

- 至少覆盖 vague optimize、bugfix missing symptom、continuation、history enrichment、cross-project history、meta prompt pollution、auto-compile、host threshold。
- 每个 case 都标注为什么应该 ask 或 compile。
- 新增启发式或改阈值时，必须先更新评测样本。

### 当前进展

- 已新增 `tests/compiler/preflight-cases.test.ts`。
- 已新增首批人工标注样本 `tests/fixtures/preflight-cases/cases.json`。
- 后续仍需要继续扩展 auto-compile、host threshold、真实项目上下文等样本。

## P1：收紧 Heuristic Slot 语义（已完成核心拆分）

### 问题

`success_criteria` 和 `verification` 现在会根据关键词生成泛化内容，例如优化类请求默认补“提升可读性、减少重复，并让实现更稳定”。这有帮助，但也容易让 compiled brief 看起来比原始事实更确定。

### 风险

- 用户没有提供真实成功标准时，系统生成一个听起来合理但不可验证的目标。
- 后续 host 可能把 heuristic 当成用户明确要求。
- evidence 里虽然有 confidence，但 compiled prompt 本身没有足够区分“用户明确说的”和“系统推断的”。

### 建议方案

- 在 compiled prompt 的 `Resolved Context` 中标注 slot source 或 confidence，至少对 heuristic/history/default 做可见区分。
- 对低置信 heuristic slot，在 suggest 模式下更倾向 ask，而不是直接 compile。
- 针对 success criteria 拆分“明确成功标准”和“默认优化方向”。

### 验收标准

- 用户明确输入的 slot 和系统推断的 slot 在输出中可区分。
- 模糊请求不会生成看起来像用户事实的成功标准。
- 相关行为进入 preflight golden cases。

### 当前进展

- `compileOrClarify` 生成的 compiled brief 已在 `Resolved Context` 中标注 slot source、confidence 和 history ID。
- heuristic 生成的 `success_criteria` 已在 compiled brief 中显示为 `default_success_direction`，不再伪装成用户明确成功标准。
- 用户明确输入的成功标准仍显示为 `success_criteria [input, confidence 0.96]`。

## P2：补齐 Migration Ledger

### 问题

当前 SQLite migration 是幂等建表 + 按列补 ALTER，没有 schema version 或 migration ledger。

### 风险

- 后续字段语义变化时很难可靠升级。
- 失败到一半无法判断应用了哪些 migration。
- 用户本地历史和 compile session 是产品信任资产，迁移不稳会直接损害采用意愿。

### 建议方案

- 新增 `schema_migrations` 表。
- 每次 schema 变化用独立 migration ID 记录。
- migration 在事务中执行。
- 增加旧 schema fixture 测试，验证从旧数据库升级后的数据语义。

### 验收标准

- 新旧数据库 fixture 都能通过迁移。
- 重复启动不会重复执行已完成 migration。
- migration 失败时不会留下部分升级状态。

## P2：Host 行为矩阵和 Contract

### 问题

Codex、Claude、OpenCode 的接入形态不一样。Claude 是 hook，Codex 是 `AGENTS.md`/skill，OpenCode 是 instructions 文件。README 说支持三个宿主，但用户不容易看出哪些是强集成，哪些是指令式集成。

### 风险

- 用户以为 `adapters install opencode` 后自动生效，但实现只是写 instruction。
- 宿主行为差异隐藏在实现里，外部贡献者不容易维护。

### 建议方案

新增文档表格，明确每个 host 的：

- install artifact
- runtime trigger
- 是否自动执行 preflight
- 是否能 block request
- 是否保存 compile session
- 是否支持 project/global scope
- 已知限制

### 验收标准

- README 或 dedicated docs 中能 30 秒看清三种 host 差异。
- 每个 host 的 doctor 输出与文档一致。
- OpenCode 如果仍是 instruction-only，要明确标注。

## P2：CLI JSON Contract 稳定化

### 问题

`preflight --json` 已经返回很多 evidence 字段，但目前没有独立的 contract 文档或 schema。

### 风险

- host adapter 或外部脚本依赖 JSON 字段后，后续改名会破坏兼容。
- evidence 字段含义容易漂移，尤其是 `historyMatchCount` 实际表示“被使用的 history 数量”，不是所有检索命中数量。

### 建议方案

- 为 `preflight --json` 输出定义 JSON schema 或至少文档化 contract。
- 明确 `historyMatches` 是 used history evidence，不是 raw retrieval hits。
- 增加 contract snapshot 测试，避免无意改字段。

### 验收标准

- README 或 docs 中有稳定字段说明。
- 测试覆盖字段存在性、类型和关键语义。

## P3：开源 Adoption 信息密度

### 问题

项目定位已经比“prompt 工具”清楚，但 skeptical 工程用户仍会问：这比我自己多问一句强在哪里？

### 风险

- 有用但不传播。
- 用户看完 README 觉得概念有道理，但没有立刻安装试用的冲动。

### 建议方案

- 增加一个真实对比案例：raw vague request -> wrong-agent-risk -> Briefsmith ask/compile -> safer execution brief。
- 增加“什么情况不要用 Briefsmith”边界说明。
- 增加“当前成熟度”说明，避免早期项目过度包装。

### 验收标准

- README 首屏 30 秒内能看懂：它拦什么、怎么拦、为什么不是普通 prompt formatter。
- 明确标注当前限制，降低不可信感。

## 下一步建议顺序

1. 先做 Preflight 决策评测集。
2. 再收紧 heuristic slot 输出语义。
3. 然后补 migration ledger。
4. 最后完善 host matrix 和 JSON contract 文档。

理由：评测集是后续所有决策逻辑改动的安全网；没有它，继续调 heuristic 只会扩大“看似聪明但不可验证”的风险。

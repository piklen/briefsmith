# Prompt Skill Runtime 设计

## 1. 目标

把当前项目正式定义为一个 **skill-first 的 Prompt Memory / Prompt Compiler 运行时**，而不是一个以前台可视化为中心的应用。

它解决的核心痛点不是“统计看板”，而是两件更具体的事：

1. 用户曾经写过很好的 prompt，但后来找不到原会话了。
2. 用户现在只会说一句模糊的话，例如“优化一下”，系统需要结合历史、偏好和上下文，把这句话编译成更可执行的 prompt，再交给 AI 主体去执行。

一句话定义：

`历史 prompt 记忆 + 用户风格画像 + 必要追问 + Prompt 编译 + Host/Framework 适配`

## 2. 已确认产品方向

### 2.1 产品定位

本项目是一个 **轻量 skill runtime**：

- 可以全局安装，也可以按项目安装
- 默认启用模糊输入检查
- 支持 `prompt stop` 在当前项目停用自动检查
- 支持历史导入、重扫、查找、收藏、调试
- 运行时主要以命令、skill、hook、配置文件的形式存在
- 不以重量级 GUI 为首版交付中心

### 2.2 采集边界

只采集 **本地已落盘** 的会话 / 日志 / 历史文件：

- `Codex`
- `Claude Code`
- `OpenCode`
- `Gemini`

不做：

- 键盘监听
- 输入法拦截
- Accessibility 级输入捕获
- 屏幕 OCR
- 云端代理转发

### 2.3 真实产品闭环

核心闭环不是“采集完就结束”，而是：

`历史记录 -> 检索复用 -> 推断习惯 -> 当前任务补全 -> 编译高质量 prompt -> 执行结果继续反哺风格模型`

## 3. 为什么不是单纯分析工具

用户最开始的真实诉求已经明确：

- 我以前和大模型说过什么？
- 我之前写过哪些很好的 prompt？
- 我现在能不能把历史经验变成一个可复用的 skill？

所以分析能力只能是派生能力，不能反过来定义产品。

首要能力必须是：

1. `找回`
2. `复用`
3. `编译`
4. `持续学习`

## 4. 与 Superpowers / Gstack / GSD 的关系

本项目不应该成为第 4 套“全栈开发框架”，而应该成为它们共同可复用的 **输入编译层**。

### 4.1 帮助 Superpowers（执行层）

Superpowers 已经擅长：

- 需求澄清
- 计划拆解
- TDD
- 验证
- review

它缺的不是执行流程，而是更干净、更具体的输入。

本项目给它提供：

- 模糊输入预处理
- 历史相似任务补全
- 用户常见边界自动注入
- 只在关键缺口上追问

结果是：更快进入可执行计划，减少前置往返。

### 4.2 帮助 Gstack（决策层）

Gstack 强在：

- 多角色评审
- 产品 / 架构 / QA / 发布视角切换
- 高强度决策校验

它缺的是把同一句模糊用户输入，转换成适合不同角色消费的 briefing。

本项目给它提供：

- 结构化用户意图
- 面向角色的 prompt 渲染
- 历史偏好补全
- 低 token 的压缩上下文

结果是：Gstack 看到的是“结构化任务”，不是原始随口表达。

### 4.3 帮助 GSD（上下文层）

GSD 强在：

- `PROJECT.md`
- `REQUIREMENTS.md`
- `ROADMAP.md`
- `STATE.md`
- `PLAN.md`
- `SUMMARY.md`

它天然适合接收“压缩后的长期上下文”。

本项目给它提供：

- 历史 prompt 的结构化沉淀
- 用户风格与偏好文件
- 某一阶段的补充上下文
- 可复用的 prompt pattern seed

结果是：易漂移的聊天内容，被转成稳定、可恢复、可跨会话复用的上下文资产。

### 4.4 项目在三者之间的精确定位

三句话定性：

- `Superpowers` 负责把事做严谨。
- `Gstack` 负责把事想全面。
- `GSD` 负责把事记清楚。
- 本项目负责把人模糊的话，编译成它们都能高质量消费的输入。

## 5. 外部经验与约束

以下结论基于已查证的近期开源/官方资料：

- Claude Code 官方推荐把长期稳定规则放入记忆文件，把具体工作逻辑放进 skills / hooks，并允许先追问再执行。
- Claude Code 提供 `UserPromptSubmit`、`SessionStart` 等 hook，适合在 prompt 提交前后做检查、补全和后台学习。
- Codex 官方公开资料强调 `AGENTS.md`、环境约束、可组合 CLI 和清晰测试验证，但我没有在本轮查证中找到与 Claude Code 等价的官方 prompt-submit hook。
- Superpowers 强在流程强约束。
- Gstack 强在角色化决策与 QA / ship 流程。
- GSD 强在跨阶段上下文文件体系。

因此本项目的 host 设计必须是：

- Claude Code：走原生 hook / skill / plugin 路线
- Codex：先走 `AGENTS.md + skill + CLI + host adapter` 路线
- 其他 host：采用同样的 adapter 扩展模式

这不影响“全局安装”的用户体验，但意味着内部必须明确区分 **统一运行时** 与 **按 host 适配**。

参考：

- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Memory](https://code.claude.com/docs/en/memory)
- [Superpowers](https://github.com/obra/superpowers)
- [Gstack](https://github.com/garrytan/gstack)
- [GSD](https://github.com/gsd-build/get-shit-done)
- [OpenAI Codex Prompting Guide](https://cookbook.openai.com/examples/gpt-5-codex_prompting_guide)

## 6. 核心设计原则

### 6.1 Skill-first，不做大应用优先

首版先交付：

- 运行时
- CLI
- host adapters
- profile / memory / compiler

GUI 只作为后续可选伴随层。

### 6.2 默认帮助，但不过度打断

默认启用模糊输入检查，但只在以下情况下介入：

- 用户意图明显不完整
- 成功标准缺失
- 风险边界不清晰
- 历史上该类任务有高频遗漏槽位

如果当前输入已经足够明确，就不强制追问。

### 6.3 学习要静默，但权限要收敛

系统可以后台静默更新：

- `inferred`
- `signals`

不能静默篡改：

- `confirmed`
- 高风险执行策略
- 明确的硬边界

### 6.4 历史是资产，不是噪声

历史 prompt 不是简单日志，而是：

- 可检索记忆
- 可收藏模板
- 可提炼风格
- 可作为当前任务补全依据

### 6.5 Host 与 Framework 解耦

必须拆分：

- `Host Adapter`：解决“如何接入 Claude / Codex / OpenCode / Gemini”
- `Framework Adapter`：解决“如何喂给 Superpowers / Gstack / GSD”

否则后续扩展一定耦死。

## 7. 总体架构

系统分为四层。

### 7.1 Core Runtime

核心运行时负责：

- Prompt Memory
- Profile Store
- Intent Clarifier
- Prompt Compiler
- Project Policy
- Background Learner
- Search / Favorites / Tags

这是唯一必须跨 host 共享的核心。

### 7.2 Host Adapter Layer

每个宿主一个适配器：

- `ClaudeCodeAdapter`
- `CodexAdapter`
- 后续：
  - `OpenCodeAdapter`
  - `GeminiAdapter`

职责：

- 安装 skill / hook / config
- 将当前用户输入送入 runtime
- 在当前 host 约束下触发追问或静默补全
- 任务结束后回传结果信号，驱动 profile 更新

### 7.3 Framework Adapter Layer

每个框架一个适配器：

- `SuperpowersAdapter`
- `GstackAdapter`
- `GSDAdapter`

职责：

- 把统一结构化意图渲染为目标框架能最好消费的格式
- 控制 token 量与内容密度
- 输出面向目标框架的 prompt brief / context file / command suggestion

### 7.4 Developer CLI

CLI 是运行时的操作台，主要面向开发者，不以普通终端用户为第一目标。

必须支持：

- 导入历史
- 重扫
- 查找
- 收藏
- 配置开关
- profile 诊断
- adapter 调试

## 8. 建议仓库结构

为保持轻量，首版采用单仓单包，不拆 monorepo。

```text
src/
  cli/
  core/
  profile/
  memory/
  compiler/
  host/
    claude/
    codex/
  frameworks/
    superpowers/
    gstack/
    gsd/
  importers/
  storage/
  config/
  utils/

templates/
  claude/
  codex/

skills/
  prompt-memory/
  prompt-compile/

tests/
  integration/
  fixtures/

docs/
  superpowers/
```

## 9. 技术栈建议

### 9.1 语言与运行时

建议：

- `TypeScript`
- `Node.js 22.13+`

原因：

- 更适合做跨 host CLI / installer / file-based adapter
- 与 Claude Code / Codex / GSD / Superpowers 的生态衔接更自然
- 便于生成和管理模板、配置和 hooks
- Node 22 已提供官方 `node:sqlite` 模块，可减少额外数据库依赖

这里的最后一点是基于 Node 官方文档的推断，采用前仍应在实际开发环境确认版本下限。

### 9.2 持久化

首版使用 `SQLite`，理由：

- 历史检索、去重、收藏、标签、profile、signals 都适合本地关系存储
- 支持全文索引和过滤
- 后续如要补 GUI，不需要迁库

### 9.3 测试

建议：

- `node:test`
- 适量集成测试
- fixture 驱动的 importer / compiler / adapter 测试

不引入复杂测试框架，先保持轻量。

## 10. 核心数据模型

### 10.1 PromptEntry

记录一条用户实际发给 AI 的 prompt。

字段建议：

- `id`
- `tool`
- `project_path`
- `session_id`
- `timestamp`
- `prompt_text`
- `source_file`
- `source_offset`
- `fingerprint`
- `is_favorite`
- `tags`
- `imported_at`

### 10.2 PromptSearchIndex

用于全文检索和相似召回。

首版可以直接使用 SQLite FTS，暂不引入向量库。

### 10.3 UserProfile

分三层：

#### `confirmed`

由用户明确确认，优先级最高，不能静默修改。

字段示例：

- `preferred_language`
- `response_style`
- `execution_preference`
- `risk_boundaries`
- `output_defaults`
- `project_defaults`

#### `inferred`

由历史行为推断，可静默更新，但只能作为软默认值。

字段示例：

- `frequent_task_types`
- `common_missing_slots`
- `preferred_prompt_shapes`
- `context_density_preference`
- `common_quality_constraints`
- `confidence`

#### `signals`

原始观察证据，用于解释为什么得出某个推断。

字段示例：

- 高频关键词
- 常见追问点
- 常见补充约束
- 平均 prompt 长度
- 常用成功标准表达

### 10.4 ProjectPolicy

控制当前项目是否启用自动检查。

字段建议：

- `scope`
  - `global`
  - `project`
- `enabled`
- `mode`
  - `off`
  - `suggest`
  - `auto-compile`
- `updated_at`

`prompt stop` 本质上就是对当前 project policy 写入 `enabled = false`。

### 10.5 CompileSession

记录一次“从原始意图到编译 prompt”的过程。

字段建议：

- `id`
- `raw_input`
- `resolved_slots`
- `follow_up_questions`
- `compiled_prompt`
- `target_framework`
- `target_host`
- `used_history_ids`
- `created_at`

这不是必须长期保留的审计日志，但对调试编译质量很有价值。

## 11. 关键能力设计

### 11.1 历史导入

首版必须导入历史数据。

导入器负责从各 host 落盘目录中抽取：

- prompt 原文
- 时间
- 工具名
- 项目目录
- 会话标识
- 来源文件

并统一落到 `PromptEntry`。

### 11.2 Prompt 查找与收藏

CLI 至少支持：

- `prompt find <query>`
- `prompt show <id>`
- `prompt star <id>`
- `prompt unstar <id>`
- `prompt tags add <id> <tag>`

这是最小可用闭环。

### 11.3 模糊意图识别

系统需要判断当前输入是不是“可以直接执行”的 prompt。

最小判定槽位建议包括：

- 任务目标
- 目标对象
- 成功标准
- 约束 / 边界
- 输出形式

如果这些槽位缺失过多，才进入 clarifier。

### 11.4 Clarifier

Clarifier 的目标不是“把用户教育成 prompt 专家”，而是尽量少打断地补齐必要槽位。

优先级：

1. `confirmed`
2. 高置信 `inferred`
3. 最近相似历史 prompt
4. 仅对无法推断且影响执行结果的缺口发问

### 11.5 Prompt Compiler

Compiler 负责把：

- 原始输入
- profile
- 历史相似 prompt
- 当前项目上下文
- host / framework 约束

合成为更高质量的执行 prompt。

输出不应该是“润色版句子”，而应是：

- 任务目标
- 明确边界
- 成功定义
- 交付格式
- 需要 AI 主体继续做的动作

### 11.6 Background Learner

任务完成后静默更新：

- 这次任务属于什么类型
- 用户后续补充了哪些常见边界
- 哪些槽位总是缺失
- 哪种 prompt 结构成功率更高

但不应静默提升为硬规则。

## 12. Host Adapter 设计

### 12.1 ClaudeCodeAdapter

首发优先级最高。

建议使用：

- `UserPromptSubmit`
- `SessionStart`
- 后台 async hook
- skill / plugin 模板

职责：

- 读取当前 project policy
- 判断是否触发 clarifier / compiler
- 必要时插入极短追问
- 将编译结果传给 Claude Code 主体
- 在 session 结束后静默更新 inferred/signals

### 12.2 CodexAdapter

需要更保守。

当前已查证的官方资料里，没有确认到与 Claude Code 对等的原生 prompt-submit hook。

因此首版路线应是：

- skill
- `AGENTS.md`
- CLI
- host-specific wrapper / command glue

目标不是伪装成“完全透明注入”，而是保证：

- 可安装
- 可复用
- 可关闭
- 可调试

后续如果 Codex 官方开放更强的 hook，再升级到更深集成。

### 12.3 其他 Host

后续加入：

- `OpenCodeAdapter`
- `GeminiAdapter`

采用同样接口：

- 安装
- 采集
- 编译调用
- 后台学习

## 13. Framework Adapter 设计

### 13.1 SuperpowersAdapter

输出：

- 更清楚的 task brief
- 可直接进入 brainstorming / writing-plans 的初始 prompt
- 自动补齐用户常见边界

原则：

- 不重复它已经有的流程控制
- 只提升输入质量

### 13.2 GstackAdapter

输出：

- 面向 CEO / Eng / QA 等角色的压缩 briefing
- 推荐使用哪个 slash command
- 面向 review / qa / ship 的不同视图

原则：

- 控制 token
- 避免把整段历史对话原样灌进去

### 13.3 GSDAdapter

输出：

- `PROJECT.md` 补充
- `STATE.md` 更新片段
- `CONTEXT.md` / `SEEDS.md` 候选内容

原则：

- 把历史 prompt 变成长期上下文资产

## 14. CLI 设计

首版 CLI 命令建议：

```text
prompt import
prompt reindex
prompt find <query>
prompt show <id>
prompt star <id>
prompt unstar <id>
prompt compile "<raw input>"
prompt profile show
prompt profile refresh
prompt start
prompt stop
prompt doctor
prompt adapters list
prompt adapters debug <name>
```

说明：

- `import`：导入历史
- `reindex`：重扫来源并更新索引
- `compile`：离线调试 clarifier / compiler
- `start / stop`：切当前项目策略
- `doctor`：检查 host 安装、hook、生效状态、数据目录
- `adapters debug`：用于开发者排查 host / importer 行为

## 15. 配置与落盘

### 15.1 全局目录

建议：

- macOS：
  - `~/Library/Application Support/PromptSkill/`
- 其他平台后续走 XDG 规范

内容：

- `skill.db`
- `profile.json`
- `config.json`
- `logs/`

### 15.2 项目目录

本地安装时使用：

- `.prompt-skill/config.json`

可以包含：

- 当前项目是否启用
- 当前项目默认 framework
- 项目常见边界
- 本地收藏 prompt 引用

## 16. 安全与隐私

必须坚持：

- 默认纯本地
- 不上传历史 prompt
- 不做远程同步
- 不做隐式云分析
- 不读取超过“本地已落盘会话数据”之外的个人输入源

如果后续要加模型辅助分析，也必须默认走本地或明确二次确认。

## 17. 迭代策略

### Phase 1

先做可用闭环：

- SQLite 存储
- 历史导入
- CLI 查找 / 收藏
- profile 文件
- `prompt compile`

### Phase 2

接入 `ClaudeCodeAdapter`：

- 安装模板
- prompt submit 处理
- 背景学习
- `prompt doctor`

### Phase 3

接入 `CodexAdapter`：

- skill 模板
- `AGENTS.md` 约定
- wrapper / glue
- 项目级开关

### Phase 4

补 `Framework Adapters`：

- `GSDAdapter`
- `SuperpowersAdapter`
- `GstackAdapter`

推荐顺序：

1. GSD
2. Superpowers
3. Gstack

## 18. 风险与开放问题

### 18.1 Codex 深度拦截能力

事实：

本轮没有查到官方等价于 Claude Code `UserPromptSubmit` 的公开能力。

结论：

首版不要把产品设计建立在“Codex 一定支持深度透明注入”这个未经证实的前提上。

### 18.2 过度打断

如果 clarifier 太敏感，会破坏使用体验。

所以需要：

- 高置信补全优先
- 只问关键缺口
- 项目级关闭能力

### 18.3 Profile 过拟合

如果 inferred 过度强化，会把用户困在旧风格里。

所以必须区分：

- `confirmed`
- `inferred`
- `signals`

## 19. 最终结论

本项目接下来的正确方向不是继续做“本地 prompt 采集工具”的 GUI，而是做一个能被多个 AI coding host 和多个工作流框架复用的 **Prompt Skill Runtime**。

它的最小闭环是：

- 导入历史 prompt
- 支持高效检索与收藏
- 沉淀用户 profile
- 在当前输入不完整时自动补齐或追问
- 生成适合目标 host / framework 消费的高质量 prompt

这条线同时解决：

- prompt 找回
- prompt 复用
- prompt 提升
- 用户风格沉淀
- 跨框架输入增强

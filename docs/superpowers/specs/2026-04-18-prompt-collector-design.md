# 本地 AI Prompt 采集菜单栏应用设计

> **状态：已被新的 skill-first 方案取代。**
>
> 这份文档保留为早期思路记录。当前有效方案见：
> `docs/superpowers/specs/2026-04-18-prompt-skill-runtime-design.md`

## 1. 目标

构建一个**本地自用、非沙箱**的 macOS 菜单栏应用，自动收集本机上 `Codex`、`Claude`、`Gemini`、`OpenCode` 等 AI 工具中，**用户发给 AI 的每一次 prompt 原文**，并按以下层级组织：

`工具 -> 项目目录 -> 会话窗口 -> prompt 列表`

首版目标是 Phase A：

- 菜单栏常驻
- 启动后自动导入历史数据
- 后台持续监听来源文件变化并增量导入
- 菜单栏只提供状态、计数、错误和简单修复提示
- 为后续统计分析预留本地派生能力

后续 Phase C 再扩展为带前台浏览界面的完整应用，复用同一套数据库和导入内核。

## 2. 已确认约束

- 只采集**本地已落盘**的会话/日志数据
- **不做键盘监听**、输入监控、屏幕 OCR、Accessibility 输入拦截
- 首版运行形态是**菜单栏常驻 + 后台自动监听**
- 首版需要**导入历史数据**
- 首版存储内容是：
  - `用户 prompt 原文`
  - `工具名`
  - `时间`
  - `项目路径`
  - `会话标识`
  - `来源文件`
- 分组顺序固定为：
  - `工具`
  - `项目目录`
  - `会话窗口`
  - `该窗口下的 prompt`
- 会话层统一抽象为 `session/window`：
  - 能拿到真实窗口标识时使用真实值
  - 拿不到时使用稳定会话标识兜底
- 菜单栏首版展示：
  - 运行状态
  - 各工具采集状态
  - 总 prompt 数
  - 最近同步时间
  - 错误摘要
  - 简单修复建议
- 统计分析默认**只基于本地 prompt 与元数据**完成
- 统计结论必须区分：
  - `事实统计`
  - `规则推断`
  - `不做结论`
- 应用是**本地自用**

## 3. 非目标

首版不做以下能力：

- 不采集 AI 回复内容
- 不做云同步、多设备同步、远程上报
- 不做 Mac App Store 沙箱兼容
- 不做键盘级兜底采集
- 不承诺所有工具 100% 完整支持；无法确认稳定来源时，必须明确标成 `未发现` 或 `暂不支持`
- 不在首版提供完整前台浏览窗口
- 不做不可解释的人格判定、心理画像、MBTI 之类的伪分析

## 4. 总体架构

应用分为五层：

### 4.1 菜单栏应用壳层

负责：

- `MenuBarExtra` 或等价菜单栏入口
- 生命周期管理
- 启动时触发历史导入
- 显示状态、统计、错误和修复建议
- 提供重新扫描、打开数据库目录、打开日志目录、退出等动作

### 4.2 来源适配器层

每个工具一个独立适配器：

- `CodexSourceAdapter`
- `ClaudeSourceAdapter`
- `GeminiSourceAdapter`
- `OpenCodeSourceAdapter`

每个适配器负责：

- 发现本地来源目录和候选文件
- 识别该工具的会话/日志格式
- 提取“用户 prompt 原文”和相关元数据
- 将原始记录映射到统一领域模型

适配器必须彼此隔离。某个工具格式变更或解析失败时，不得拖垮其他来源。

### 4.3 导入编排层

负责：

- 启动时全量扫描
- 增量监听目录/文件变化
- 将解析结果归一化
- 执行去重
- 更新导入检查点
- 汇总导入状态

### 4.4 本地持久化层

使用**SQLite**作为唯一持久化存储，保存：

- prompt 记录
- 会话分组
- 项目目录
- 来源状态
- 导入检查点
- 错误状态

选择 SQLite 的原因：

- 本地单机应用场景足够
- 对层级查询、计数、去重、重启恢复都友好
- Phase C 可以直接复用数据库做浏览界面

### 4.5 诊断与可观测层

负责：

- 结构化日志
- 来源健康状态
- 最近导入摘要
- 错误分类
- 给用户的简单修复建议

## 5. 数据模型

### 5.1 层级模型

标准浏览层级固定为：

1. `Tool`
2. `Project`
3. `SessionWindow`
4. `PromptRecord`

### 5.2 核心实体

#### `SourceStatus`

描述某个工具来源当前可用状态。

字段建议：

- `tool`
- `rootPath`
- `status`
  - `healthy`
  - `missing`
  - `unsupported`
  - `error`
- `lastScannedAt`
- `lastSuccessfulSyncAt`
- `lastErrorCode`
- `lastErrorSummary`
- `suggestedFix`

#### `Project`

表示某个工具下的项目目录。

字段建议：

- `id`
- `tool`
- `projectPath`
- `normalizedProjectPath`
- `createdAt`
- `updatedAt`

说明：项目目录按**工具内部分组**，不跨工具合并。也就是说 `Codex:/Library/Code/AI/prompt` 与 `Claude:/Library/Code/AI/prompt` 是两个并列分组。

#### `SessionWindow`

表示某个逻辑上的对话窗口/会话桶。

字段建议：

- `id`
- `tool`
- `projectId`
- `sessionKey`
- `displayLabel`
- `sourceIdentity`
- `firstPromptAt`
- `lastPromptAt`

说明：

- 若来源存在真实窗口标识，`sessionKey` 直接承载真实值
- 若不存在真实窗口标识，使用稳定会话 ID 或来源文件内的稳定会话键

#### `PromptRecord`

表示一条用户发给 AI 的 prompt。

字段建议：

- `id`
- `tool`
- `projectId`
- `sessionId`
- `promptText`
- `promptTimestamp`
- `sourceFile`
- `sourceLocation`
  - 行号
  - 记录索引
  - 偏移量
  - 其他可复定位信息
- `fingerprint`
- `createdAt`

`fingerprint` 用于幂等去重，输入建议包含：

- 工具
- 来源文件
- 会话键
- prompt 时间
- prompt 原文
- 来源位置

#### `ImportCheckpoint`

用于增量导入恢复。

字段建议：

- `sourceFile`
- `fileFingerprint`
- `lastModifiedAt`
- `lastParsedOffset`
- `lastParsedRecordKey`
- `lastScannedAt`

#### `ImportIssue`

记录导入错误和建议。

字段建议：

- `tool`
- `sourceFile`
- `stage`
  - `discover`
  - `parse`
  - `normalize`
  - `persist`
  - `watch`
- `errorCode`
- `summary`
- `details`
- `suggestedFix`
- `occurredAt`

## 6. 来源策略

### 6.1 总体原则

- 优先使用**结构化会话文件**，避免把调试日志当主数据源
- 如果某个工具只暴露部分字段，允许缺少非关键字段，但不能缺少 `promptText`
- 若找不到稳定来源，状态必须显式为 `missing` 或 `unsupported`
- 不允许编造数据来“凑支持”

### 6.1.1 联网校验结论（2026-04-18）

本节区分三类证据：

- `官方文档 / 官方仓库`
- `官方 issue / 官方 CLI 行为说明`
- `本机实际观测`

来源优先级：

1. 官方文档
2. 官方仓库或官方 issue 中明确提到的路径
3. 本机实际观测到的真实路径

说明：

- `Codex` 当前官方文档对配置目录和状态库有明确说明，但对所有会话文件的完整清单披露不如其他工具充分
- `Claude Code`、`Gemini CLI`、`OpenCode` 的本地路径说明相对更明确
- 本机实际观测用于补足“官方没有完整列举，但机器上确实存在”的路径

### 6.2 Codex

当前已确认的候选来源分两层：

官方明确或半明确来源：

- `~/.codex/config.toml`
- `CODEX_HOME` 下的状态库目录
- `CODEX_HOME/history.jsonl`（官方仓库 issue 明确提到）

本机实际观测来源：

- `~/.codex/history.jsonl`
- `~/.codex/session_index.jsonl`
- `~/.codex/sessions/`
- `~/.codex/logs_2.sqlite`

策略：

- 优先尝试会话索引和会话内容目录
- 结构化文件不够时，再评估是否需要用 SQLite 日志补充
- 避免把纯运行日志当成 prompt 主来源，除非能稳定识别用户消息
- 对 `session_index.jsonl`、`sessions/`、`logs_2.sqlite` 的使用，当前属于**本机验证 + 结构探测**，不是完全来自公开官方路径清单
- 实现时必须把 Codex 来源适配器写成“多候选路径探测”，不能把单一路径写死

### 6.3 Claude

当前已确认本机存在以下候选来源：

- `~/.claude/projects/`
- `~/.claude/history.jsonl`
- `~/.claude/sessions/`

策略：

- 优先使用官方明确说明的 `~/.claude/projects/` 下 plaintext JSONL 会话数据
- `history.jsonl` 作为补充来源或索引来源
- `sessions/` 作为次级候选来源，仅在 `projects/` 结构不足时启用
- 自动记忆目录 `~/.claude/projects/<project>/memory/` 不作为 prompt 主来源，只作为辅助元数据来源

### 6.4 Gemini

当前已确认本机存在以下候选来源：

- `~/.gemini/tmp/<project_hash>/`
- `~/.gemini/tmp/<project_hash>/checkpoints`
- `~/.gemini/history/<project_hash>`
- `~/.gemini/antigravity/conversations/`

策略：

- 优先适配官方文档明确给出的 `~/.gemini/tmp/<project_hash>/` 会话状态与 checkpoint 数据
- `~/.gemini/history/<project_hash>` 主要用于文件快照，不作为 prompt 主来源，但可以辅助会话关联
- `~/.gemini/antigravity/conversations/` 属于**本机实际观测到的额外候选目录**，只在官方路径无法满足时作为补充探测来源
- `~/.gemini/GEMINI.md` 属于持久记忆文件，不作为会话 prompt 主来源

### 6.5 OpenCode

联网校验后，OpenCode 的会话数据来源已从“不明确”提升为“高置信度明确”。

当前候选来源：

- `~/.local/share/opencode/`
- `~/.local/share/opencode/storage/`
- `~/.local/share/opencode/project/`（官方文档提到的项目会话/消息数据目录概念）
- `~/.local/share/opencode/opencode.db`
- `~/.local/share/opencode/log/`
- `~/.config/opencode/opencode.jsonc` 或 `~/.config/opencode/opencode.json`

本机实际观测补充：

- `~/.local/share/opencode/storage/message/`
- `~/.local/share/opencode/storage/part/`
- `~/.local/share/opencode/opencode.db`

策略：

- 优先读取 `~/.local/share/opencode/` 下的结构化存储与数据库
- `~/.config/opencode` 仅视为配置来源，不当作会话 prompt 主来源
- 若数据库与结构化消息目录并存，以**结构可验证的消息记录**优先，数据库作为补充索引或回填来源
- OpenCode 在首版中不再默认视为“未知来源”，而是作为明确支持目标

### 6.6 来源支持置信度

首版设计时的支持置信度如下：

- `Claude Code`：高
- `OpenCode`：高
- `Gemini CLI`：中高
- `Codex`：中

解释：

- `Claude Code` 与 `OpenCode` 已有较明确官方路径说明
- `Gemini CLI` 对 checkpoint 与本地配置说明清楚，但“完整对话历史主来源”仍需结合实现验证
- `Codex` 当前更依赖本机实际观测与适配器探测，官方公开路径说明相对少一些

## 7. 导入流程

### 7.1 首次启动流程

1. 发现各工具来源目录
2. 建立来源状态
3. 对所有已发现来源执行全量扫描
4. 提取 prompt 并归一化
5. 写入 SQLite
6. 保存检查点
7. 启动文件监听
8. 更新菜单栏状态

### 7.2 增量监听流程

当监听到来源变动时：

1. 判断是文件追加、覆盖重写还是删除/消失
2. 优先按检查点做增量解析
3. 如果检查点失效或文件被整体重写，则回退到该文件完整重扫
4. 新记录按 `fingerprint` 幂等写入
5. 更新统计、状态和最近同步时间

### 7.3 失败处理原则

- 单来源失败不影响其他来源继续运行
- 单文件失败记录为 `ImportIssue`
- 格式异常时优先跳过坏记录或该文件，不让应用整体退出
- 来源消失时保留已导入数据，只更新状态为异常

## 8. 菜单栏首版交互

菜单栏首版不做历史浏览，只做状态与控制。

建议展示内容：

- 应用运行状态：`运行中 / 已暂停`
- 历史导入状态：`未开始 / 进行中 / 已完成`
- 总 prompt 数
- 每个工具的来源状态
- 最近一次成功同步时间
- 最近错误摘要
- 对当前错误的简单修复建议

建议菜单动作：

- `重新扫描`
- `打开数据库目录`
- `打开日志目录`
- `退出`

### 8.1 统计分析能力

在原始 prompt 采集之外，产品应支持**基于 prompt 的本地统计**。

统计分两类：

#### A. 事实统计

直接由原始记录计算，不做主观解释。

首批指标建议：

- 总 prompt 数
- 每工具 prompt 数
- 每项目 prompt 数
- 每会话 prompt 数
- 每日 prompt 数
- 每小时 prompt 分布
- 活跃星期分布
- 平均 prompt 长度
- prompt 长度分位数
- 单次会话持续时间（基于 prompt 时间差）
- 活跃天数与连续活跃天数

#### B. 规则推断统计

使用**本地、可解释、确定性规则**从 prompt 文本中提取，不额外调用 LLM。

首批指标建议：

- 问句占比
- 指令句占比
- 礼貌表达占比
- Markdown / 列表化表达占比
- 文件路径 / 命令 / 代码片段提及率
- 中文 / 英文 / 混合语言占比
- 长 prompt / 短 prompt 倾向
- 规划类请求 / 修复类请求 / 解释类请求 / 执行类请求 的启发式占比

### 8.2 统计边界

统计必须明确边界：

- “工作时间”指**prompt 活跃时间分布**，不是用户真实劳动工时
- “说话风格”指**文本交互风格特征**，不是人格画像
- 所有风格标签必须能回溯到明确规则，不得输出玄学结论
- 任何低置信度推断都要允许展示为 `未知` 或 `样本不足`

### 8.3 Phase A 与 Phase C 的统计呈现

- Phase A：
  - 先完成统计底座与派生计算
  - 菜单栏只展示少量摘要，如总数、今日新增、最近活跃时间
- Phase C：
  - 提供完整统计页和筛选视图
  - 支持按工具、项目、时间范围查看统计结果

### 8.4 简单修复建议

针对可由用户自行处理的问题，菜单栏应给出明确提示，而不是只有异常文本。

示例：

- `目录未发现`
  - 建议：重新扫描；确认工具是否已在本机产生本地会话
- `文件不可读 / 权限异常`
  - 建议：检查目录权限后重试
- `格式暂不支持`
  - 建议：提示当前版本尚未兼容该来源格式
- `索引失效 / 文件重写`
  - 建议：执行完整重扫

## 9. 验证策略

首版必须覆盖四层验证：

### 9.1 适配器测试

为每个工具准备脱敏样例文件，验证：

- 只提取用户 prompt
- 能提取项目路径
- 能提取会话标识
- 能提取时间

### 9.2 归一化与去重测试

验证：

- 同一文件重复导入不会重复写入
- 全量重扫不会产生重复 prompt
- 文件覆盖重写后仍能恢复到正确状态

### 9.3 数据库集成测试

验证查询结果能正确表达：

`工具 -> 项目目录 -> 会话窗口 -> prompt 列表`

### 9.4 真实运行验证

真实启动菜单栏应用，验证：

- 启动后历史导入能完成
- 菜单栏状态能刷新
- 新 prompt 落盘后能触发增量导入
- 错误状态和修复建议能展示

### 9.5 统计验证

统计功能至少验证：

- 小样本与大样本下的时间分布计算正确
- 同一 prompt 不会被重复计入统计
- 风格规则在脱敏样例上输出稳定结果
- 没有足够数据时会返回 `未知` 或空值，而不是强行给标签

## 10. 可观测性与隐私

### 10.1 日志

应用日志应包含：

- 来源发现结果
- 扫描文件数量
- 导入 prompt 数
- 每来源最近成功同步时间
- 错误摘要和分类

### 10.2 隐私

由于产品目标就是保存 prompt 原文，因此必须默认把数据视为敏感本地数据。

设计要求：

- 所有数据只保存在本机
- 不做外发
- 测试样例必须脱敏，不能混入真实 prompt
- 用户应能从菜单栏快速定位数据库目录和日志目录
- 统计分析默认本地完成，不调用额外云端模型
- 若未来加入“LLM 生成摘要/标签”，必须作为显式可关闭的增强功能，而不是默认路径

## 11. Phase C 扩展路径

第二阶段增加前台浏览窗口，直接复用 SQLite 数据。

浏览层级与当前模型一致：

- 工具列表
- 项目目录列表
- 会话窗口列表
- prompt 明细列表

Phase A 与 Phase C 的边界：

- Phase A 先把导入链路、状态、错误诊断做稳
- Phase C 再补浏览、筛选、搜索和可能的导出功能

## 12. 风险与应对

### 风险 1：来源格式漂移

影响：

- 适配器失效，某个工具可能无法继续采集

应对：

- 适配器隔离
- 错误分类
- 明确显示 `unsupported` 或 `error`

### 风险 2：OpenCode 无稳定来源

影响：

- 首版可能无法真正支持 OpenCode

应对：

- 设计上允许单工具未支持
- UI 明示状态
- 不虚构兼容性

### 风险 3：首次历史导入较慢

影响：

- 启动初次体验偏慢

应对：

- 显示历史导入进行中状态
- 保存检查点，后续启动避免全量重扫

### 风险 4：会话不等于真实窗口

影响：

- 分组名可能更接近逻辑会话，而不是 OS 级窗口

应对：

- 统一抽象为 `session/window`
- 文档和 UI 中不承诺一定是 macOS 窗口 ID

### 风险 5：统计被误解为客观人格结论

影响：

- 用户可能把文本风格统计误解为性格或工作能力判断

应对：

- UI 中明确标注“规则推断”
- 只提供可解释的文本特征
- 不输出伪心理学标签

## 13. 实现建议结论

首版应采用：

- **SwiftUI 菜单栏应用壳层**
- **工具级来源适配器**
- **统一导入编排器**
- **SQLite 持久化**
- **结构化错误与修复建议**
- **本地可解释统计引擎**

这是当前约束下风险最低、可验证、可扩展到 Phase C 的方案。

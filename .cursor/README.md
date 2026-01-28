# Cursor Skills 目录说明

本目录包含所有 Cursor 相关的技能模块（Skills），每个技能模块都提供了特定领域的专业指导和最佳实践。

## 目录结构

所有技能模块位于 `.cursor/skills/` 目录下，每个技能模块包含：
- `SKILL.md` - 技能的主要说明文档（必需）
- `scripts/` - 相关脚本文件（可选）
- `references/` - 参考资料文档（可选）
- `assets/` - 资源文件（可选）
- `examples/` - 示例文件（可选）

## 技能分类

### 🎨 前端开发

#### **frontend-design**
创建独特、生产级的前端界面，避免通用 AI 美学。用于构建 Web 组件、页面、应用程序、海报或界面。

#### **frontend-testing**
为 Dify 前端组件、钩子和工具生成 Vitest + React Testing Library 测试。在测试、规范文件、覆盖率、Vitest、RTL、单元测试、集成测试或编写/审查测试请求时触发。

#### **senior-frontend**
全面的前端开发技能，用于使用 ReactJS、NextJS、TypeScript、Tailwind CSS 构建现代、高性能的 Web 应用程序。包括组件脚手架、性能优化、包分析和 UI 最佳实践。

#### **shadcn**
shadcn/ui 组件库模式，使用 Radix UI 原语和 Tailwind CSS。在创建表格、表单、对话框、卡片、按钮或任何使用 shadcn/ui 的 UI 组件时使用。

#### **using-shadcn-ui**
在构建 React UI 组件、实现设计系统或需要预构建的可访问组件时使用 - 利用 shadcn/ui 原语和 shadcnblocks.com（829 个生产就绪的块）进行快速界面开发。

#### **ui-designer**
从参考 UI 图像中提取设计系统并生成可立即实现的 UI 设计提示。当用户提供 UI 截图/模型并希望创建一致的设计、生成设计系统或构建匹配参考美学的 MVP UI 时使用。

#### **ux-designer**
设计用户体验，创建线框图，定义用户流程，确保可访问性。触发关键词 - UX 设计、线框图、用户流程、可访问性、WCAG、移动优先、响应式、UI 设计、用户旅程、界面设计、用户体验、设计系统、组件设计、交互设计。

#### **web-artifacts-builder**
用于创建复杂的、多组件的 claude.ai HTML 工件的工具套件，使用现代前端 Web 技术（React、Tailwind CSS、shadcn/ui）。用于需要状态管理、路由或 shadcn/ui 组件的复杂工件 - 不适用于简单的单文件 HTML/JSX 工件。

#### **artifacts-builder**
用于创建复杂的、多组件的 claude.ai HTML 工件的工具套件，使用现代前端 Web 技术（React、Tailwind CSS、shadcn/ui）。用于需要状态管理、路由或 shadcn/ui 组件的复杂工件。

### 🔧 后端开发

#### **backend-development**
使用现代技术（Node.js、Python、Go、Rust）、框架（NestJS、FastAPI、Django）、数据库（PostgreSQL、MongoDB、Redis）、API（REST、GraphQL、gRPC）、身份验证（OAuth 2.1、JWT）、测试策略、安全最佳实践（OWASP Top 10）、性能优化、可扩展性模式（微服务、缓存、分片）、DevOps 实践（Docker、Kubernetes、CI/CD）和监控构建强大的后端系统。

#### **async-python-patterns**
掌握 Python asyncio、并发编程和 async/await 模式，用于高性能应用程序。在构建异步 API、并发系统或需要非阻塞操作的 I/O 绑定应用程序时使用。

#### **auth-implementation-patterns**
掌握身份验证和授权模式，包括 JWT、OAuth2、会话管理和 RBAC，以构建安全、可扩展的访问控制系统。在实现身份验证系统、保护 API 或调试安全问题时使用。

#### **convex-backend**
使用 TypeScript 查询、变更和操作构建实时、响应式后端应用程序，具有自动响应性和乐观更新。用于构建实时协作应用程序、实现响应式数据同步、编写无服务器后端函数。

#### **postgresql**
设计 PostgreSQL 特定的模式。涵盖最佳实践、数据类型、索引、约束、性能模式和高级功能。

### 🏗️ 架构与设计

#### **architecture-diagrams**
使用 Mermaid、PlantUML、C4 模型、流程图和序列图创建系统架构图。在记录架构、系统设计、数据流或技术工作流时使用。

#### **architecture-patterns**
实现经过验证的后端架构模式，包括清洁架构、六边形架构和领域驱动设计。在架构复杂的后端系统或重构现有应用程序以提高可维护性时使用。

#### **api-design-principles**
掌握 REST 和 GraphQL API 设计原则，以构建直观、可扩展和可维护的 API，让开发人员满意。在设计新 API、审查 API 规范或建立 API 设计标准时使用。

#### **microservices-patterns**
设计具有服务边界、事件驱动通信和弹性模式的微服务架构。在构建分布式系统、分解单体或实现微服务时使用。

#### **senior-architect**
全面的软件架构技能，用于使用 ReactJS、NextJS、NodeJS、Express、React Native、Swift、Kotlin、Flutter、Postgres、GraphQL、Go、Python 设计可扩展、可维护的系统。包括架构图生成、系统设计模式、技术栈决策框架和依赖分析。

### 📝 文档与写作

#### **documentation-generation**
创建全面的技术文档，包括 API 文档、组件库、README 文件、架构图和开发人员指南，使用 JSDoc、Storybook 或 Docusaurus 等工具。在记录 API、创建组件文档、编写 README 文件、生成 API 参考、记录架构决策、创建入职指南、维护变更日志、记录配置选项或构建开发人员文档站点时使用。

#### **documentation-writing**
编写清晰、可发现的软件文档，遵循八项规则和 Diataxis 框架。在创建 README 文件、API 文档、教程、操作指南或任何项目文档时使用。自动强制执行 docs/ 位置、链接要求和可运行示例。

#### **writing-documentation**
编写技术文档的最佳实践和指南。

#### **writing-clearly-and-concisely**
将 Strunk 的永恒写作规则应用于人类将阅读的任何散文——文档、提交消息、错误消息、解释、报告或 UI 文本。使您的写作更清晰、更强、更专业。

#### **technical-doc-creator**
创建包含代码块、API 工作流、系统架构图和语法高亮的 HTML 技术文档。在用户请求技术文档、API 文档、API 参考、代码示例或开发人员文档时使用。

#### **docstring**
为 PyTorch 函数和方法编写文档字符串，遵循 PyTorch 约定。在编写或更新 PyTorch 代码中的文档字符串时使用。

### 🤖 AI 与机器学习

#### **rag-implementation**
为 LLM 应用程序构建检索增强生成（RAG）系统，使用向量数据库和语义搜索。在实现知识基础的 AI、构建文档 Q&A 系统或将 LLM 与外部知识库集成时使用。

#### **hybrid-search-implementation**
结合向量和关键字搜索以改进检索。在实现 RAG 系统、构建搜索引擎或当单一方法无法提供足够的召回率时使用。

#### **llm-docs-optimizer**
为 AI 编码助手和 LLM 优化文档。通过 c7score 优化、llms.txt 生成、问题驱动的重构和自动化质量评分改进 Claude、Copilot 和其他 AI 工具的文档。在要求改进、优化或增强 AI 助手、LLM、c7score、Context7 的文档时使用，或创建 llms.txt 文件时使用。

#### **prompt-engineering-patterns**
掌握高级提示工程技术，以最大化 LLM 在生产中的性能、可靠性和可控性。在优化提示、改进 LLM 输出或设计生产提示模板时使用。

#### **prompt-factory**
世界级的提示工厂，通过智能 7 问题流程、跨 15 个专业领域的 69 个全面预设（技术、商业、创意、法律、金融、HR、设计、客户、执行、制造、研发、监管、专业技术、研究、创意媒体）、多种输出格式（XML/Claude/ChatGPT/Gemini）、质量验证门和来自 OpenAI/Anthropic/Google 的上下文最佳实践，为任何角色、行业和任务生成生产就绪的超级提示。

#### **deepresearh-integrator**
将多个深度研究结果整合为单一综合报告，遵循迭代处理的最佳实践。

#### **remembering-conversations**
使用语义或文本搜索搜索之前的 Claude Code 对话中的事实、模式、决策和上下文。

### 🧪 测试与质量

#### **frontend-testing**
为 Dify 前端组件、钩子和工具生成 Vitest + React Testing Library 测试。

### 🚀 部署与运维

#### **deployment-pipeline-design**
设计具有批准门、安全检查和部署编排的多阶段 CI/CD 管道。在架构部署工作流、设置持续交付或实现 GitOps 实践时使用。

#### **devops-engineer**
DevOps 专家，专注于 CI/CD、基础设施即代码和部署自动化。用于管道、Docker、Kubernetes、云平台、GitOps。关键词：DevOps、CI/CD、Docker、Kubernetes、Terraform、GitHub Actions。

### 📊 数据工程

#### **senior-data-engineer**
世界级的数据工程技能，用于构建可扩展的数据管道、ETL/ELT 系统和数据基础设施。在 Python、SQL、Spark、Airflow、dbt、Kafka 和现代数据栈方面的专业知识。包括数据建模、管道编排、数据质量和 DataOps。

#### **create-database-migration**
创建数据库迁移以添加表、向现有表添加列、添加设置或以其他方式更改 Ghost 的 MySQL 数据库模式。

### 🎨 设计与可视化

#### **canvas-design**
使用设计哲学在 .png 和 .pdf 文档中创建精美的视觉艺术。当用户要求创建海报、艺术作品、设计或其他静态作品时，应使用此技能。创建原创视觉设计，从不复制现有艺术家的作品以避免版权侵犯。

#### **drawio-diagrams-enhanced**
创建专业的 draw.io（diagrams.net）图表，采用 XML 格式（.drawio 文件），集成 PMP/PMBOK 方法、广泛的视觉资产库和行业标准的专业模板。在用户要求创建流程图、泳道图、跨职能流程图、组织图、网络图、UML 图、BPMN、项目管理图（WBS、甘特图、PERT、RACI）、风险矩阵、利益相关者地图或任何其他 draw.io 格式的视觉图表时使用此技能。

#### **mermaid**
创建 Mermaid 图表的指南。当用户想要创建 Mermaid 图表（或更新现有图表）时，应使用此技能。

### 📄 文档处理

#### **pdf-processing-pro**
生产就绪的 PDF 处理，包括表单、表格、OCR、验证和批处理操作。在生产环境中处理复杂的 PDF 工作流、处理大量 PDF 或需要强大的错误处理和验证时使用。

#### **pptx**
处理 PowerPoint 演示文稿的工具和指南。

### 🛠️ 工具与自动化

#### **agent-development**
用于 Claude Code 插件的代理开发。在用户要求"创建代理"、"添加代理"、"编写子代理"、"代理前置元数据"、"何时使用描述"、"代理示例"、"代理工具"、"代理颜色"、"自主代理"或需要代理结构、系统提示、触发条件或代理开发最佳实践指导时使用。

#### **claude-code-analyzer**
分析 Claude Code 使用模式并提供全面建议。运行使用分析、发现 GitHub 社区资源、建议 CLAUDE.md 改进，并按需获取最新文档。在用户想要优化其 Claude Code 工作流、创建配置（代理/技能/命令）或设置项目文档时使用。

#### **code-refactor**
执行批量代码重构操作，如跨文件重命名变量/函数、替换模式、更新 API 调用。在用户请求重命名标识符、替换已弃用的代码模式、更新方法调用或在多个位置进行一致更改时使用。

#### **hook-development**
在用户要求"创建钩子"、"添加 PreToolUse/PostToolUse/Stop 钩子"、"验证工具使用"、"实现基于提示的钩子"、"使用 ${CLAUDE_PLUGIN_ROOT}"、"设置事件驱动的自动化"、"阻止危险命令"或提及钩子事件（PreToolUse、PostToolUse、Stop、SubagentStop、SessionStart、SessionEnd、UserPromptSubmit、PreCompact、Notification）时使用。提供创建和实现 Claude Code 插件钩子的全面指导，重点关注高级基于提示的钩子 API。

#### **skill-creator**
创建有效技能的指南。在用户想要创建新技能（或更新现有技能）以扩展 Claude 的专业知识、工作流或工具集成能力时，应使用此技能。

#### **skill-developer**
创建和管理 Claude Code 技能，遵循 Anthropic 最佳实践。在创建新技能、修改 skill-rules.json、理解触发模式、使用钩子、调试技能激活或实现渐进式披露时使用。

#### **skill-installer**
从精选列表或 GitHub 仓库路径将 Codex 技能安装到 $CODEX_HOME/skills。在用户要求列出可安装的技能、安装精选技能或从另一个仓库（包括私有仓库）安装技能时使用。

#### **skill-writer**
指导用户创建 Claude Code 的代理技能。在用户想要创建、编写、创作或设计新技能，或需要 SKILL.md 文件、前置元数据或技能结构帮助时使用。

#### **worktrees**
使用 git worktrees 与编码代理并行开发的指南。在用户请求在新工作树中工作或希望在隔离环境中处理单独功能时使用此技能（例如，"在新工作树中工作"、"为功能 X 创建工作树"）。

#### **subagent-driven-development**
在当前会话中执行具有独立任务的实施计划时使用。

### 🎯 特定平台

#### **shopify**
使用 GraphQL/REST API、Shopify CLI、Polaris UI 组件和 Liquid 模板构建 Shopify 应用程序、扩展和主题。功能包括具有 OAuth 身份验证的应用程序开发、用于自定义结账流程的结账 UI 扩展、用于仪表板集成的管理 UI 扩展、用于零售的 POS 扩展、使用 Liquid 的主题开发、Webhook 管理、计费 API 集成、产品/订单/客户管理。

#### **nano-banana**
使用 Google 的 Gemini 3 Pro 图像模型（Nano Banana Pro）通过 MCP 生成和编辑高质量 AI 图像。在用户想要创建图像、编辑照片、生成图形或需要带有文本渲染的视觉内容时使用。

### 🎨 创意与设计

#### **applying-brand-guidelines**
将一致的企业品牌和样式应用于所有生成的文档，包括颜色、字体、布局和消息传递。

#### **brainstorming**
使用苏格拉底方法将想法细化为完整设计的交互式想法改进。

### 📚 其他

#### **writing-documentation**
编写文档的参考和指南。

#### **worktrees**
使用 git worktrees 与编码代理并行开发的指南。

---

## 使用说明

每个技能模块都包含详细的 `SKILL.md` 文件，其中包含：
- 技能描述和使用场景
- 核心概念和工作流程
- 代码示例和最佳实践
- 相关资源和参考资料

要使用特定技能，请参考对应目录下的 `SKILL.md` 文件获取详细说明。

## 贡献

如果您想添加新技能或改进现有技能，请遵循以下步骤：
1. 在 `.cursor/skills/` 目录下创建新的技能目录
2. 创建 `SKILL.md` 文件，包含技能的完整说明
3. 根据需要添加 `scripts/`、`references/`、`assets/` 等子目录
4. 更新本 README.md 文件，将新技能添加到相应分类中

## 许可证

各个技能模块可能有不同的许可证，请查看各技能目录下的 `LICENSE.txt` 文件了解详情。

## 参考来源

本目录中的技能模块参考了以下资源：

- **[Claude Plugins](https://claude-plugins.dev/)** - Claude Code 插件社区市场，提供大量可用的插件和技能
- **[Agent Skills](https://agentskills.io/home)** - Agent Skills 开放标准，用于为代理提供新能力和专业知识

这些资源为技能模块的开发提供了重要的参考和灵感来源。

---

如有侵权可联系删除



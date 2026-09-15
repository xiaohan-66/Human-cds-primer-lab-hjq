<p align="center"><img src="docs/assets/cover.svg" width="100%" alt="Human CDS Primer Lab — 人源完整 CDS 引物设计工作台" /></p>

<div align="center">

### 把重复的分子克隆准备，组织成可复核的科研工作流。

人源转录本检索 · 完整 CDS 引物设计 · 批量质量筛查 · 配对特异性分析

**[访问原网站 ↗](https://human-cds-primer-throughput-lab.lwhjq6666.chatgpt.site/)** · **[快速开始](#本地运行)** · **[核心代码](#代码导览)** · **[验证记录](VALIDATION.md)**

<sub>TypeScript / React 19 / vinext / Cloudflare Workers + D1</sub>

</div>

---

<table>
<tr><td align="center" width="25%"><h3>50</h3>每批最多目标数</td><td align="center" width="25%"><h3>5</h3>每目标最多候选对</td><td align="center" width="25%"><h3>2</h3>完整 CDS 扩增模式</td><td align="center" width="25%"><h3>CSV</h3>结构化结果导出</td></tr>
</table>

## 为什么做这个工具

为多个基因准备分子克隆引物时，需要反复查询转录本、确认 CDS 边界、筛选候选并整理结果。Human CDS Primer Lab 把这些步骤连成一条可暂停、可恢复、可追溯的工作流。

**输入基因名称或 RefSeq ID，输出带坐标、计算参数与质量提示的候选引物对。** 项目从实际实验需求出发，使用 AI 辅助开发。

> **使用说明** · 这是科研工具原型。候选和风险提示用于人工复核，软件测试不等同于湿实验验证。原网站的访问权限由站点设置决定，线上版本可能早于本仓库源码。

## 从输入到结果

| 01 · 检索与选择 | 02 · 设计与优化 | 03 · 复核与导出 |
| :--- | :--- | :--- |
| 输入 1–50 个目标 | 选择精确 CDS 或含 UTR 模式 | 查看候选坐标与质量提示 |
| 查询人源 RefSeq NM_ 转录本 | 计算 Tm 并筛查 GC、重复与互补结构 | 可选提交 BLAST 配对分析 |
| 对不明确的转录本进行确认 | 必要时扩展 UTR 搜索窗口 | 导出 CSV，保留计算条件 |

```mermaid
flowchart LR
    A[基因 / RefSeq ID] --> B[转录本与 CDS]
    B --> C[候选设计]
    C --> D[质量筛查与自动优化]
    D --> E[结果与 CSV]
    E -. 可选 .-> F[BLAST 配对分析]
    classDef source fill:#edf6ff,stroke:#6597c4,color:#16324f
    classDef design fill:#e7f8f2,stroke:#45a48b,color:#164c40
    class A,B source
    class C,D,E,F design
```

## 核心能力 · 每项都能找到代码

| 能力 | 实现细节 | 查看实现 |
| :--- | :--- | :--- |
| **序列检索** | 人源 RefSeq 查询、缓存、节流与重试 | [NCBI service](lib/ncbi/service.ts) |
| **批量任务** | 暂停、继续、失败重试与持久化；不明确的目标等待确认 | [Batch core](lib/batch/core.ts) |
| **候选设计** | 精确 CDS 与含 UTR 两种模式；保留完整 CDS 覆盖要求 | [Primer design](lib/primer.ts) |
| **质量筛查** | 批量设计使用近邻模型 Tm；筛查 GC、重复及互补结构 | [Quality model](lib/quality/thermo.ts) |
| **自动优化** | 含 UTR 模式最多每侧扩展 500 bp，受转录本边界限制 | [Adaptive search](lib/batch/adaptive.ts) |
| **配对分析** | 从 BLAST 返回位点识别 F–R、F–F、R–R 潜在产物 | [Pair engine](lib/blast/pair-engine.ts) |
| **结果导出** | 候选序列、坐标、条件、质量提示与搜索状态 | [CSV export](lib/batch/view.ts) |

<details>
<summary><strong>展开阅读：方法、版本差异与科学边界</strong></summary>

- 引物候选由本项目算法生成，并非 Primer3 的输出。
- 结构筛查是连续互补启发式规则，不是完整的热力学折叠计算。
- BLAST 分数未经湿实验校准；受公共服务、记录上限及不完整比对影响。
- 历史单目标与新版批量设计存在方法差异，旧结果需要重新计算。
- FLAG 同源臂、细胞系表达量推荐和 LLM Agent 尚未实现。

[质量方法](docs/quality-method.md) · [配对特异性](BLAST-SPECIFICITY.md) · [批量任务](THROUGHPUT.md)

</details>

---

## 本地运行

需要 Node.js 24 和 npm。项目沿用原网站的 vinext / Cloudflare Workers 运行架构，数据库使用本地 D1 模拟环境。

```bash
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
npm run dev
```

打开终端显示的本地地址。无需配置 NCBI Key 即可尝试查询，但受公共接口限制；如需配置，参考 `.env.example`，仅在服务端设置。不要提交真实密钥。

仓库内 `.openai/hosting.json` 仅保留本地运行所需的 DB 绑定名称，不包含原网站项目标识。仓库不包含运行数据库、用户批次或部署凭据。

## 代码导览

```text
app/                 页面与 HTTP API
components/          结果、质量与特异性展示组件
lib/primer.ts        引物候选设计
lib/batch/           批量队列、自动优化与导出
lib/ncbi/            NCBI 查询、缓存与节流
lib/quality/         Tm 与结构筛查
lib/blast/           BLAST 任务、配对与风险分类
db/ + drizzle/       数据模型与数据库迁移
tests/               自动化测试与公开参考序列夹具
```

## 验证

单独运行一个测试：

```bash
node --import ./tests/register.mjs --experimental-transform-types tests/adaptive.test.mjs
```

其他 `tests/*.test.mjs` 采用相同方式运行。测试覆盖 CDS 边界、反向互补、扩展搜索、批量任务、缓存、结构筛查与配对判定。`blast-live.mjs` 等在线脚本会访问外部服务，不属于离线回归套件。

```bash
npx tsc --noEmit --incremental false
npm run build
```

50 目标测试验证队列和数据流，并非 50 个基因的湿实验验证。部分夹具来自公共 NCBI 参考记录；合成边界用例在测试代码中标注。

## 方法与局限

- 引物候选由本项目算法生成，不是调用 Primer3 产生的结果。
- 结构筛查采用连续 Watson–Crick 互补启发式规则，不是完整的自由能折叠计算。
- BLAST 风险分数未经湿实验校准，不代表扩增概率；返回上限和不完整分析会影响结论。
- 原始单目标设计与新版批量设计存在方法版本差异；历史结果需要重新计算。
- 本项目不实现 FLAG 同源臂设计、细胞系表达量推荐或 LLM Agent。

详见 [质量计算方法](docs/quality-method.md)、[配对特异性方法](BLAST-SPECIFICITY.md) 和 [批量任务说明](THROUGHPUT.md)。

## 项目状态

该仓库整理自现有引物设计网站源码。最新本地自动优化修改也包含在内，可能晚于线上部署版本。项目展示应以当前源码与验证记录为准。


<div align="center">

# Human CDS Primer Lab
### 人源完整 CDS 引物设计与批量分析工作台

从基因检索、转录本选择到候选设计与引物配对特异性分析。

**TypeScript · React · NCBI · Cloudflare D1**

[功能概览](#功能概览) · [本地运行](#本地运行) · [代码导览](#代码导览) · [方法与局限](#方法与局限)

</div>

---

## 项目背景

分子克隆准备过程中，需要反复查询人源转录本、确认完整 CDS、设计引物并整理候选。本项目将这些步骤组织为可恢复的批量工作流，保留候选坐标、计算参数和筛查依据，便于实验人员复核。

项目由实际实验需求驱动，使用 AI 辅助开发。当前是科研工具原型；软件测试不等同于湿实验验证。

## 功能概览

| 模块 | 当前实现 | 对应代码 |
|---|---|---|
| 序列检索 | 查询人源 RefSeq NM_ 转录本；缓存、限流与重试 | [NCBI service](lib/ncbi/service.ts) |
| 批量任务 | 1–50 个目标；暂停、继续、失败重试与结果持久化 | [Batch core](lib/batch/core.ts) |
| 引物设计 | 精确 CDS 与包含 UTR 的完整 CDS 两种模式 | [Primer design](lib/primer.ts) |
| 质量筛查 | 批量设计使用近邻模型 Tm；GC、连续重复及互补结构筛查 | [Quality model](lib/quality/thermo.ts) |
| 自动优化 | 含 UTR 模式逐步扩展搜索，最多每侧 500 bp，受转录本边界限制 | [Adaptive search](lib/batch/adaptive.ts) |
| 配对特异性 | 对 BLAST 返回位点分析 F–R、F–F、R–R 潜在扩增组合 | [Pair engine](lib/blast/pair-engine.ts) |
| 结果导出 | 候选、坐标、计算条件、质量提示和搜索状态导出为 CSV | [Export](lib/batch/view.ts) |

每个目标最多保留 5 对候选。BLAST 为可选步骤，受公共服务排队和返回上限影响。

```mermaid
flowchart LR
  A[基因 / RefSeq ID] --> B[NCBI 转录本检索]
  B --> C[选择并核对完整 CDS]
  C --> D[候选设计与质量筛查]
  D --> E[自动扩展搜索]
  E --> F[候选结果与 CSV]
  F --> G[可选 BLAST 配对分析]
```

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

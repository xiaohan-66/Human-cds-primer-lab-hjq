# 验证记录

日期：2026-09-15

- Node.js v24.19.0；复用原项目已安装依赖，未验证全新 npm ci。
- tests/*.test.mjs 共 11 个离线测试文件全部通过。
- TypeScript 类型检查通过：tsc --noEmit --incremental false。
- vinext build 完整构建通过，生成客户端与服务端产物。
- 未运行新的在线 NCBI BLAST 或湿实验验证。
- 常见密钥格式与本机绝对路径扫描未检出匹配。发布副本不含原 Git 历史、运行数据库、临时输出、原 Sites 项目标识或凭据。

## 棱序界面同步（2026-09-15）

- 同步源版本：pcr-primer-throughput 72b8abc。
- 本次复跑：TypeScript 检查、throughput.test.mjs、adaptive.test.mjs 与完整 vinext build，均通过。
- 新增 quality-bulk-http.mjs 随源码同步，本次未运行其本地 HTTP 集成测试。
- 1 / 10 / 50 入口依据两个版本的 studio-header.tsx 核对；未进行新的浏览器截图或线上交互验证。

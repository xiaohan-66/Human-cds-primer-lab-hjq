# 验证记录

日期：2026-09-15

- Node.js v24.19.0；复用原项目已安装依赖，未验证全新 npm ci。
- tests/*.test.mjs 共 11 个离线测试文件全部通过。
- TypeScript 类型检查通过：tsc --noEmit --incremental false。
- vinext build 完整构建通过，生成客户端与服务端产物。
- 未运行新的在线 NCBI BLAST 或湿实验验证。
- 常见密钥格式与本机绝对路径扫描未检出匹配。发布副本不含原 Git 历史、运行数据库、临时输出、原 Sites 项目标识或凭据。

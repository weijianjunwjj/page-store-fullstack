# Troubleshooting

> 开发过程中遇到的环境 / 配置类问题及修复。每条按 现象 / 根因 / 修复 / 验证 四段记录。
> 与日常任务卡 (TASKS.md) 分开,只收纳"非业务、但卡住过我"的问题。

---

## 2026-05-27 · W3 D2

### 1. tsconfig rootDir 报错:跨目录引用 prisma.service.ts

**现象**
`backend/src/prisma/prisma.module.ts` 编译时报 TypeScript rootDir 错误。

**根因**
`prisma.service.ts` 最初放在 `backend/prisma/` 目录,与 schema、migration 混在一起。但 `backend/tsconfig.json` 配置了 `"rootDir": "./src"` + `"exclude": ["prisma"]`,从 `src/` 内部跨目录引用会跳出 `rootDir`。

**修复**
- `prisma.service.ts` 移到 `backend/src/prisma/prisma.service.ts`
- `prisma.module.ts` 改为 `import { PrismaService } from './prisma.service'`
- 约定 `backend/prisma/` 目录只放 Prisma 自身产物:schema、migration、seed、verify 脚本、dev.db

**验证**
`npm run build` 通过。

---

### 2. VS Code 误报红线但命令行编译通过

**现象**
`npm run build` 和 `npx tsc --noEmit` 都通过,但 VS Code 编辑器里导入路径仍然红色。

**根因**
VS Code 从 monorepo 根目录打开时,无法稳定识别 `backend/` 子项目的 TypeScript 配置;默认 TS SDK 也不一定指向 `backend/node_modules/typescript`。

**修复**
- 仓库根目录新增 `tsconfig.json`,用 project references 指向 backend:
```json
  { "files": [], "references": [{ "path": "./backend" }] }
```
- `.vscode/settings.json` 显式指定 workspace TS SDK:
```json
  {
    "prisma.pinToPrisma6": true,
    "typescript.tsdk": "backend/node_modules/typescript/lib",
    "typescript.enablePromptUseWorkspaceTsdk": true
  }
```
- 改完后命令面板执行 `TypeScript: Restart TS Server`(或重载窗口)。

**验证**
重启 TS Server 后红线消失。

---

### 3. SQLite 路径解析:DATABASE_URL 多嵌套一层 prisma/

**现象**
Nest 启动时抛错:
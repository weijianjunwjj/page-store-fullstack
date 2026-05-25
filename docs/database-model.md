# 数据模型

## ER 图

\`\`\`mermaid
erDiagram
    User ||--o{ PageConfig : owns
    User ||--o{ Event : produces

    User {
        int id PK
        string username UK
        string password
        datetime createdAt
    }
    PageConfig {
        int id PK
        string name
        string code UK
        string status
        string configJson
        int userId FK
        datetime createdAt
        datetime updatedAt
    }
    Event {
        int id PK
        string type
        int userId FK
        string payload
        datetime createdAt
    }
\`\`\`

## 设计要点

- User ↔ PageConfig 1:N,删用户先确认是否级联(本期不实现)
- Event.createdAt 加索引,服务于 v2 的按天聚合
- Event.type 当前枚举:`login` / `page_view` / `config_change`(seed 硬编码,未来如需扩展再考虑迁到独立表)
- password 当前明文,W5 用 bcrypt 替换

## v2 分析查询预留

下面三种查询是 v2 分析接口的目标,Event 表的索引按这三种查询模式设计。

### ① 按天 event count(最近 30 天,空白日补 0)

\`\`\`sql
WITH RECURSIVE dates(d) AS (
  SELECT date('now', '-29 days')
  UNION ALL
  SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
)
SELECT dates.d AS day, COUNT(e.id) AS event_count
FROM dates
LEFT JOIN Event e ON date(e.createdAt) = dates.d
GROUP BY dates.d
ORDER BY dates.d;
\`\`\`

### ② 按 type 分布

\`\`\`sql
SELECT type, COUNT(*) AS count
FROM Event
GROUP BY type
ORDER BY count DESC;
\`\`\`

### ③ 最近 7 天 top user

\`\`\`sql
SELECT u.id, u.username, COUNT(e.id) AS event_count
FROM User u
LEFT JOIN Event e
  ON e.userId = u.id
  AND e.createdAt >= datetime('now', '-7 days')
GROUP BY u.id, u.username
ORDER BY event_count DESC
LIMIT 5;
\`\`\`

### 等价的 Prisma 实现

`backend/prisma/verify.ts` 用 Prisma `groupBy` 实现了上述三种查询的等价语义。Prisma 6 的 SQLite driver 对 DateTime 字段的存储编码与 SQLite 的 `date()` / `datetime()` 函数不直接兼容,所以 raw SQL 不可直接用,需走 Prisma API 或在应用层做日期对齐。
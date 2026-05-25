// W2 D5 反推验收脚本:验证 schema 能支撑 v2 的三种聚合查询
// 跑法:cd backend && pnpm tsx prisma/verify.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ============ ① 按天 event count(最近 30 天,空白日补 0)============
  console.log('\n=== ① 按天 event count(最近 30 天)===');

  const events = await prisma.event.findMany({
    select: { createdAt: true },
  });

  const dayMap = new Map<string, number>();
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events) {
    const key = e.createdAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      dayMap.set(key, dayMap.get(key)! + 1);
    }
  }

  console.table(
    [...dayMap.entries()].map(([day, event_count]) => ({ day, event_count })),
  );

  // ============ ② 按 type 分布 ============
  console.log('\n=== ② 按 type 分布 ===');

  const byType = await prisma.event.groupBy({
    by: ['type'],
    _count: { _all: true },
  });

  console.table(
    byType
      .map((r) => ({ type: r.type, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
  );

  // ============ ③ 最近 7 天 top user ============
  console.log('\n=== ③ 最近 7 天 top user ===');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const top = await prisma.event.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: sevenDaysAgo } },
    _count: { _all: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 5,
  });

  // top 拿到的是 userId,补一次 username
  const users = await prisma.user.findMany({
    where: { id: { in: top.map((t) => t.userId) } },
    select: { id: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.username]));

  // 补齐:如果近 7 天某 user 没事件,在 top 里不会出现,手动 left-join 补 0
  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { id: 'asc' },
  });
  const topMap = new Map(top.map((t) => [t.userId, t._count._all]));

  const fullTop = allUsers
    .map((u) => ({
      id: u.id,
      username: u.username,
      event_count: topMap.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.event_count - a.event_count)
    .slice(0, 5);

  console.table(fullTop);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
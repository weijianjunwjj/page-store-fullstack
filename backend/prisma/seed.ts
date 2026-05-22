import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 重跑友好:先清空
  await prisma.event.deleteMany()
  await prisma.pageConfig.deleteMany()
  await prisma.user.deleteMany()

  // 5 个用户(明文密码占位)
  const users = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      prisma.user.create({
        data: {
          username: `user0${i + 1}`,
          // TODO(W5): replace plain password with bcrypt hash
          password: 'password123',
        },
      })
    )
  )

  // 20 条 page_config,分散到 5 个 user,~25% archived
  for (let i = 0; i < 20; i++) {
    await prisma.pageConfig.create({
      data: {
        name: `Page Config ${i + 1}`,
        code: `pc_${String(i + 1).padStart(3, '0')}`,
        status: i % 4 === 0 ? 'archived' : 'active',
        configJson: JSON.stringify({ layout: 'grid', columns: 3 }),
        userId: users[i % 5].id,
      },
    })
  }

  // 200 条 event,30 天里只用 22 天(故意留 8 天空白)
  const types = ['login', 'page_view', 'config_change']
  const activeDays = new Set<number>()
  while (activeDays.size < 22) activeDays.add(Math.floor(Math.random() * 30))
  const days = [...activeDays]

  const now = Date.now()
  for (let i = 0; i < 200; i++) {
    const daysAgo = days[Math.floor(Math.random() * days.length)]
    const createdAt = new Date(now - daysAgo * 86400_000)
    createdAt.setHours(Math.floor(Math.random() * 24))

    await prisma.event.create({
      data: {
        type: types[Math.floor(Math.random() * types.length)],
        userId: users[Math.floor(Math.random() * 5)].id,
        payload: JSON.stringify({ ip: '127.0.0.1' }),
        createdAt,
      },
    })
  }

  console.log(`✓ 5 users / 20 page_configs / 200 events`)
  console.log(`  active days: ${days.length}/30  blank: ${30 - days.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
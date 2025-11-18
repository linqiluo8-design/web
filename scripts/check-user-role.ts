import { prisma } from '../lib/prisma'

async function checkUser() {
  const userId = 'cmi4omh4n0000vl40rwy374u4'

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountStatus: true
    }
  })

  console.log('User data:', JSON.stringify(user, null, 2))

  // 检查所有没有 role 的用户
  const usersWithoutRole = await prisma.$queryRaw`
    SELECT id, email, name, role FROM "User" WHERE role IS NULL
  `

  console.log('\nUsers without role:', usersWithoutRole)
}

checkUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

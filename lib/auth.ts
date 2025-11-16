import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" }
      },
      async authorize(credentials) {
        console.log('=== 登录尝试 ===')
        console.log('邮箱:', credentials?.email)

        if (!credentials?.email || !credentials?.password) {
          console.log('❌ 缺少邮箱或密码')
          throw new Error("请输入邮箱和密码")
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        console.log('用户查询结果:', user ? `找到用户 ${user.email}` : '未找到用户')

        if (!user || !user.password) {
          console.log('❌ 用户不存在或密码未设置')
          throw new Error("邮箱或密码错误")
        }

        console.log('用户信息:', {
          id: user.id,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus
        })

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        console.log('密码验证:', isPasswordValid ? '✓ 正确' : '❌ 错误')

        if (!isPasswordValid) {
          console.log('❌ 密码错误')
          throw new Error("邮箱或密码错误")
        }

        // 检查账号审核状态（管理员账号跳过审核）
        console.log('账号状态检查:', user.role === 'ADMIN' ? '管理员，跳过审核' : `普通用户，状态: ${user.accountStatus}`)

        if (user.role !== 'ADMIN') {
          if (user.accountStatus === 'PENDING') {
            console.log('❌ 账号待审核')
            throw new Error("您的账号正在等待管理员审核，请耐心等待")
          }

          if (user.accountStatus === 'REJECTED') {
            console.log('❌ 账号已拒绝')
            throw new Error("您的账号申请已被拒绝，如有疑问请联系管理员")
          }

          // 只有 APPROVED 状态的用户可以登录
          if (user.accountStatus !== 'APPROVED') {
            console.log('❌ 账号状态异常:', user.accountStatus)
            throw new Error("账号状态异常，请联系管理员")
          }
        }

        console.log('✓ 认证成功，返回用户信息')

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
}

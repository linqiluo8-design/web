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
        // 开发环境日志（生产环境不会输出）
        if (process.env.NODE_ENV === 'development') {
          console.log('=== 登录尝试 ===')
        }

        if (!credentials?.email || !credentials?.password) {
          throw new Error("请输入邮箱和密码")
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          throw new Error("邮箱或密码错误")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("邮箱或密码错误")
        }

        // 检查账号审核状态（管理员账号跳过审核）
        if (user.role !== 'ADMIN') {
          if (user.accountStatus === 'PENDING') {
            throw new Error("您的账号正在等待管理员审核，请耐心等待")
          }

          if (user.accountStatus === 'REJECTED') {
            throw new Error("您的账号申请已被拒绝，如有疑问请联系管理员")
          }

          // 只有 APPROVED 状态的用户可以登录
          if (user.accountStatus !== 'APPROVED') {
            throw new Error("账号状态异常，请联系管理员")
          }
        }

        // 开发环境日志
        if (process.env.NODE_ENV === 'development') {
          console.log('✓ 认证成功:', user.email)
        }

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
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
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

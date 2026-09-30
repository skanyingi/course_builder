import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user?.passwordHash) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user?.id) token.id = user.id;

      // next-auth's `Profile` type doesn't carry GitHub's custom fields, so read
      // them off a loosely-typed view of the profile object.
      const gh = profile as Record<string, unknown> | undefined;

      if (account?.provider === "github" && gh?.id != null) {
        // Link the GitHub identity to a User row on first sign-in.
        const githubId = String(gh.id);
        const email = typeof gh.email === "string" ? gh.email : null;

        const existing = await prisma.user.findFirst({
          where: { OR: [{ githubId }, ...(email ? [{ email }] : [])] },
        });

        if (existing) {
          if (!existing.githubId) {
            await prisma.user.update({
              where: { id: existing.id },
              data: { githubId },
            });
          }
          token.id = existing.id;
        } else {
          const created = await prisma.user.create({
            data: {
              githubId,
              email: email ?? `github_${githubId}@users.noreply.github.com`,
              name:
                (typeof gh.name === "string" && gh.name) ||
                (typeof gh.login === "string" && gh.login) ||
                "GitHub user",
              image: typeof gh.avatar_url === "string" ? gh.avatar_url : null,
            },
          });
          token.id = created.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};

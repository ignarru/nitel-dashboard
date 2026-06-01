import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Solo este email puede entrar al dashboard. Se puede sobreescribir por env.
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL ?? "iabyia.business@gmail.com";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Detrás del reverse proxy (Nginx Proxy Manager): confiar en el host reenviado.
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      return profile?.email === ALLOWED_EMAIL;
    },
    session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

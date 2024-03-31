import { type Serve, env } from "bun"
import { and, eq, isNull, or, sql } from "drizzle-orm"
import db from "./db"
import { users } from "./db/schema"

export default {
  async fetch(req) {
    const { searchParams, pathname } = new URL(req.url)
    switch (pathname) {
      case "/new":
      case "/list":
        return searchParams.get("admin") === env.ADMIN_TOKEN
          ? Response.json(
              pathname === "/new"
                ? (await createUser.execute({ id: crypto.randomUUID() }))[0].id
                : await getUsers.all(),
            )
          : new Response(null, { status: 401 })
      case "/check-in":
      case "/check-out": {
        const token = searchParams.get("token")
        const ip = req.headers.get("x-forwarded-for")
        if (!token || !ip)
          return new Response("Please specify a product key.", { status: 401 })
        if (!(await getUser.get({ token, ip })))
          return new Response(
            "This product key is either invalid or already being used, retry in a few minutes or contact the administrator.",
            { status: 401 },
          )
        await updateUser.execute({
          token,
          ip: pathname === "/check-in" ? ip : null,
        })
        return new Response()
      }
      default:
        return new Response(null, { status: 404 })
    }
  },
} satisfies Serve

const getUsers = db.query.users.findMany().prepare()

const getUser = db.query.users
  .findFirst({
    where: and(
      eq(users.id, sql.placeholder("token")),
      or(
        isNull(users.lastActiveIP),
        eq(users.lastActiveIP, sql.placeholder("ip")),
        sql`${users.lastActiveTime} < datetime('now', '-10 minute')`,
      ),
    ),
  })
  .prepare()

const createUser = db
  .insert(users)
  .values({ id: sql.placeholder("id") })
  .returning()
  .prepare()

const updateUser = db
  .update(users)
  .set({
    lastActiveTime: sql`datetime()`,
    lastActiveIP: sql.placeholder("ip").getSQL(),
  })
  .where(eq(users.id, sql.placeholder("token")))
  .prepare()

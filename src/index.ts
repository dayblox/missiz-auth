import swagger from "@elysiajs/swagger"
import { env } from "bun"
import { and, eq, isNull, or, sql } from "drizzle-orm"
import Elysia from "elysia"
import db from "./db"
import { users } from "./db/schema"

const userConf = {
  detail: {
    tags: ["User"],
    parameters: [{ name: "token", in: "query", required: true }],
  },
}

const adminConf = {
  detail: {
    tags: ["Admin"],
    parameters: [{ name: "admin", in: "query", required: true }],
  },
}

new Elysia()
  .use(swagger({ exclude: ["", "/json"], path: "" }))
  .get(
    "/new",
    ({ query: { admin }, error }) =>
      admin === env.ADMIN_TOKEN
        ? createUser.execute({ id: crypto.randomUUID() })
        : error(401),
    adminConf,
  )
  .get(
    "/list",
    ({ query: { admin }, error }) =>
      admin === env.ADMIN_TOKEN ? getUsers.all() : error(401),
    adminConf,
  )
  .get(
    "/check-in",
    async ({ query: { token }, headers: { "x-forwarded-for": ip }, error }) =>
      token && ip && (await getUser.get({ token, ip }))
        ? void updateUser.execute({ token, ip })
        : error(401, env.ERROR),
    userConf,
  )
  .get(
    "/check-out",
    async ({ query: { token }, headers: { "x-forwarded-for": ip }, error }) =>
      token && ip && (await getUser.get({ token, ip }))
        ? void updateUser.execute({ token, ip: null })
        : error(401, env.ERROR),
    userConf,
  )
  .listen(env.PORT)

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

import { env } from "bun"
import { and, eq, isNull, or, sql } from "drizzle-orm"
import Elysia from "elysia"
import db from "./db"
import { users } from "./db/schema"

new Elysia()
  .get("/new", ({ query: { admin }, error }) =>
    admin === env.ADMIN_TOKEN
      ? createUser.execute({ id: crypto.randomUUID() })
      : error(401),
  )
  .get("/list", ({ query: { admin }, error }) =>
    admin === env.ADMIN_TOKEN ? getUsers.all() : error(401),
  )
  .get(
    "/check-:action",
    async ({
      params: { action },
      query: { token },
      headers: { "x-forwarded-for": ip },
      error,
    }) =>
      token && ip && (await getUser.get({ token, ip }))
        ? void updateUser.execute({
            token,
            ip: action === "in" ? ip : null,
          })
        : error(
            401,
            "This product key is either invalid or already being used, retry in a few minutes or contact the administrator.",
          ),
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

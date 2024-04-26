import swagger from "@elysiajs/swagger"
import { env } from "bun"
import { and, eq, isNull, or, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import db from "./db"
import { users } from "./db/schema"

new Elysia()
  .get(
    "/list",
    ({ query: { admin }, error }) =>
      admin === env.ADMIN_TOKEN ? getUsers.all() : error(401),
    adminDetails("List all tokens"),
  )
  .get(
    "/new",
    ({ query: { admin }, error }) =>
      admin === env.ADMIN_TOKEN
        ? createUser.execute({ id: crypto.randomUUID() })
        : error(401),
    adminDetails("Create a new token"),
  )
  .get(
    "/check-in",
    async ({ query: { token }, headers: { "x-forwarded-for": ip }, error }) =>
      token && ip && (await getUser.get({ token, ip }))
        ? void updateUser.execute({ token, ip })
        : error(401, env.ERROR),
    userDetails("Start using a token"),
  )
  .get(
    "/check-out",
    async ({ query: { token }, headers: { "x-forwarded-for": ip }, error }) =>
      token && ip && (await getUser.get({ token, ip }))
        ? void updateUser.execute({ token, ip: null })
        : error(401, env.ERROR),
    userDetails("Free up a token"),
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Missiz Auth",
          version: "1.0.0",
          description: "Simple & fast authentication manager",
        },
      },
      exclude: ["", "/json"],
      path: "",
      scalarConfig: { layout: "classic" },
    }),
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

function adminDetails(summary: string) {
  return {
    detail: {
      tags: ["admin"],
      summary,
      parameters: [
        {
          name: "admin",
          in: "query",
          required: true,
          description: "Admin token",
        },
      ],
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": {
              schema: t.Array(
                t.Object({
                  id: t.String(),
                  lastActiveIP: t.String(),
                  lastActiveTime: t.String(),
                }),
              ),
            },
          },
        },
        401: { description: "Unauthorized" },
      },
    },
  }
}

function userDetails(summary: string) {
  return {
    detail: {
      tags: ["user"],
      summary,
      parameters: [
        {
          name: "token",
          in: "query",
          required: true,
          description: "User token",
        },
      ],
      responses: {
        200: { description: "Success" },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": { schema: t.String({ default: env.ERROR }) },
          },
        },
      },
    },
  }
}

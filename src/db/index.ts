import { createClient } from "@libsql/client"
import { env } from "bun"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"

export default drizzle(
  createClient({ url: env.DB_URL, authToken: env.DB_TOKEN }),
  { schema },
)

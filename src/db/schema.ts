import { sql } from "drizzle-orm"
import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  lastActiveIP: text("last_active_ip"),
  lastActiveTime: text("last_active_time").default(sql`(datetime())`),
})

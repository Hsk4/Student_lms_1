ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint

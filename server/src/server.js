import { assertEnv, env } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { createApp } from "./app.js";

async function main() {
  assertEnv();
  await connectDb(env.MONGO_URI);
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


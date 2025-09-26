import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

(async () => {
  try {
    await connectDB();
    const app = createApp();
    app.listen(env.port, () => {
      console.log(`🚀 Server running at http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();

// This must be the very first import. In ES modules, all imports are
// resolved and executed before any code in this file's body runs — so if
// dotenv.config() were called down below (after importing app.js), app.js
// would already have read process.env.CORS_ORIGIN as undefined by then.
// Importing "dotenv/config" as a side effect runs it immediately, first.
import "dotenv/config";

import connectDB from "./config/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  });
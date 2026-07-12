// This must be the very first import. In ES modules, all imports are
// resolved and executed before any code in this file's body runs — so if
// dotenv.config() were called down below (after importing app.js), app.js
// would already have read process.env.CORS_ORIGIN as undefined by then.
// Importing "dotenv/config" as a side effect runs it immediately, first.
import "dotenv/config";

import connectDB from "./config/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

let server;

connectDB()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  });

// Graceful shutdown so nodemon can properly free the port on restarts (Windows fix)
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// server/server.js
// Starts the Express server on the configured PORT.

import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/v1`);
});
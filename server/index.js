import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Frontend build folder
const distPath = path.join(__dirname, "..", "dist");

app.use(express.static(distPath));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "LBFG Cooperative Server is running",
    system: "LBFG Cooperative Online System"
  });
});

// Basic API
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "LBFG Cooperative API"
  });
});

// React/Vite SPA fallback
app.use((req, res, next) => {
  if (req.method !== "GET") return next();

  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LBFG Cooperative server running on port ${PORT}`);
});

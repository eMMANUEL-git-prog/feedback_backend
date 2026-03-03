import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  process.env.ADMIN_URL || "http://localhost:3002",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Submit feedback
app.post("/api/feedback", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required" });
    }

    const query = `
      INSERT INTO feedback (name, email, message, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, name, email, message, created_at
    `;

    const values = [
      name?.trim() || null,
      email?.trim() || null,
      message.trim(),
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      feedback: result.rows[0],
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// Get all feedback (for admin)
app.get("/api/feedback", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countQuery = "SELECT COUNT(*) FROM feedback";
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, name, email, message, created_at
      FROM feedback
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [parseInt(limit), offset]);

    res.json({
      success: true,
      feedback: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// Get single feedback by ID
app.get("/api/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query =
      "SELECT id, name, email, message, created_at FROM feedback WHERE id = $1";
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({
      success: true,
      feedback: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// Delete feedback (admin)
app.delete("/api/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = "DELETE FROM feedback WHERE id = $1 RETURNING id";
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    res.status(500).json({ error: "Failed to delete feedback" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

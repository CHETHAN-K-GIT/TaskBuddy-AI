import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of Gemini API client to prevent startup crashes when API key is missing
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add your key in the Settings > Secrets panel of AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint to prioritize active tasks based on their deadlines using Gemini AI
  app.post("/api/prioritize", async (req, res) => {
    try {
      const { tasks } = req.body;
      if (!tasks || !Array.isArray(tasks)) {
        res.status(400).json({ error: "Invalid tasks array provided." });
        return;
      }

      const pendingTasks = tasks.filter(t => !t.completed);
      const completedTasks = tasks.filter(t => t.completed);

      if (pendingTasks.length === 0) {
        res.json({
          recommendation: "### All Tasks Done! 🎉\n\nYou have no pending tasks to prioritize. Keep up the amazing work! Add more tasks with deadlines to get smart priority recommendations."
        });
        return;
      }

      const ai = getAI();
      const taskListStr = pendingTasks
        .map((t, idx) => `- **${t.name}** (Deadline: ${t.deadline || "No deadline Specified"})`)
        .join("\n");

      const completedCount = completedTasks.length;

      const prompt = `You are "TaskBuddy AI", an elite smart workflow organizer.
Here is the user's current list of pending tasks:
${taskListStr}

The user has already completed ${completedCount} task(s) in this list.

Please generate a professional, structured, and motivational task prioritization report.
Format your response clearly using markdown. Do not include conversational preambles like "Sure, here is your prioritization list." Go straight to the markdown content.
Include:
1. **🚀 Suggested Priority Order**: Order the tasks logically (prioritizing earlier deadlines first, but use sensible default logic for tasks without deadlines). Include a brief 1-sentence reason why it is ordered that way.
2. **🔔 Crucial Deadlines & Urgency Callouts**: Call out any tasks with very tight deadlines (or note if they look manageable).
3. **💡 TaskBuddy Focus Tip**: Provide a highly practical, custom-tailored tip (e.g., pomodoro technique, time blocking) to help them accomplish these specific tasks efficiently.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ recommendation: response.text });
    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      res.status(500).json({ error: error.message || "An error occurred while using Gemini AI to prioritize your tasks." });
    }
  });

  // Vite development middleware vs production static assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TaskBuddy AI Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting Express + Vite server:", err);
});

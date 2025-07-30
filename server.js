const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

// Note: fetch is built-in to Node.js 18+ so no need to import node-fetch

const app = express();
const PORT = process.env.PORT || 3000;
let API_KEY = process.env.GOOGLE_API_KEY;

// Debug logging
console.log("Server starting...");
console.log("PORT:", PORT);
console.log("API_KEY configured:", API_KEY ? "Yes" : "No");

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    apiKeyConfigured: !!API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Try multiple models in case one is overloaded
async function tryMultipleModels(payload, apiKey) {
  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
  ];
  
  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`);
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`Successfully used model: ${model}`);
        return data;
      }
      
      if (data.error?.message?.includes('overloaded')) {
        console.log(`Model ${model} is overloaded, trying next model...`);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(data.error?.message || `API error: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`Model ${model} failed:`, error.message);
      if (error.message.includes('overloaded') && model !== models[models.length - 1]) {
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('All models are currently overloaded. Please try again later.');
}

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  
  console.log("Received chat request:", userMessage?.substring(0, 50) + "...");
  
  if (!userMessage) {
    console.error("[ERROR] No message provided in request body");
    return res.status(400).json({ error: "Message is required" });
  }
  
  if (!API_KEY || API_KEY === 'your_google_api_key_here') {
    console.error("[ERROR] Gemini API key not set on server. Please configure GOOGLE_API_KEY in .env file");
    return res.status(500).json({ 
      error: "Gemini API key not configured on server. Please check the .env file." 
    });
  }
  
  try {
    const payload = {
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };
    
    console.log("Making request to Gemini API with retry logic...");
    
    const data = await retryWithBackoff(async () => {
      return await tryMultipleModels(payload, API_KEY);
    }, 3, 2000);
    
    const botReply = data.candidates[0].content.parts[0].text;
    console.log("Successfully got response from Gemini API");
    res.json({ reply: botReply });
    
  } catch (err) {
    console.error("[ERROR] Gemini API request failed:", err.message);
    
    let errorMessage = "Failed to get response from AI. ";
    if (err.message.includes('overloaded')) {
      errorMessage += "The AI service is currently experiencing high traffic. Please try again in a moment.";
    } else if (err.message.includes('quota')) {
      errorMessage += "API quota exceeded. Please check your API key limits.";
    } else {
      errorMessage += err.message;
    }
    
    res.status(503).json({ error: errorMessage });
  }
});

// Fallback to index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

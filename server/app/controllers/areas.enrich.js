// server/app/controllers/areas.enrich.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// crude in-memory cache so you don't re-hit the API while developing
const cache = new Map();

export default async function enrichArea(req, res) {
  try {
    const {
      name,            // e.g., "Pasadena"
      city,            // e.g., "Los Angeles"
      state = "CA",
      tags = [],       // e.g., ["quiet suburb","family-friendly"]
      budget,          // optional number
      familySize       // optional
    } = req.body || {};

    if (!name) return res.status(400).json({ error: "name is required" });

    const key = `${name}|${city}|${state}|${tags.join(",")}|${budget || ""}|${familySize || ""}`;
    if (cache.has(key)) return res.json(cache.get(key));

    // Ask the model for *stable, general knowledge*, no live lookups.
    const system = [
      "You are a relocation assistant. Generate stable, historically-known neighborhood summaries.",
      "Do NOT browse or fetch live data. If unsure, answer 'unknown'.",
      "Keep outputs grounded to widely known characteristics up to ~2023 (historic/general).",
      "Return ONLY the JSON described by the schema."
    ].join(" ");

    const user = {
      name, city, state, tags, budget, familySize
    };

    // Ask for structured output (JSON) the UI can consume
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      // You can switch models; 4o-mini is cheap/fast for this
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            `Enrich this place with historically-known info (no live lookups):
             ${JSON.stringify(user)}`
        }
      ],
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "AreaDetails",
          schema: {
            type: "object",
            required: ["title","description","tags","metrics","heroImages"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              tags: { type: "array", items: { type: "string" }, maxItems: 6 },
              heroImages: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
              metrics: {
                type: "object",
                required: ["safety","schools","rent","commute"],
                properties: {
                  safety: {
                    type: "object",
                    required: ["crime","score"],
                    properties: {
                      crime: { type: "string", enum: ["Low","Medium","High","unknown"] },
                      score: { type: "string" } // e.g. "9/10"
                    }
                  },
                  schools: {
                    type: "object",
                    required: ["avg","count"],
                    properties: {
                      avg: { type: "string" },    // "8/10"
                      count: { type: "string" }   // "5"
                    }
                  },
                  rent: {
                    type: "object",
                    required: ["avg"],
                    properties: { avg: { type: "string" } } // "$2,500" (ballpark)
                  },
                  commute: {
                    type: "object",
                    required: ["downtown","airport"],
                    properties: {
                      downtown: { type: "string" }, // "20 min" (approx)
                      airport: { type: "string" }   // "30 min"
                    }
                  }
                }
              }
            },
            additionalProperties: false
          }
        }
      }
    });

    const json = JSON.parse(response.choices[0].message.content);

    // Optional: sanity defaults for heroImages if model returns none
    if (!json.heroImages?.length) {
      json.heroImages = ["https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2000&auto=format&fit=crop"];
    }

    cache.set(key, json);
    return res.json(json);
  } catch (err) {
    console.error("enrichArea error:", err?.response?.data || err);
    return res.status(500).json({ error: "openai_error", detail: String(err.message || err) });
  }
}

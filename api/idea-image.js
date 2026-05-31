const imageModel = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const apiKey = process.env.GEMINI_API_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!apiKey) {
    return res.status(503).json({ error: "missing_api_key" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${imageModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(body) }] }],
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res
        .status(response.status)
        .json({ error: "gemini_image_error", message: text.slice(0, 500) });
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData || part.inline_data
    );
    const inlineData = imagePart?.inlineData || imagePart?.inline_data;

    if (!inlineData?.data) {
      return res.status(502).json({ error: "empty_image_response" });
    }

    const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
    return res.status(200).json({ image: `data:${mimeType};base64,${inlineData.data}` });
  } catch (error) {
    return res.status(500).json({ error: "image_generation_failed", message: error.message });
  }
};

function buildPrompt(body) {
  return `
Create one polished editorial photo-style image for a Russian boredom idea generator card.
Idea title: ${body.title || "Необычная идея"}
Idea steps: ${body.text || ""}
Tags: ${list(body.tags) || "curiosity, creative"}
Mood: ${body.mood || "curious"}
- warm minimal lifestyle photograph, not a poster
- no faces, no text, no logos
- cream background, sage/ochre/peach accents
- landscape crop for a website card
`;
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(", ") : "";
}

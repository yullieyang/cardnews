import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function generateCardNews(topic) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Create a 10-slide card news about: "${topic}"

Return a JSON object with this exact structure:
{
  "title": "overall title for the card news",
  "theme_color": "#hexcolor (vibrant but not too bright, suitable as a gradient base)",
  "slides": [
    {
      "slide_number": 1,
      "type": "title",
      "heading": "main title text",
      "body": "subtitle or brief description"
    },
    {
      "slide_number": 2,
      "type": "content",
      "heading": "point heading",
      "body": "2-3 concise sentences explaining this point"
    },
    ...
    {
      "slide_number": 10,
      "type": "closing",
      "heading": "closing title",
      "body": "summary or call to action"
    }
  ]
}

Rules:
- Slide 1: type "title" — the cover slide
- Slides 2-9: type "content" — one key point per slide
- Slide 10: type "closing" — wrap-up or call to action
- Keep text concise — this is visual card content, not an article
- Write in the same language as the topic
- Return ONLY valid JSON, no markdown fences or extra text`,
      },
    ],
  });

  const text = message.content[0].text;
  const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

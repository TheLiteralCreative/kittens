import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { OpenAI } from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Variation lists
const STYLE   = ["photoreal","cinematic still","watercolor","cel-shaded","3D render","plush toy macro","pencil sketch","vintage film","vaporwave"];
const KITTEN  = ["fluffy tabby","tuxedo","calico","Siamese","Scottish Fold","Maine Coon kitten","hairless sphynx","ginger","silver"];
const BOOTS   = ["cowboy boots","rain boots","combat boots","glitter glam boots","thigh-high boots","Chelsea boots","space boots","patchwork leather boots","striped rubber boots"];
const BASS    = ["Precision-style bass","Jazz-style bass","Rickenbacker-style bass","acoustic bass","short-scale bass","5-string bass","hollow-body bass","headless bass"];
const SETTING = ["tiny stage","bedroom studio","garage jam","rooftop at dusk","cozy living room","forest clearing with fairy lights","record-shop corner","black sweep backdrop","rehearsal space"];
const LIGHT   = ["warm key + soft rim","colored gels","high-key studio","rim-lit fog","moody spotlight","golden hour"];
const CAMERA  = ["low-angle hero","eye-level medium","fisheye close","wide full-body","Dutch tilt","50mm portrait","20mm wide","85mm bokeh"];
const ACTION  = ["mid-strum","plucking","slap bass","tuning","sound-check stance","jumping mid-riff","sitting on amp"];

const NEGATIVE = "no text, no letters, no numbers, no logos, no watermarks, no captions, no signage, no UI, no dogs, no foxes, no rabbits, no adult big cats, no six-string electric guitar, no violin, no cello";

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const buildPrompt = () =>
  `A ${pick(STYLE)} image of a ${pick(KITTEN)} kitten wearing ${pick(BOOTS)}, ` +
  `playing a ${pick(BASS)} bass guitar in a ${pick(SETTING)}. ` +
  `Lighting: ${pick(LIGHT)}. Camera: ${pick(CAMERA)}. Action: ${pick(ACTION)}. ` +
  `High detail, pleasing composition.\nNegative prompt: ${NEGATIVE}`;

app.get("/", (_req, res)=> res.send("Kittens-Boots-Bass Action OK"));

async function generateImageBase64(prompt) {
  const models = ["gpt-image-1", "dall-e-3"];
  for (const model of models) {
    try {
      const resp = await openai.images.generate({
        model,
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      });

      // Prefer base64 if present
      let b64 = resp?.data?.[0]?.b64_json;

      // If API returned a URL instead, fetch it and convert to base64
      if (!b64 && resp?.data?.[0]?.url) {
        const imgRes = await fetch(resp.data[0].url);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        b64 = buf.toString("base64");
      }

      if (b64) return b64;

      console.error("No image payload from", model, JSON.stringify(resp));
    } catch (err) {
      console.error("Image gen failed on", model, err?.response?.data || err?.message || err);
      // try next model
    }
  }
  return null;
}

app.post("/kitten-image", async (_req, res) => {
  try {
    const prompt = buildPrompt();
    const image_b64 = await generateImageBase64(prompt);
    if (!image_b64) return res.status(502).json({ error: "no_image_returned" });
    res.json({ image_b64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on", PORT));

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { OpenAI } from "openai";
import { randomUUID } from "crypto";

const app = express();
app.set("trust proxy", true); // so req.protocol/host work behind Render

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

async function generateImageB64(prompt) {
  const models = ["gpt-image-1", "dall-e-3"];
  for (const model of models) {
    try {
      const resp = await openai.images.generate({
        model,
        prompt,
        n: 1,
        size: "512x512",
        response_format: "b64_json"
      });
      const b64 = resp?.data?.[0]?.b64_json;
      if (b64) return b64;
      console.error("No b64 from", model, JSON.stringify(resp));
    } catch (err) {
      console.error("Image gen failed on", model, err?.response?.data || err?.message || err);
    }
  }
  return null;
}


// Ephemeral in-memory image store (auto-cleans after 1 hour)
const IMG_TTL_MS = 60 * 60 * 1000;
const imgStore = new Map(); // id -> Buffer
function putImage(buf) {
  const id = randomUUID();
  imgStore.set(id, buf);
  setTimeout(() => imgStore.delete(id), IMG_TTL_MS);
  return id;
}
app.get("/img/:id", (req, res) => {
  const buf = imgStore.get(req.params.id);
  if (!buf) return res.status(404).send("Not found");
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=86400"); // 1 day
  res.send(buf);
});

app.post("/kitten-image", async (req, res) => {
  try {
    const prompt = buildPrompt();
    const b64 = await generateImageB64(prompt);
    if (!b64) return res.status(502).json({ error: "no_image_returned" });

    const buf = Buffer.from(b64, "base64");
    const id = putImage(buf);
    const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.get("host")}`;
    const image_url = `${baseUrl}/img/${id}`;

    res.json({ image_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on", PORT));

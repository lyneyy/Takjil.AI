// =============================================================
//  Takjil AI — Vercel Serverless Function
//  Proxy aman ke Alibaba Cloud DashScope (Singapore region)
//  API key tersimpan di Vercel Environment Variables
// =============================================================

const DASHSCOPE_BASE   = 'https://dashscope-intl.aliyuncs.com/api/v1';
const DASHSCOPE_OPENAI = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

// Helper: DashScope native API (untuk image & video)
async function dashscopeFetch(path, options = {}) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY belum diset di environment variables');

  const url = `${DASHSCOPE_BASE}${path}`;
  const res  = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });

  // ✅ FIX: Cek response status dulu sebelum parse JSON
  const text = await res.text();
  if (!text) throw new Error(`API returned empty response (status ${res.status})`);

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error('[dashscopeFetch] Non-JSON response:', text.slice(0, 500));
    throw new Error(`API returned non-JSON response: ${text.slice(0, 200)}`);
  }

  // Log error dari API
  if (json.code && json.code !== 'Success') {
    console.error('[dashscopeFetch] API error:', JSON.stringify(json));
    throw new Error(`API error ${json.code}: ${json.message || 'Unknown'}`);
  }

  return json;
}

// Helper: OpenAI-compatible endpoint (untuk text/Qwen)
async function dashscopeChat(model, messages, temperature = 0.7, maxTokens = 2000) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY belum diset di environment variables');

  const res = await fetch(`${DASHSCOPE_OPENAI}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    // ✅ FIX: Tambah max_tokens agar JSON tidak terpotong
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });

  const text = await res.text();
  if (!text) throw new Error('Qwen API returned empty response');

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('[dashscopeChat] Non-JSON response:', text.slice(0, 500));
    throw new Error('Qwen API returned non-JSON response');
  }

  if (data.error) {
    console.error('[dashscopeChat] API error:', JSON.stringify(data.error));
    throw new Error(`Qwen error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data?.choices?.[0]?.message?.content || '';
}

// Helper: poll task sampai selesai (untuk video async)
async function pollTask(taskId, intervalMs = 8000, maxTries = 45) {
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, intervalMs));

    const result = await dashscopeFetch(`/tasks/${taskId}`);
    const status = result?.output?.task_status;
    console.log(`[pollTask] attempt ${i+1}, status=${status}`);

    if (status === 'SUCCEEDED') return result;
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`Task ${status}: ${result?.output?.message || result?.message || 'Unknown error'}`);
    }
    // PENDING / RUNNING → lanjut poll
  }
  throw new Error('Timeout: task tidak selesai dalam waktu yang ditentukan (6 menit)');
}

// ✅ FIX: Helper untuk parse JSON dari Qwen yang mungkin ada extra text
function parseJsonSafe(raw) {
  if (!raw) throw new Error('Response kosong dari Qwen');

  // Bersihkan markdown code block
  let cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Coba parse langsung
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Cari JSON object dari awal { sampai akhir }
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (e2) {
        console.error('[parseJsonSafe] Failed to parse JSON. Raw (first 500):', cleaned.slice(0, 500));
        throw new Error('Gagal parsing response dari AI. Coba lagi.');
      }
    }
    throw new Error('Tidak ditemukan JSON valid dalam response AI');
  }
}

// =============================================================
//  MODE: recipe
// =============================================================
async function handleRecipe(userPrompt, deepThinking = false) {
  const systemPrompt = deepThinking
    ? `Kamu adalah chef AI master kelas dunia spesialis kuliner Ramadan Indonesia.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
Format JSON wajib (JANGAN tambah field lain di luar format ini):
{
  "mode": "recipe",
  "recipe_name": "Nama Takjil",
  "description": "Deskripsi singkat menggugah selera",
  "origin": "Asal daerah",
  "total_calories": 200,
  "total_price_idr": 15000,
  "serving_size": "4 Porsi",
  "preparation_time": "20 Menit",
  "difficulty": "Mudah",
  "ingredients": [
    {"name": "Bahan", "quantity": 2, "unit": "buah", "price_idr": 5000}
  ],
  "cooking_steps": ["Langkah 1", "Langkah 2", "Langkah 3"],
  "tips": "Tips chef singkat",
  "follow_up": ["Mau aku buatkan videonya?", "Mau lihat foto?"]
}`
    : `Kamu adalah chef AI spesialis takjil Ramadan.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
Format JSON wajib:
{
  "mode": "recipe",
  "recipe_name": "Nama Takjil",
  "description": "Deskripsi singkat",
  "total_calories": 200,
  "total_price_idr": 15000,
  "serving_size": "4 Porsi",
  "preparation_time": "20 Menit",
  "ingredients": [
    {"name": "Bahan", "quantity": 2, "unit": "buah", "price_idr": 5000}
  ],
  "cooking_steps": ["Langkah 1", "Langkah 2"],
  "tips": "Tips chef",
  "follow_up": ["Mau aku buatkan foto-nya juga?", "Mau tau kandungan gizinya?"]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ];
  const model = deepThinking ? 'qwen-max' : 'qwen-plus';
  const temp  = deepThinking ? 0.9 : 0.7;
  const raw   = await dashscopeChat(model, messages, temp, 2000);
  return parseJsonSafe(raw);
}

// =============================================================
//  MODE: nutrition
// =============================================================
async function handleNutrition(userPrompt, deepThinking = false) {
  const systemPrompt = `Kamu adalah ahli gizi spesialis makanan Ramadan.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
Jawaban harus ringkas, jangan terlalu panjang.
Format JSON wajib:
{
  "mode": "nutrition",
  "recipe_name": "Nama Makanan",
  "description": "Deskripsi singkat",
  "serving_size": "1 porsi (100g)",
  "nutrition": {
    "calories":      {"amount": 200, "unit": "kkal", "daily_percent": 10},
    "protein":       {"amount": 5,   "unit": "g",    "daily_percent": 10},
    "carbohydrates": {"amount": 30,  "unit": "g",    "daily_percent": 10},
    "fat":           {"amount": 8,   "unit": "g",    "daily_percent": 10},
    "fiber":         {"amount": 2,   "unit": "g",    "daily_percent": 8},
    "sugar":         {"amount": 15,  "unit": "g",    "daily_percent": 17},
    "sodium":        {"amount": 120, "unit": "mg",   "daily_percent": 5}
  },
  "health_benefits": ["Manfaat 1", "Manfaat 2"],
  "ramadan_tips": "Tips konsumsi saat Ramadan (singkat)",
  "suitable_for": ["Anak-anak", "Dewasa"],
  "follow_up": ["Mau aku buatkan resepnya?", "Mau lihat foto takjil ini?"]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ];
  const model = deepThinking ? 'qwen-max' : 'qwen-plus';
  const raw   = await dashscopeChat(model, messages, 0.3, 1500);
  return parseJsonSafe(raw);
}

// =============================================================
//  MODE: recommend
// =============================================================
async function handleRecommend(userPrompt, deepThinking = false) {
  const systemPrompt = `Kamu adalah chef kreatif spesialis takjil Ramadan.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
Format JSON wajib:
{
  "mode": "recommend",
  "recipe_name": "Rekomendasi Takjil",
  "description": "Berdasarkan bahan yang kamu miliki",
  "recommendations": [
    {
      "name": "Nama Takjil",
      "icon": "🍌",
      "description": "Deskripsi singkat",
      "difficulty": "Mudah",
      "time": "15 menit",
      "calories": "150 kkal",
      "ingredients_needed": ["bahan 1", "bahan 2"],
      "why_good": "Kenapa cocok untuk berbuka"
    }
  ],
  "follow_up": ["Mau aku buatkan resep lengkapnya?", "Mau lihat foto salah satunya?"]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ];
  const model = deepThinking ? 'qwen-max' : 'qwen-plus';
  const raw   = await dashscopeChat(model, messages, 0.8, 2000);
  return parseJsonSafe(raw);
}

// =============================================================
//  MODE: story
// =============================================================
async function handleStory(userPrompt, deepThinking = false) {
  const systemPrompt = `Kamu adalah sejarawan kuliner spesialis makanan Ramadan Indonesia.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
Jawaban harus ringkas.
Format JSON wajib:
{
  "mode": "story",
  "recipe_name": "Nama Takjil",
  "description": "Tagline singkat",
  "origin": {"region": "Daerah asal", "era": "Perkiraan era"},
  "story": "Cerita sejarah (1-2 paragraf singkat)",
  "cultural_significance": "Makna budaya dalam Ramadan (singkat)",
  "fun_facts": ["Fakta 1", "Fakta 2", "Fakta 3"],
  "regional_variations": ["Variasi 1", "Variasi 2"],
  "follow_up": ["Mau aku buatkan resepnya?", "Mau lihat foto takjil ini?"]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ];
  const model = deepThinking ? 'qwen-max' : 'qwen-plus';
  const raw   = await dashscopeChat(model, messages, 0.7, 1800);
  return parseJsonSafe(raw);
}

// =============================================================
//  MODE: image — via wan2.6-image (sync)
// =============================================================
async function handleImage(userPrompt) {
  const cleanPrompt = userPrompt
    .replace(/berikan|buatkan|generate|buat|tampilkan|perlihatkan|foto|gambar|image|picture|visualisasi/gi, '')
    .trim();

  const imagePrompt = `Realistic high-quality food photography of Indonesian Ramadan takjil: ${cleanPrompt}. 
Served in traditional bowl or glass, appetizing presentation, warm golden hour lighting, 
wooden table background, vibrant colors, professional food photography, 
8K resolution, mouth-watering, no text, no watermark.`;

  const body = {
    model: 'wan2.6-image',
    input: {
      messages: [{
        role: 'user',
        content: [{ text: imagePrompt }]
      }]
    },
    parameters: {
      size: '1024*1024',
      watermark: false,
      prompt_extend: true,
      n: 1,
    }
  };

  const data = await dashscopeFetch('/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const contentArr = data?.output?.choices?.[0]?.message?.content;
  const imageUrl   = Array.isArray(contentArr)
    ? contentArr.find(c => c.image)?.image
    : null;

  if (!imageUrl) {
    console.error('[handleImage] Full response:', JSON.stringify(data));
    throw new Error('Gagal mendapatkan URL gambar dari API');
  }

  return {
    mode: 'image',
    recipe_name: 'Gambar Takjil Generated',
    description: userPrompt,
    image_url: imageUrl,
    visual_prompt: imagePrompt,
  };
}

// =============================================================
//  MODE: video — via wan2.6-t2v (async, polling)
// =============================================================
async function handleVideo(userPrompt) {
  // ✅ FIX: Durasi max 10s (batas wan2.6-t2v di Singapore = 5 atau 10s)
  // Gunakan 5 sebagai default aman
  let duration = 5;
  const durMatch = userPrompt.match(/(\d+)\s*(detik|sekon|second|s\b)/i);
  if (durMatch) {
    const requested = parseInt(durMatch[1]);
    duration = Math.min(Math.max(requested, 2), 10); // ✅ max 10s, bukan 15s
  }

  const videoPrompt = `Indonesian Ramadan iftar food preparation: ${userPrompt}. 
Cinematic food video, warm kitchen lighting, hands preparing traditional food, 
close-up shots of ingredients, steam rising, beautiful plating, 
professional cooking video style.`;

  const body = {
    model: 'wan2.6-t2v',
    input: { prompt: videoPrompt },
    parameters: {
      size: '1280*720',
      duration: duration,
      watermark: false,
      prompt_extend: true,
    }
  };

  console.log('[handleVideo] Submitting task, duration=', duration);

  // Step 1: Submit async task
  // ✅ FIX: dashscopeFetch sudah handle error, jadi tidak perlu check manual
  const taskData = await dashscopeFetch('/services/aigc/video-generation/video-synthesis', {
    method: 'POST',
    headers: { 'X-DashScope-Async': 'enable' },
    body: JSON.stringify(body),
  });

  console.log('[handleVideo] taskData:', JSON.stringify(taskData));

  const taskId = taskData?.output?.task_id;
  if (!taskId) {
    throw new Error(`Gagal membuat task video. Response: ${JSON.stringify(taskData)}`);
  }

  console.log('[handleVideo] Task created, taskId=', taskId);

  // Step 2: Poll sampai selesai
  const result   = await pollTask(taskId, 8000, 45);
  const videoUrl = result?.output?.video_url;
  if (!videoUrl) {
    console.error('[handleVideo] No video_url in result:', JSON.stringify(result));
    throw new Error('Gagal mendapatkan URL video');
  }

  return {
    mode: 'video',
    recipe_name: 'Video Takjil Generated',
    description: userPrompt,
    video_url: videoUrl,
    video_prompt: videoPrompt,
  };
}

// =============================================================
//  MODE: greeting
// =============================================================
function isGreeting(prompt) {
  const p = prompt.toLowerCase().trim();
  const greetings = [
    'halo', 'hai', 'hi', 'hello', 'hey', 'hei', 'hallo',
    'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam',
    'assalamu', 'assalamualaikum', 'waalaikumsalam', 'permisi',
    'apa kabar', 'gimana kabar', 'siapa kamu', 'kamu siapa',
    'apa itu takjil', 'takjil ai itu apa', 'perkenalkan', 'kenalan'
  ];
  return greetings.some(g => p.includes(g)) && p.length < 60;
}

function handleGreeting(prompt) {
  const p = prompt.toLowerCase();
  let reply = '';

  if (p.includes('siapa') || p.includes('kamu') || p.includes('perkenalkan') || p.includes('kenalan') || p.includes('apa itu')) {
    reply = `Halo! Aku **Takjil.AI** 🌙✨

Aku adalah asisten AI spesialis takjil Ramadan yang dibuat dengan ❤️ menggunakan teknologi Alibaba Cloud.

**Yang bisa aku lakukan:**
- 👨‍🍳 **Resep** — buatkan resep takjil lengkap dengan bahan & langkah
- 📊 **Nutrisi** — info kalori & kandungan gizi takjil
- 💡 **Rekomendasi** — saran takjil dari bahan yang kamu punya
- 📖 **Cerita** — sejarah & asal usul takjil Indonesia
- 🎨 **Foto** — generate gambar takjil yang menggugah selera
- 🎬 **Video** — buat video tutorial memasak takjil

Mau mulai dengan apa? 😊`;
  } else if (p.includes('apa kabar') || p.includes('gimana kabar')) {
    reply = `Alhamdulillah baik! Siap membantu kamu menyiapkan takjil terbaik untuk Ramadan ini 🌙

Mau resep takjil apa hari ini?`;
  } else if (p.includes('pagi')) {
    reply = `Selamat pagi! ☀️ Semoga harimu penuh berkah di bulan Ramadan ini.

Sudah siap merencanakan takjil berbuka hari ini? Aku bisa bantu buatkan resep, foto, bahkan video tutorial-nya! 😊`;
  } else if (p.includes('siang')) {
    reply = `Selamat siang! 🌤️ Semangat puasanya ya!

Mau aku bantu cariin ide takjil untuk berbuka nanti? Tinggal bilang bahan yang kamu punya! 😊`;
  } else if (p.includes('sore')) {
    reply = `Selamat sore! 🌅 Sebentar lagi buka puasa nih!

Masih bingung mau buat takjil apa? Ceritain aja bahan yang ada di dapur! 🍹`;
  } else if (p.includes('malam')) {
    reply = `Selamat malam! 🌙 Semoga ibadah Ramadan hari ini penuh berkah.

Ada yang bisa aku bantu untuk persiapan sahur atau takjil besok? 😊`;
  } else if (p.includes('assalam') || p.includes('waalaikum')) {
    reply = `Wa'alaikumsalam warahmatullahi wabarakatuh! 🌙

Selamat datang di Takjil.AI! Aku siap membantu kamu menyiapkan takjil terbaik untuk berbuka puasa. Mau buat apa hari ini?`;
  } else {
    reply = `Halo! Selamat datang di **Takjil.AI** 🌙✨

Aku siap membantu kamu menemukan, membuat, dan memvisualisasikan takjil Ramadan favoritmu!

Coba tanyakan:
- *"Resep es teler"*
- *"Berikan foto kolak pisang"*
- *"Buatkan video cara membuat cendol"*
- *"Berapa kalori es campur?"*

Mau mulai dengan apa? 😊`;
  }

  return {
    mode: 'greeting',
    recipe_name: 'Takjil.AI',
    description: 'Asisten AI Takjil Ramadan',
    greeting_text: reply,
  };
}

// =============================================================
//  INTENT DETECTION
// =============================================================
function detectMode(prompt, explicitMode) {
  const p = prompt.toLowerCase().trim();

  if (isGreeting(prompt)) return 'greeting';

  const videoWords = ['video', 'film', 'animasi', 'rekaman', 'klip', 'clip'];
  const imageWords = ['foto', 'gambar', 'image', 'picture', 'visualisasi', 'ilustrasi'];
  if (videoWords.some(w => p.includes(w))) return 'video';
  if (imageWords.some(w => p.includes(w))) return 'image';

  if (explicitMode && explicitMode !== 'auto') return explicitMode;

  const nutritionWords = [
    'kalori', 'nutrisi', 'gizi', 'protein', 'karbohidrat', 'lemak',
    'kandungan', 'nilai gizi', 'diet', 'kkal', 'berapa kalori', 'info gizi',
    'vitamin', 'mineral'
  ];
  if (nutritionWords.some(w => p.includes(w))) return 'nutrition';

  const recommendWords = [
    'punya bahan', 'ada bahan', 'bahan yang ada', 'hanya punya', 'cuma punya',
    'pakai bahan', 'sisa bahan', 'rekomendasi', 'rekomendasikan', 'sarankan',
    'buat apa', 'masak apa', 'takjil apa', 'ide takjil', 'enaknya apa',
  ];
  if (recommendWords.some(w => p.includes(w))) return 'recommend';

  const storyWords = [
    'sejarah', 'asal', 'asal usul', 'asal-usul', 'cerita', 'kisah',
    'tradisi', 'budaya', 'history', 'berasal', 'daerah mana', 'makna',
    'filosofi', 'asal mula',
  ];
  if (storyWords.some(w => p.includes(w))) return 'story';

  return 'recipe';
}

// =============================================================
//  MAIN HANDLER — entry point Vercel
// =============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { mode: rawMode, prompt, deepThinking = false } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'prompt wajib diisi' });
  }

  const mode = detectMode(prompt, rawMode);
  console.log(`[generate] rawMode=${rawMode} → detectedMode=${mode}, prompt="${prompt.slice(0,60)}"`);

  try {
    let data;

    switch (mode) {
      case 'greeting':  data = handleGreeting(prompt);                      break;
      case 'recipe':    data = await handleRecipe(prompt, deepThinking);    break;
      case 'nutrition': data = await handleNutrition(prompt, deepThinking); break;
      case 'recommend': data = await handleRecommend(prompt, deepThinking); break;
      case 'story':     data = await handleStory(prompt, deepThinking);     break;
      case 'image':     data = await handleImage(prompt);                   break;
      case 'video':     data = await handleVideo(prompt);                   break;
      default:
        return res.status(400).json({ success: false, error: `Mode tidak dikenal: ${mode}` });
    }

    return res.status(200).json({ success: true, data });

  } catch (err) {
    console.error(`[generate] Error mode=${mode}:`, err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan pada server',
    });
  }
}

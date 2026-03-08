// =============================================================
//  Takjil AI — Vercel Serverless Function
//  Proxy aman ke Alibaba Cloud DashScope (Singapore region)
//  API key tersimpan di Vercel Environment Variables, tidak
//  pernah terekspos ke browser.
// =============================================================

const DASHSCOPE_BASE     = 'https://dashscope-intl.aliyuncs.com/api/v1';
const DASHSCOPE_OPENAI   = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

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
  return res.json();
}

// Helper: OpenAI-compatible endpoint (untuk text/Qwen)
async function dashscopeChat(model, messages, temperature = 0.7) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY belum diset di environment variables');

  const res = await fetch(`${DASHSCOPE_OPENAI}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// Helper: poll task sampai selesai (untuk image async & video)
async function pollTask(taskId, intervalMs = 5000, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const result = await dashscopeFetch(`/tasks/${taskId}`);
    const status = result?.output?.task_status;
    if (status === 'SUCCEEDED') return result;
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`Task ${status}: ${result?.message || 'Unknown error'}`);
    }
    // PENDING / RUNNING → lanjut poll
  }
  throw new Error('Timeout: task tidak selesai dalam waktu yang ditentukan');
}

// =============================================================
//  MODE: recipe — generate resep lengkap via Qwen 3.5
// =============================================================
async function handleRecipe(userPrompt, deepThinking = false) {
  const systemPrompt = deepThinking
    ? `Kamu adalah chef AI master kelas dunia spesialis kuliner Ramadan Indonesia.
Lakukan analisis mendalam dan berikan resep yang sangat detail dan profesional.
Pertimbangkan: teknik memasak tradisional, variasi regional, tips nutrisi, dan substitusi bahan.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
Format JSON wajib:
{
  "mode": "recipe",
  "recipe_name": "Nama Takjil",
  "description": "Deskripsi panjang dan menggugah selera",
  "origin": "Asal daerah takjil ini",
  "total_calories": 200,
  "total_price_idr": 15000,
  "serving_size": "4 Porsi",
  "preparation_time": "20 Menit",
  "difficulty": "Mudah/Sedang/Sulit",
  "ingredients": [
    {"name": "Nama Bahan", "quantity": 2, "unit": "buah", "price_idr": 5000, "substitution": "Alternatif bahan jika tidak ada"}
  ],
  "cooking_steps": ["Langkah sangat detail 1", "Langkah sangat detail 2"],
  "tips": "Tips chef profesional yang sangat detail",
  "variations": ["Variasi 1", "Variasi 2"],
  "storage": "Cara penyimpanan"
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
    {"name": "Nama Bahan", "quantity": 2, "unit": "buah", "price_idr": 5000}
  ],
  "cooking_steps": ["Langkah 1", "Langkah 2"],
  "tips": "Tips chef"
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ];
  const model = deepThinking ? 'qwen-max' : 'qwen-plus';
  const temp  = deepThinking ? 0.9 : 0.7;
  const raw   = await dashscopeChat(model, messages, temp);
  const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(cleaned);
}

// =============================================================
//  MODE: nutrition — info kalori & gizi via Qwen 3.5
// =============================================================
async function handleNutrition(userPrompt, deepThinking = false) {
  const systemPrompt = `Kamu adalah ahli gizi spesialis makanan Ramadhan.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
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
  "ramadan_tips": "Tips konsumsi saat Ramadhan",
  "suitable_for": ["Anak-anak", "Dewasa"]
}`;

  const body = {
  };  // end body (unused, kept for reference)

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ];
  const model   = deepThinking ? 'qwen-max' : 'qwen-plus';
  const temp    = deepThinking ? 0.9 : 0.3;
  const raw     = await dashscopeChat(model, messages, temp);
  const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(cleaned);
}

// =============================================================
//  MODE: recommend — rekomendasi dari bahan yang ada
// =============================================================
async function handleRecommend(userPrompt, deepThinking = false) {
  const systemPrompt = `Kamu adalah chef kreatif spesialis takjil Ramadhan.
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
  ]
}`;

  const body = {
  };  // end body (unused, kept for reference)

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ];
  const model   = deepThinking ? 'qwen-max' : 'qwen-plus';
  const temp    = deepThinking ? 0.9 : 0.8;
  const raw     = await dashscopeChat(model, messages, temp);
  const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(cleaned);
}

// =============================================================
//  MODE: story — sejarah & asal usul takjil
// =============================================================
async function handleStory(userPrompt, deepThinking = false) {
  const systemPrompt = `Kamu adalah sejarawan kuliner spesialis makanan Ramadhan Indonesia.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
Format JSON wajib:
{
  "mode": "story",
  "recipe_name": "Nama Takjil",
  "description": "Tagline singkat",
  "origin": {"region": "Daerah asal", "era": "Perkiraan era"},
  "story": "Cerita sejarah panjang (2-3 paragraf)",
  "cultural_significance": "Makna budaya dalam Ramadhan",
  "fun_facts": ["Fakta 1", "Fakta 2", "Fakta 3"],
  "regional_variations": ["Variasi 1", "Variasi 2"]
}`;

  const body = {
  };  // end body (unused, kept for reference)

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt }
  ];
  const model   = deepThinking ? 'qwen-max' : 'qwen-plus';
  const temp    = deepThinking ? 0.9 : 0.7;
  const raw     = await dashscopeChat(model, messages, temp);
  const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(cleaned);
}

// =============================================================
//  MODE: image — generate gambar takjil via Qwen Image 2.0
// =============================================================
async function handleImage(userPrompt) {
  // Buat prompt yang lebih deskriptif untuk hasil gambar lebih baik
  const imagePrompt = `Beautiful Indonesian Ramadan iftar food photography: ${userPrompt}. 
Appetizing, warm golden lighting, traditional wooden table, elegant plating, 
high quality food photography style, vibrant colors, shallow depth of field.`;

  const body = {
    model: 'qwen-image-2.0-pro',
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
    }
  };

  const data = await dashscopeFetch('/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const imageUrl = data?.output?.choices?.[0]?.message?.content?.[0]?.image;
  if (!imageUrl) throw new Error('Gagal mendapatkan URL gambar dari API');

  return {
    mode: 'image',
    recipe_name: 'Gambar Takjil Generated',
    description: userPrompt,
    image_url: imageUrl,
    visual_prompt: imagePrompt,
  };
}

// =============================================================
//  MODE: video — generate video takjil via Wan2.6
// =============================================================
async function handleVideo(userPrompt) {
  // Step 1: Buat video prompt yang baik
  const videoPrompt = `Indonesian Ramadan iftar food preparation: ${userPrompt}. 
Cinematic food video, warm kitchen lighting, hands preparing traditional food, 
close-up shots of ingredients, steam rising, beautiful plating, 
professional cooking video style.`;

  const body = {
    model: 'wan2.1-t2v-turbo', // model paling cepat & hemat untuk hackathon
    input: { prompt: videoPrompt },
    parameters: {
      size: '1280*720',
      duration: 5,
      watermark: false,
      prompt_extend: true,
    }
  };

  // Step 2: Submit task
  const taskData = await dashscopeFetch('/services/aigc/video-generation/video-synthesis', {
    method: 'POST',
    headers: { 'X-DashScope-Async': 'enable' },
    body: JSON.stringify(body),
  });

  const taskId = taskData?.output?.task_id;
  if (!taskId) throw new Error('Gagal membuat task video');

  // Step 3: Poll sampai selesai (video butuh 1-5 menit)
  const result  = await pollTask(taskId, 8000, 45); // poll tiap 8 detik, max 45x = 6 menit
  const videoUrl = result?.output?.video_url;
  if (!videoUrl) throw new Error('Gagal mendapatkan URL video');

  return {
    mode: 'video',
    recipe_name: 'Video Takjil Generated',
    description: userPrompt,
    video_url: videoUrl,
    video_prompt: videoPrompt,
  };
}

// =============================================================
//  MAIN HANDLER — entry point Vercel
// =============================================================
export default async function handler(req, res) {
  // CORS — izinkan semua origin (untuk hackathon)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { mode, prompt, deepThinking = false } = req.body || {};

  if (!mode || !prompt) {
    return res.status(400).json({ success: false, error: 'mode dan prompt wajib diisi' });
  }

  try {
    let data;

    switch (mode) {
      case 'recipe':    data = await handleRecipe(prompt, deepThinking);    break;
      case 'nutrition': data = await handleNutrition(prompt, deepThinking); break;
      case 'recommend': data = await handleRecommend(prompt, deepThinking); break;
      case 'story':     data = await handleStory(prompt, deepThinking);     break;
      case 'image':     data = await handleImage(prompt);     break;
      case 'video':     data = await handleVideo(prompt);     break;
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

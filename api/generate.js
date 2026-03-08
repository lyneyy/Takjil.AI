// =============================================================
//  Takjil AI — Vercel Serverless Function
//  Proxy aman ke Alibaba Cloud DashScope (Singapore region)
// =============================================================

const DASHSCOPE_BASE   = 'https://dashscope-intl.aliyuncs.com/api/v1';
const DASHSCOPE_OPENAI = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

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

async function pollTask(taskId, intervalMs = 8000, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const result = await dashscopeFetch(`/tasks/${taskId}`);
    const status = result?.output?.task_status;
    if (status === 'SUCCEEDED') return result;
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`Task ${status}: ${result?.message || 'Unknown error'}`);
    }
  }
  throw new Error('Timeout: task tidak selesai dalam waktu yang ditentukan');
}

// =============================================================
//  MODE: recipe
// =============================================================
async function handleRecipe(userPrompt, deepThinking = false) {
  const systemPrompt = deepThinking
    ? `Kamu adalah chef AI master kelas dunia spesialis kuliner Ramadan Indonesia.
Lakukan analisis mendalam dan berikan resep yang sangat detail dan profesional.
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
    {"name": "Nama Bahan", "quantity": 2, "unit": "buah", "price_idr": 5000, "substitution": "Alternatif bahan"}
  ],
  "cooking_steps": ["Langkah sangat detail 1", "Langkah sangat detail 2"],
  "tips": "Tips chef profesional yang sangat detail",
  "variations": ["Variasi 1", "Variasi 2"],
  "storage": "Cara penyimpanan",
  "follow_up": ["Mau aku buatkan videonya?", "Mau lihat foto presentasinya?"]
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
  "tips": "Tips chef",
  "follow_up": ["Mau aku buatkan foto-nya juga?", "Mau tau kandungan gizinya?"]
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
//  MODE: nutrition
// =============================================================
async function handleNutrition(userPrompt, deepThinking = false) {
  const systemPrompt = `Kamu adalah ahli gizi spesialis makanan Ramadan.
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
  "ramadan_tips": "Tips konsumsi saat Ramadan",
  "suitable_for": ["Anak-anak", "Dewasa"],
  "follow_up": ["Mau aku buatkan resepnya?", "Mau lihat foto takjil ini?"]
}`;
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
  const model   = deepThinking ? 'qwen-max' : 'qwen-plus';
  const temp    = deepThinking ? 0.9 : 0.8;
  const raw     = await dashscopeChat(model, messages, temp);
  const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(cleaned);
}

// =============================================================
//  MODE: story
// =============================================================
async function handleStory(userPrompt, deepThinking = false) {
  const systemPrompt = `Kamu adalah sejarawan kuliner spesialis makanan Ramadan Indonesia.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown code block.
Format JSON wajib:
{
  "mode": "story",
  "recipe_name": "Nama Takjil",
  "description": "Tagline singkat",
  "origin": {"region": "Daerah asal", "era": "Perkiraan era"},
  "story": "Cerita sejarah panjang (2-3 paragraf)",
  "cultural_significance": "Makna budaya dalam Ramadan",
  "fun_facts": ["Fakta 1", "Fakta 2", "Fakta 3"],
  "regional_variations": ["Variasi 1", "Variasi 2"],
  "follow_up": ["Mau aku buatkan resepnya?", "Mau lihat foto takjil ini?"]
}`;
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
//  MODE: image — generate gambar via wanx-v1
// =============================================================
async function handleImage(userPrompt) {
  const cleanPrompt = userPrompt
    .replace(/berikan|buatkan|generate|buat|tampilkan|perlihatkan|foto|gambar|image|picture|visualisasi/gi, '')
    .trim();

  const imagePrompt = `Realistic high-quality food photography of Indonesian Ramadan takjil: ${cleanPrompt}. 
Served in traditional bowl or glass, appetizing presentation, warm golden hour lighting, 
wooden table background, vibrant colors, professional food photography, 
8K resolution, mouth-watering, no text, no watermark.`;

  // Submit async task
  const taskData = await dashscopeFetch('/services/aigc/text2image/image-synthesis', {
    method: 'POST',
    headers: { 'X-DashScope-Async': 'enable' },
    body: JSON.stringify({
      model: 'wanx-v1',
      input: { prompt: imagePrompt },
      parameters: {
        style: '<photography>',
        size: '1024*1024',
        n: 1,
        watermark: false,
      }
    }),
  });

  const taskId = taskData?.output?.task_id;
  if (!taskId) {
    console.error('[image] taskData:', JSON.stringify(taskData));
    throw new Error(`Gagal membuat task gambar: ${JSON.stringify(taskData?.message || taskData)}`);
  }

  // Poll sampai selesai
  const result   = await pollTask(taskId, 5000, 30);
  const imageUrl = result?.output?.results?.[0]?.url
                || result?.output?.result?.[0]?.url
                || result?.output?.url;

  if (!imageUrl) {
    console.error('[image] poll result:', JSON.stringify(result));
    throw new Error('Gagal mendapatkan URL gambar dari API');
  }

  return {
    mode: 'image',
    recipe_name: 'Gambar Takjil Generated',
    description: cleanPrompt,
    image_url: imageUrl,
    visual_prompt: imagePrompt,
  };
}

// =============================================================
//  MODE: video — generate video via wan2.6-t2v
// =============================================================
async function handleVideo(userPrompt) {
  let duration = 5;
  const durMatch = userPrompt.match(/(\d+)\s*(detik|sekon|second|s\b)/i);
  if (durMatch) {
    const requested = parseInt(durMatch[1]);
    duration = Math.min(Math.max(requested, 2), 15);
  }

  const videoPrompt = `Indonesian Ramadan iftar food preparation: ${userPrompt}. 
Cinematic food video, warm kitchen lighting, hands preparing traditional food, 
close-up shots of ingredients, steam rising, beautiful plating, 
professional cooking video style.`;

  const taskData = await dashscopeFetch('/services/aigc/video-generation/video-synthesis', {
    method: 'POST',
    headers: { 'X-DashScope-Async': 'enable' },
    body: JSON.stringify({
      model: 'wan2.6-t2v',
      input: { prompt: videoPrompt },
      parameters: {
        size: '1280*720',
        duration: duration,
        watermark: false,
        prompt_extend: true,
      }
    }),
  });

  const taskId = taskData?.output?.task_id;
  if (!taskId) {
    console.error('[video] taskData:', JSON.stringify(taskData));
    throw new Error(`Gagal membuat task video: ${JSON.stringify(taskData?.message || taskData)}`);
  }

  const result   = await pollTask(taskId, 8000, 45);
  const videoUrl = result?.output?.video_url
                || result?.output?.results?.[0]?.url;

  if (!videoUrl) {
    console.error('[video] poll result:', JSON.stringify(result));
    throw new Error('Gagal mendapatkan URL video');
  }

  return {
    mode: 'video',
    recipe_name: 'Video Takjil Generated',
    description: userPrompt,
    video_url: videoUrl,
    video_prompt: videoPrompt,
    duration: duration,
  };
}

// =============================================================
//  GREETING
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
    reply = `Halo! Aku **Takjil.AI** 🌙✨\n\nAku adalah asisten AI spesialis takjil Ramadan yang dibuat dengan ❤️ menggunakan teknologi Alibaba Cloud.\n\n**Yang bisa aku lakukan:**\n- 👨‍🍳 **Resep** — buatkan resep takjil lengkap\n- 📊 **Nutrisi** — info kalori & kandungan gizi\n- 💡 **Rekomendasi** — saran takjil dari bahan yang kamu punya\n- 📖 **Cerita** — sejarah & asal usul takjil Indonesia\n- 🎨 **Foto** — generate gambar takjil\n- 🎬 **Video** — buat video tutorial memasak takjil\n\nMau mulai dengan apa? 😊`;
  } else if (p.includes('apa kabar') || p.includes('gimana kabar')) {
    reply = `Alhamdulillah baik! Siap membantu kamu menyiapkan takjil terbaik untuk Ramadan ini 🌙\n\nMau resep takjil apa hari ini?`;
  } else if (p.includes('pagi')) {
    reply = `Selamat pagi! ☀️ Semoga harimu penuh berkah di bulan Ramadan ini.\n\nSudah siap merencanakan takjil berbuka hari ini? 😊`;
  } else if (p.includes('siang')) {
    reply = `Selamat siang! 🌤️ Semangat puasanya ya!\n\nMau aku bantu cariin ide takjil untuk berbuka nanti? 😊`;
  } else if (p.includes('sore')) {
    reply = `Selamat sore! 🌅 Sebentar lagi buka puasa nih!\n\nMasih bingung mau buat takjil apa? 🍹`;
  } else if (p.includes('malam')) {
    reply = `Selamat malam! 🌙 Semoga ibadah Ramadan hari ini penuh berkah.\n\nAda yang bisa aku bantu untuk persiapan sahur atau takjil besok? 😊`;
  } else if (p.includes('assalam') || p.includes('waalaikum')) {
    reply = `Wa'alaikumsalam warahmatullahi wabarakatuh! 🌙\n\nSelamat datang di Takjil.AI! Aku siap membantu kamu menyiapkan takjil terbaik. Mau buat apa hari ini?`;
  } else {
    reply = `Halo! Selamat datang di **Takjil.AI** 🌙✨\n\nAku siap membantu kamu menemukan, membuat, dan memvisualisasikan takjil Ramadan favoritmu!\n\nCoba tanyakan:\n- *"Resep es teler"*\n- *"Berikan foto kolak pisang"*\n- *"Buatkan video cara membuat cendol"*\n- *"Berapa kalori es campur?"*\n\nMau mulai dengan apa? 😊`;
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
function detectMode(prompt) {
  const p = prompt.toLowerCase().trim();

  if (isGreeting(prompt)) return 'greeting';

  const videoWords = ['video', 'film', 'animasi', 'rekaman', 'klip', 'clip'];
  const imageWords = ['foto', 'gambar', 'image', 'picture', 'visualisasi', 'ilustrasi'];
  if (videoWords.some(w => p.includes(w))) return 'video';
  if (imageWords.some(w => p.includes(w))) return 'image';

  const nutritionWords = ['kalori', 'nutrisi', 'gizi', 'protein', 'karbohidrat', 'lemak', 'kandungan', 'nilai gizi', 'diet', 'kkal', 'berapa kalori', 'info gizi', 'vitamin', 'mineral'];
  if (nutritionWords.some(w => p.includes(w))) return 'nutrition';

  const recommendWords = ['punya bahan', 'ada bahan', 'bahan yang ada', 'hanya punya', 'cuma punya', 'pakai bahan', 'sisa bahan', 'rekomendasi', 'rekomendasikan', 'sarankan', 'buat apa', 'masak apa', 'takjil apa', 'ide takjil', 'enaknya apa', 'cocok apa'];
  if (recommendWords.some(w => p.includes(w))) return 'recommend';

  const storyWords = ['sejarah', 'asal', 'asal usul', 'cerita', 'kisah', 'tradisi', 'budaya', 'history', 'berasal', 'daerah mana', 'makna', 'filosofi', 'asal mula'];
  if (storyWords.some(w => p.includes(w))) return 'story';

  return 'recipe';
}

// =============================================================
//  MAIN HANDLER
// =============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { prompt, deepThinking = false } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'prompt wajib diisi' });
  }

  const mode = detectMode(prompt);
  console.log(`[generate] detectedMode=${mode} prompt="${prompt.substring(0,50)}"`);

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

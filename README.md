<div align="center">

# 🌙 Takjil.AI

### *Generator Konten Takjil Ramadan Berbasis AI*

![Alibaba Cloud](https://img.shields.io/badge/Powered%20by-Alibaba%20Cloud-FF6A00?style=for-the-badge)
![Qwen](https://img.shields.io/badge/AI-Qwen%20%7C%20Wan-6ee7b7?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel)
![Hackathon](https://img.shields.io/badge/Hackathon-AI%20×%20Creativity%202026-a855f7?style=for-the-badge)

**Hackathon Submission — AI × Creativity: The Next Big Thing!**
*Organized by Alibaba Cloud & Bluepower Technology*

</div>

---

## ✨ Tentang Takjil.AI

**Takjil.AI** adalah aplikasi web berbasis AI yang membantu umat Islam di Indonesia menemukan inspirasi takjil untuk berbuka puasa selama Ramadan. Dengan memanfaatkan kekuatan **Qwen** dan **Wan** dari Alibaba Cloud, pengguna dapat membuat resep, gambar, video, hingga mengetahui informasi gizi takjil hanya dalam hitungan detik.

> *"Bulan Ramadan menjadi berkah."*

---

## 🎯 Fitur Utama

| Fitur | Deskripsi | Model AI |
|-------|-----------|----------|
| 🍽️ **Resep Takjil** | Generate resep lengkap dengan bahan, langkah, harga estimasi | Qwen Plus |
| 📊 **Info Nutrisi** | Kalori, protein, karbo, lemak, dan tips gizi Ramadan | Qwen Plus |
| 📝 **Rekomendasi** | Saran takjil berdasarkan bahan yang tersedia di rumah | Qwen Plus |
| 🕌 **Sejarah Takjil** | Asal-usul & makna budaya takjil dalam tradisi Ramadan | Qwen Plus |
| 🎨 **Gambar Takjil** | Generate foto takjil berkualitas tinggi | Wanx |
| 🎬 **Video Masakan** | Generate video tutorial memasak takjil | Wan 2.6 T2V Turbo |

---

## 🛠️ Tech Stack

- **Frontend** — HTML5, CSS3, Vanilla JavaScript (single-page)
- **Backend** — Vercel Serverless Functions (Node.js)
- **AI Models** — Alibaba Cloud Model Studio (DashScope)
  - Text: `qwen-plus`
  - Image: `qwen-image-2.0-pro`
  - Video: `wan2.1-t2v-turbo`
- **Hosting** — Vercel
- **Development** — Qoder (Agentic Coding Platform)

---

## 🚀 Cara Penggunaan

1. Buka **[Live Demo](#)**
2. Pilih salah satu dari 6 template cepat **atau** ketik permintaanmu sendiri
3. Klik **Generate** dan tunggu hasilnya
4. Download gambar/video yang dihasilkan jika diperlukan

### Contoh prompt yang bisa dicoba:
```
"Cara membuat es kolang-kaling segar untuk 6 orang"
"Berapa kalori kolak pisang santan per porsi?"
"Aku hanya punya ubi dan santan, buat takjil apa ya?"
"Ceritakan sejarah kue cucur dalam tradisi Ramadan"
"Buatkan gambar cendol dengan pencahayaan dramatis"
```

---

## ⚙️ Deployment

### Prasyarat
- Akun [Alibaba Cloud](https://www.alibabacloud.com/) dengan API key DashScope
- Akun [Vercel](https://vercel.com/)

### Environment Variables

| Variable | Deskripsi |
|----------|-----------|
| `DASHSCOPE_API_KEY` | API key dari Alibaba Cloud Model Studio |

---

## 📁 Struktur Project

```
takjilai/
├── .qoder/           # Konfigurasi Qoder IDE
├── api/
│   └── generate.js   # Serverless function — proxy ke Alibaba Cloud
├── public/
│   └── index.html    # Single-page web application
├── .env.example      # Contoh environment variables
├── .gitignore        # File yang dikecualikan dari Git
├── vercel.json       # Konfigurasi Vercel
└── README.md         # Dokumentasi ini
```

---

## 🏆 Hackathon

Proyek ini dibuat untuk **AI × Creativity: The Next Big Thing! Hackathon**
- 📅 Periode: 25 Februari – 5 Maret 2026
- 🏢 Penyelenggara: Alibaba Cloud & Bluepower Technology
- 🎯 Tema: Generative Content Challenge — Ramadan Wishes Generator

---

<div align="center">

Dibuat dengan ❤️ untuk Ramadan yang lebih bermakna

**Takjil.AI © 2026**
**Tim sunibfiasretepnyleve - Binus University**


</div>


# Kreator Studio

**Ruang kerja kreatif open source untuk kreator** — studio video harian, generator gambar, penulis naskah, voice-over, agent, dan terjemahan video dalam satu aplikasi web. Dibuat dengan referensi arsitektur dan pengalaman produk [OpenCreator](https://github.com/krillinai/OpenCreator) (sebelumnya KrillinAI).

Semuanya berjalan lokal. Tanpa API key, aplikasi tetap berfungsi penuh lewat **mesin demo deterministik**: storyboard, gambar bingkai, subtitle bilingual, SRT, naskah suara, dan dubbing semuanya dihasilkan di mesin kamu sendiri. Kalau mau kualitas model asli, cukup tempel API key di halaman **Pengaturan** (BYOK).

![Studio](docs/images/studio.svg)

---

## Daftar isi

- [Fitur](#fitur)
- [Mulai cepat](#mulai-cepat)
- [Mode demo vs mode provider (BYOK)](#mode-demo-vs-mode-provider-byok)
- [Alur kerja](#alur-kerja)
- [Arsitektur](#arsitektur)
- [API](#api)
- [Pengujian](#pengujian)
- [Struktur repo](#struktur-repo)
- [Dokumentasi lain](#dokumentasi-lain)

---

## Fitur

### Workspace kreatif

| Modul | Kemampuan |
| --- | --- |
| **Studio** | Satu brief → storyboard lengkap (adegan, durasi, gerak kamera, prompt gambar, subtitle, narasi), cover otomatis, versi tersimpan |
| **Director seeds** | 12 hook siap replikasi satu klik (iklan brand, stop-motion rajut, nostalgia ladang gandum, UGC, produk hero, drama bos kucing, dll.) |
| **Template produksi** | 6 alur siap pakai (UGC ads, product ad makro, digital human, travel vlog, stickman explainer, thumbnail kontras tinggi) |
| **Terjemahan Video** | Unggah media → transkripsi (Whisper/ASR) → segmentasi cue → terjemahan berkonteks → subtitle bilingual + SRT + transkrip Markdown |
| **Generator Gambar** | Prompt → 1–4 gambar dengan rasio & gaya, galeri, pratinjau, unduh |
| **Tulis** | Skrip short video (berstruktur beat + prompt gambar), artikel panjang, post sosial |
| **Smart Dubbing** | Naskah suara per bahasa, preview suara di browser, berkas audio provider, dan data timing |
| **Agent + Persetujuan** | Percakapan bahasa alami → rencana aksi (`project`, `render`, `translate`, `dub`, `image`, `write`) → dijalankan setelah disetujui |
| **Perpustakaan aset** | Semua gambar, SRT, dokumen, dan audio dengan pratinjau, unduh, dan hapus |

### Kemampuan platform

- **Pipeline asinkron dengan progres live** — setiap tugas punya langkah, log, dan status yang dialirkan ke UI lewat Server-Sent Events.
- **Versi & jejak** — tiap revisi proyek menyimpan versi baru, riwayat run, dan manifes ekspor (`manifest.json`, `storyboard.md`, `*.srt`).
- **Bilingual ID/EN** — seluruh antarmuka dan seluruh keluaran konten tersedia dalam dua bahasa.
- **BYOK** — OpenAI (chat/gambar/TTS/Whisper), Anthropic, Gemini, Ollama, ElevenLabs. Provider gagal? Otomatis jatuh ke mesin demo lokal, tanpa kehilangan pekerjaan.
- **Data milikmu** — semua berkas tersimpan di `.kreator-data/` pada mesin sendiri; API key tidak pernah dikirim balik ke UI.

---

## Mulai cepat

```bash
npm install
npm run dev          # API (8787) + web (5173) sekaligus
```

Buka <http://localhost:5173>. Ingin data contoh langsung terisi? Buka **Pengaturan → Buat data contoh**, atau:

```bash
curl -X POST http://localhost:8787/api/system/seed
```

Build produksi (satu origin, hanya port 8787):

```bash
npm run build
npm start            # menyajikan apps/web/dist + /api
```

Persyaratan: Node.js 20+. Tidak ada dependensi native dan tidak ada `ffmpeg` wajib — kalau `ffmpeg`/`whisper` tersedia di PATH, jalur transkripsi lokal otomatis memakainya.

---

## Mode demo vs mode provider (BYOK)

| Kapabilitas | Demo lokal (default) | Provider |
| --- | --- | --- |
| Storyboard & teks | Mesin beat deterministik (5 mode: sinematik, social, iklan, bebas) | LLM apa pun melalui OpenAI-compatible / Anthropic / Gemini / Ollama |
| Gambar & bingkai | Renderer SVG deterministik (7 komposisi, 8 gaya, grain film, cahaya volumetrik) | `gpt-image-1` |
| Terjemahan | Mesin frasa ID↔EN + glosarium + heuristik panjang cue | LLM dengan prompt segmentasi, glosarium, dan konteks |
| Suara | `speechSynthesis` di browser | OpenAI TTS / ElevenLabs |
| Transkripsi | Transkrip contoh deterministik | OpenAI Whisper, atau CLI `whisper` lokal |

Kunci API disimpan di `.kreator-data/config.json` dan hanya dikembalikan ke UI dalam bentuk tersamarkan (`••••••`).

---

## Alur kerja

1. **Home** — lanjutkan proyek, telusuri *director seeds* dan template, pantau antrean.
2. **Studio** — tulis brief, pilih mode (sinematik / social / commercial / freeform), gaya visual, rasio, durasi, peran, dan properti. Klik **Buat storyboard**.
3. **Proyek** — lihat storyboard per adegan, putar pratinjau bingkai, salin prompt gambar, ekspor.
4. **Render adegan** — mengubah tiap adegan menjadi berkas gambar + SRT bilingual + `storyboard.md` + `manifest.json`.
5. **Terjemahan / Dubbing** — siapkan versi bahasa lain, subtitle bilingual, dan naskah suara.
6. **Agent** — minta dalam bahasa alami; agent menyusun rencana, kamu menyetujui, semua langkah berjalan berurutan di latar belakang.

---

## Arsitektur

```
apps/web      React 18 + Vite (hash router, tanpa dependensi UI eksternal)
   │  fetch /api/*  +  EventSource /api/events
apps/server   Express + TypeScript
   ├─ creator/    demo engine (beat, scene renderer), translate engine, agent planner
   ├─ providers/  LLM, image, TTS, ASR + fallback otomatis
   ├─ services/   store (JSON atomik), jobs (runner + langkah + log), assets
   └─ api/        routes + SSE
.kreator-data/  db.json, config.json, assets/*
```

Detail lengkap (termasuk diagram alur tugas dan cara menambah gaya/hook) ada di [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md).

---

## API

Semua endpoint berada di bawah `/api`:

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/health`, `/system`, `/config`, `/catalog` | Status, data sistem, pengaturan, katalog gaya/hook/template |
| PUT | `/config` | Simpan pengaturan & provider |
| GET/POST | `/projects` | Daftar / buat proyek (asinkron, mengembalikan `jobId`) |
| GET/PATCH/DELETE | `/projects/:id` | Detail, ubah, hapus |
| POST | `/projects/:id/render`, `/projects/:id/dub`, `/projects/:id/duplicate` | Render, dubbing, duplikat |
| GET | `/jobs`, `/jobs/:id`, POST `/jobs/:id/cancel` | Progres, detail, pembatalan |
| GET/POST/DELETE | `/assets`, `/assets/upload`, `/assets/:id/file`, `/assets/:id/download` | Perpustakaan aset |
| POST | `/translate`, `/translate/preview`, `/transcribe` | Terjemahan, pratinjau mesin lokal, transkripsi |
| GET | `/translations` | Riwayat terjemahan |
| POST | `/images`, `/write` | Generator gambar dan penulis |
| GET/POST | `/threads`, `/threads/:id/messages` | Percakapan agent |
| GET | `/approvals`, POST `/approvals/:id/decide` | Persetujuan rencana agent |
| GET | `/runs`, `/events` | Riwayat run, aliran SSE |

Contoh:

```bash
# buat proyek lalu render
PID=$(curl -s -X POST localhost:8787/api/projects -H 'content-type: application/json' \
  -d '{"prompt":"video 30 detik kopi lokal","durationSeconds":30,"language":"id"}' | jq -r .projectId)
curl -s -X POST localhost:8787/api/projects/$PID/render -H 'content-type: application/json' -d '{"translate":true,"bilingual":true}'
```

---

## Pengujian

```bash
npm test               # server (24) + web (9)
npm run typecheck      # TypeScript strict untuk kedua paket
```

Cakupan pengujian server mencakup pipeline penuh: pembuatan proyek → render → ekspor SRT/storyboard → dubbing → terjemahan → gambar → naskah → persetujuan agent. Pengujian web merender setiap halaman dengan API tiruan untuk memastikan tidak ada galat runtime.

---

## Struktur repo

```
apps/
  server/           API + seluruh engine kreatif
    src/creator/    catalog, demo (beat), scene (renderer SVG), translate, agent, studio (orkestrasi)
    src/providers/  llm, image, speech, asr
    src/services/   store, jobs, assets
    src/api/        routes, events
    src/test/       unit + integration
  web/              antarmuka React
    src/pages/      Home, Studio, Projects, ProjectDetail, Translate, Images, Write, Agent, Approvals, Assets, Settings
    src/components/ Icon, ui (toast, job, pill), AppLayout
    src/lib/        api, i18n, format, markdown, router, types
    src/state/      AppState (data + SSE)
scripts/dev.mjs     menjalankan API dan web bersamaan
docs/               ARSITEKTUR.md, FITUR.md, images/
```

---

## Dokumentasi lain

- [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md) — arsitektur, alur tugas, dan panduan kontribusi kode.
- [`docs/FITUR.md`](docs/FITUR.md) — panduan fitur langkah demi langkah dengan contoh keluaran.

## Lisensi & kredit

Proyek ini berdiri sendiri (MIT-style, lihat `LICENSE`), dibuat dengan inspirasi dari OpenCreator (Apache-2.0). Tidak ada kode dari proyek tersebut yang disalin; konsep alur kerja, penamaan modul kreator, dan pola agent + persetujuan diadaptasi dari pengalaman produknya.

# Arsitektur Kreator Studio

Dokumen ini menjelaskan bagaimana aplikasi disusun, bagaimana satu tugas kreatif mengalir dari brief sampai berkas, dan di mana harus menambah kode.

## 1. Gambaran besar

```
┌────────────────────────────┐        ┌──────────────────────────────────────────┐
│ apps/web (React + Vite)    │        │ apps/server (Express + TypeScript)       │
│                            │        │                                          │
│  AppState  ──fetch /api/*──┼───────▶│  api/routes.ts     (REST)                │
│  EventSource /api/events ◀─┼────────┤  api/events.ts     (SSE, diff store)     │
│                            │        │                                          │
│  pages/  Home, Studio, …   │        │  creator/studio.ts  orkestrasi tugas      │
│  components/ AppLayout, ui │        │  creator/agent.ts   perencana + approval  │
└────────────────────────────┘        │  creator/demo.ts    mesin beat            │
                                      │  creator/scene.ts   renderer SVG          │
                                      │  creator/translate.ts mesin subtitle      │
                                      │  providers/*        LLM, image, TTS, ASR  │
                                      │  services/jobs.ts   runner + langkah      │
                                      │  services/assets.ts penyimpanan berkas    │
                                      └────────────────────┬─────────────────────┘
                                                           │
                                            .kreator-data/ │ db.json · config.json · assets/
```

Prinsip yang dipegang:

1. **Satu origin.** Browser hanya berbicara dengan `/api` di origin yang sama. Pada mode dev, Vite mem-proxy ke `127.0.0.1:8787`; pada mode produksi, Express menyajikan `apps/web/dist` dan `/api` sekaligus.
2. **Selalu ada hasil.** Setiap jalur provider punya fallback deterministik, sehingga aplikasi tetap berguna tanpa API key.
3. **Semua pekerjaan panjang adalah job.** Job punya langkah, log, dan status; UI menampilkannya secara live lewat SSE.
4. **Data lokal.** Tidak ada basis data eksternal: JSON atomik + berkas di disk.

## 2. Model data

`apps/server/src/types.ts` mendefinisikan `Database` — satu dokumen JSON yang berisi:

| Koleksi | Isi |
| --- | --- |
| `projects` | Brief, mode, gaya, adegan, versi, status |
| `assets` | Berkas gambar/audio/subtitle/dokumen beserta metadata |
| `jobs` | Langkah, log, hasil, galat |
| `threads` | Percakapan agent |
| `approvals` | Rencana yang menunggu persetujuan |
| `translations` | Dokumen subtitle (cue sumber + terjemahan) |
| `runs` | Riwayat eksekusi ringkas |

Penulisan menggunakan `store.update()` yang diserialkan (queue) dan menulis lewat berkas sementara lalu `rename`, sehingga tidak ada penulisan setengah jadi.

## 3. Alur tugas

### 3.1 Pembuatan proyek (`studio-create`)

```
brief ─▶ createProjectJob
           ├─ brief        : catat mode/rasio/durasi, simpan proyek (status: running)
           ├─ storyboard   : provider LLM? → shotsFromLlm, jika tidak → generateStoryboard (demo)
           ├─ voice        : tulis naskah narasi ke asset .txt
           └─ cover        : render gambar cover (provider atau SVG lokal)
        proyek ─▶ status draft, versi 1 tersimpan, cover + naskah terhubung
```

### 3.2 Render (`studio-render`)

```
prepare ─▶ frames (tiap adegan → generateImages → saveAsset → shot.imageAssetId)
        ─▶ subtitle (caption → splitIntoCues → translateCues → buildSrt → .srt)
        ─▶ export (storyboard.md + manifest.json + versi baru)
proyek ─▶ status ready
```

### 3.3 Agent + persetujuan

```
pesan pengguna
   ├─ LLM (opsional) → { reply, actions[] }  atau  heuristik detectActions()
   ├─ simpan pesan assistant
   └─ buat Approval { actions }

pengguna menyetujui → executeActions()
   project → render (chainedAfter) → translate → dub → image → write
   setiap hasil dicatat sebagai ActionOutcome + pesan tool di percakapan
```

### 3.4 Terjemahan

```
teks/berkas → splitIntoCues  (aturan panjang baris + heuristik karakter/detik)
            → translateCues (LLM JSON per cue, atau demoTranslateText: PHRASES → WORDBOOK → glosarium)
            → buildSrt (bilingual) + buildMarkdownTranscript
            → TranslationDoc tersimpan untuk riwayat & pratinjau berdampingan
```

## 4. Mesin demo

`creator/demo.ts` menyusun storyboard dari **beat** per mode:

| Mode | Beat |
| --- | --- |
| cinematic | Establishing → Texture → Main action → The turn → Resolution → Brand tag |
| social | Hook 3 detik → Problem → Demo → Social proof → CTA |
| commercial | Visual hook → Core benefit → Premium detail → Proof → Offer |
| freeform | Open frame → Exploration → Contrast → Quiet moment → Close frame |

Durasi tiap adegan dibagi dari bobot acak deterministik (`createRng(prompt|mode|gaya|rasio|durasi)`), jadi brief yang sama selalu menghasilkan storyboard yang sama — penting untuk pengujian dan untuk rasa "bisa diulang".

`creator/scene.ts` merender bingkai sebagai SVG: langit gradien, silhouette per komposisi (`landscape`, `city`, `portrait`, `product`, `interior`, `abstract`, `macro`), bokeh, rim light, grain `feTurbulence`, vignette, plus overlay caption/kicker/chapter. Ukuran mengikuti rasio (16:9 = 1280×720, 9:16 = 720×1280, dst.).

## 5. Provider dan fallback

| Berkas | Provider | Fallback |
| --- | --- | --- |
| `providers/llm.ts` | OpenAI-compatible, Anthropic, Gemini, Ollama | `chatJson` mengembalikan `null` → pemanggil memakai mesin demo |
| `providers/image.ts` | `gpt-image-1` (b64/url) | `demoImage()` (SVG) |
| `providers/speech.ts` | OpenAI TTS, ElevenLabs | `clientSide: true` → UI memakai `speechSynthesis` |
| `providers/asr.ts` | OpenAI Whisper, CLI `whisper` | `demoTranscript()` |

Fallback selalu **mencatat alasannya** ke log job, jadi pengguna tahu kapan sebuah berkas dibuat lokal.

## 6. Frontend

- `state/AppState.tsx` — satu provider data: memuat konfigurasi/katalog/proyek/aset, berlangganan SSE, dan menyediakan `t()`/`tx()` untuk lokalisasi.
- `lib/router.ts` — router hash sederhana (`#/studio?seed=...`) agar aplikasi mudah di-hosting statis tanpa konfigurasi server.
- `lib/markdown.ts` — renderer markdown kecil (heading, list, tabel, code, tautan) untuk naskah dan balasan agent.
- `pages/*` — satu berkas per layar; setiap layar memakai `AppLayout` untuk sidebar, judul, dan aksi.

## 7. Cara menambah sesuatu

**Gaya visual baru:** tambahkan entri di `STYLES` (`creator/catalog.ts`) dengan `palette` 4 warna, `prompt`, dan `grain`. Renderer dan pemilih gaya otomatis memakainya.

**Hook / template baru:** tambahkan entri di `HOOKS` atau `TEMPLATES` (judul + deskripsi dua bahasa, `styleId`, `aspect`, `durationSeconds`, `prompt`). Pratinjau SVG otomatis tersedia di `/api/catalog/preview/hook/<id>`.

**Skill agent baru:** tambahkan ke `AGENT_SKILLS`, lalu tangani jenisnya di `creator/agent.ts` (`ACTION_LABEL`, `detectActions`, `executeActions`).

**Layar baru:** buat berkas di `src/pages`, daftarkan di `src/App.tsx`, dan tambahkan entri navigasi di `components/AppLayout.tsx`.

## 8. Menjalankan & menguji

```bash
npm run dev               # dev bersamaan (API 8787 + web 5173)
npm run build && npm start # produksi, satu origin
npm test                  # 24 tes server + 9 tes web
npm run typecheck
```

`KREATOR_DATA_DIR` dapat diarahkan ke folder lain (dipakai oleh pengujian integrasi agar tidak menyentuh data nyata).

## 9. Keterbatasan yang diketahui

- Mesin terjemahan demo adalah pengganti berbasis frasa, bukan penerjemah saraf; kualitas terbaik tetap dari provider.
- Tidak ada penggabungan video menjadi satu berkas MP4 di sisi server (tanpa `ffmpeg`); ekspor adalah rangkaian bingkai + SRT + manifest yang siap dipakai di editor.
- Penyimpanan berupa satu berkas JSON — cukup untuk pemakaian perorangan/lokal, bukan untuk kolaborasi multi-pengguna.

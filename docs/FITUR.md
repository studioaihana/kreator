# Panduan Fitur

Panduan langkah demi langkah untuk setiap modul, beserta contoh keluaran nyata dari mode demo lokal.

## 1. Home — mulai dari mana saja

- **Lanjutkan pekerjaanmu**: kartu proyek terakhir dengan cover, status, jumlah adegan, dan rasio.
- **Director seeds**: 12 hook siap replikasi. Klik salah satu → Studio terbuka dengan brief, gaya, rasio, dan durasi yang sudah terisi.
- **Template produksi**: 6 alur (UGC ads, product ad macro, digital human, travel vlog, stickman explainer, thumbnail).
- **Antrean & aktivitas**: job yang sedang berjalan, riwayat run, dan cuplikan perpustakaan aset.

## 2. Studio — satu brief menjadi storyboard

1. Tulis brief, contoh: `video brand kopi lokal, perjalanan pagi dari ladang sampai cangkir pertama, 30 detik`.
2. Pilih mode: **Sinematik**, **Social Feed**, **Iklan**, atau **Bebas**. Mode menentukan alur beat.
3. Atur **peran**, **properti**, **gaya visual** (8 gaya), **rasio** (16:9, 9:16, 1:1, 4:5), dan **durasi**.
4. Aktifkan voice-over bila naskah narasi ingin dibuat, tambahkan aset pendukung bila perlu.
5. Klik **Buat storyboard** — job berjalan di latar belakang; kamu langsung diarahkan ke halaman proyek.

Keluaran tipikal (mode cinematic, 30 detik): 5 adegan dengan total durasi 30 detik, masing-masing membawa judul, arahan kamera, prompt gambar, subtitle, narasi, dan gerak kamera.

## 3. Proyek — storyboard dan ekspor

- **Pratinjau bingkai**: pemutar storyboard dengan kontrol sebelumnya/berikutnya dan tombol putar.
- **Kartu adegan**: arahan, subtitle, narasi, prompt gambar (dengan tombol salin).
- **Ringkasan**: status, mode, rasio, bahasa sumber → bahasa target, tombol putar narasi (Web Speech API), duplikat, dan hapus.
- **Versi**: setiap render menambah versi baru tanpa menghapus yang lama.
- **Ekspor & aset**: `subtitle-*.srt` (bilingual), `storyboard-*.md`, `manifest-*.json`, `voiceover-*.txt`, `dubbing-timing-*.json`, dan seluruh bingkai gambar.

## 4. Terjemahan Video

### Dari berkas media

1. Unggah video/audio (maks 512 MB) atau pilih berkas yang sudah ada.
2. Klik **Transkripsi otomatis** → jalur ASR: provider → Whisper CLI lokal → transkrip demo.
3. Pilih bahasa target, aktifkan subtitle bilingual, jalankan **Terjemahkan**.
4. Hasil tampil berdampingan per cue dengan timecode; unduh SRT dan transkrip Markdown.

### Dari teks

Tempel naskah apa pun, gunakan **Pratinjau cepat** untuk melihat hasil mesin lokal seketika, lalu jalankan terjemahan penuh untuk mendapatkan cue + SRT.

**Glosarium** menjaga istilah tetap konsisten, contoh: `brief → brief`, `hook → hook`, `keranjang kuning → yellow cart`.

Contoh keluaran demo (ID → EN):

| Sumber | Terjemahan |
| --- | --- |
| Semua dimulai dari satu momen sederhana. | It all starts with one simple moment. |
| Klik keranjangnya sekarang, stoknya cepat habis. | Tap the cart now — it sells fast. |
| Ribuan orang sudah pindah. | Thousands of people already switched. |

## 5. Generator Gambar

Prompt + gaya + rasio + jumlah (1–4). Di mode demo, setiap gambar adalah bingkai sinematik yang dirender lokal dengan komposisi berbeda (kota, potret, produk, interior, abstrak, makro, lanskap). Klik gambar untuk pratinjau besar, atau unduh langsung dari galeri.

## 6. Tulis

- **Skrip video**: struktur per beat dengan timecode, narasi, subtitle, dan prompt gambar — siap ditempel ke Studio.
- **Artikel**: markdown dengan judul, bagian praktis, dan kesimpulan.
- **Post sosial**: hook, tiga poin isi, CTA, dan hashtag.

Draf otomatis tersimpan sebagai dokumen di perpustakaan aset dan bisa dibuka kembali.

## 7. Agent dan Persetujuan

1. Buka **Agent**, buat percakapan, tulis permintaan bebas: `Buat video 30 detik tentang kopi lokal untuk feed vertikal`.
2. Agent membalas dengan rencana dan membuat **kartu persetujuan** berisi daftar aksi.
3. Klik **Setujui & jalankan**: aksi dijalankan berurutan — proyek dibuat, lalu render, terjemahan, dubbing, gambar, atau naskah sesuai rencana.
4. Hasil setiap aksi muncul sebagai pesan tool di percakapan dan tercatat di **Riwayat run**. Menolak rencana tidak menjalankan apa pun.

Contoh aksi yang dikenali: pembuatan proyek, render adegan, terjemahan subtitle, dubbing, gambar/thumbnail, dan penulisan naskah/artikel/post.

## 8. Perpustakaan aset

Filter berdasarkan jenis (gambar, video, audio, subtitle, dokumen), cari berdasarkan nama, pratinjau (lightbox untuk gambar, penampil teks untuk SRT/Markdown/JSON), unduh, atau hapus.

## 9. Pengaturan

- **Tampilan**: bahasa antarmuka (ID/EN), tema gelap/terang, warna aksen, nama kreator.
- **Provider**: pilih mesin untuk teks, gambar, suara, dan transkripsi; isi API key/Base URL/model bila memakai provider.
- **Data**: folder data, uptime, jumlah entitas, dan tombol **Buat data contoh**.
- **Skill**: daftar kemampuan yang aktif untuk agent.

Setiap perubahan bahasa/tema langsung berlaku di seluruh antarmuka tanpa reload.

# AMBA SUHU – versi optimasi

## Perubahan
- ESP32 tetap mengirim satu payload JSON seperti sebelumnya ke `POST /info/dataJSON` (atau `/api/info/dataJSON`). Tidak ada permintaan tambahan dari ESP32 untuk data logger.
- Nilai terbaru tetap disimpan sebagai data dashboard.
- Server membuat titik data logger maksimal satu kali setiap 30 detik, tanpa menambah ukuran payload ESP32.
- Riwayat disimpan di Upstash Redis Sorted Set dan dibatasi 7 hari.
- Endpoint `GET /info/historyJSON?hours=24` mengambil rentang 1–168 jam dan membatasi respons maksimal 500 titik.
- Grafik dibuat dengan Canvas bawaan browser, tanpa library grafik tambahan.
- Dashboard mengambil data terbaru tiap 5 detik dengan penjadwalan non-overlap. Konfigurasi mode hanya diminta saat dashboard dibuka atau saat pengguna mengganti mode.

## Format payload ESP32
Firmware lama tetap kompatibel. Payload minimum yang digunakan:
```json
{
  "temperature": 25.4,
  "humidity": 62.1,
  "uptime": 12345,
  "mode": "CHILLER",
  "alarm_active": false,
  "sensor_error": false
}
```
Header autentikasi tetap `x-device-id` dan `x-device-password`.

## Catatan migrasi
- Riwayat mulai terkumpul setelah versi ini dideploy dan ESP32 mengirim data. Nilai lama yang sebelumnya hanya tersimpan sebagai data terbaru tidak bisa diubah menjadi histori karena timestamp pembacaan sebelumnya memang belum disimpan.
- Pastikan variabel lingkungan Upstash Redis dan `SESSION_SECRET` tetap tersedia di Vercel.
- Riwayat disimpan per device dengan key `device:<id>:history`.

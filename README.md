# ตารางงาน & นัดหมาย (Task Schedule PWA)

PWA จัดการงาน/นัดหมายประจำวัน พร้อมแจ้งเตือน ใช้งานได้ทั้ง **Android และ iOS** โดยติดตั้งลงหน้าจอโฮมได้เลย ไม่ต้องผ่าน App Store

แปลงมาจากแอป Android เนทีฟเดิม (Kotlin + Jetpack Compose + Room) ยกฟีเจอร์มาครบ:
ปฏิทินแถบเลื่อน · งานประจำวัน (หมวดหมู่/ความสำคัญ/งานย่อย/ตัวกรอง) · นัดหมาย (สี/สถานที่/โน้ต) ·
ศูนย์แจ้งเตือน · ความคืบหน้ารายวัน · ผู้ช่วย AI (rule-based ออฟไลน์) · ส่งออกข้อมูล JSON/ข้อความ

## เทคโนโลยี
- Vanilla JS PWA (single-file `index.html`)
- IndexedDB (เก็บข้อมูลในเครื่อง ทำงาน offline)
- Service Worker (network-first สำหรับ HTML, cache static assets)
- Web Notifications API (แจ้งเตือนขณะเปิดแอป)

## โครงสร้างไฟล์
```
index.html                  แอปทั้งหมด (UI + logic)
manifest.webmanifest        ข้อมูล PWA + ไอคอน + shortcuts
sw.js                       Service Worker (offline)
icons/                      icon-192, icon-512, icon-maskable-512
.nojekyll                   กัน GitHub Pages ประมวลผลด้วย Jekyll
```

## Deploy บน GitHub Pages
1. สร้าง repo (เช่น `dohkrabi/task-schedule` หรือ personal)
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (รวม `.nojekyll`) เข้า branch `main`
3. Settings → Pages → Source: `main` / root
4. เปิด `https://<org>.github.io/task-schedule/`

## ติดตั้งลงเครื่อง (Add to Home Screen)
- **Android (Chrome):** เมนู ⋮ → "ติดตั้งแอป" / "เพิ่มไปยังหน้าจอหลัก"
- **iOS (Safari):** ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" (ต้องเปิดผ่าน Safari เท่านั้น)

## ข้อจำกัดเรื่องแจ้งเตือน (สำคัญ)
- **ขณะเปิดแอป:** แจ้งเตือนทำงานปกติทั้ง Android/iOS (ต้องกดอนุญาต Notification)
- **ตอนแอปปิด (background):** PWA ตั้งนาฬิกาปลุกแม่นยำแบบแอปเนทีฟไม่ได้
  - Android: ทำ Web Push ได้ (ต้องมี push server + VAPID)
  - iOS 16.4+: ทำ Web Push ได้ **เฉพาะหลังจาก Add to Home Screen แล้ว** และต้องมี push server
  - หากต้องการ background push จริง ต้องเพิ่มเซิร์ฟเวอร์ (เช่น GAS/Firebase) — บอกได้ถ้าจะทำต่อ

## ผู้ช่วย AI
ตอนนี้เป็น rule-based ทำงานออฟไลน์ (เหมือนต้นฉบับที่ยัง mock อยู่) หากต้องการต่อ Gemini/Claude จริง
ต้องมี API proxy (เช่น GAS) เพื่อไม่ให้ API key หลุดในฝั่ง client

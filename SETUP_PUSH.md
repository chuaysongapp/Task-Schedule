# ตั้งค่า Background Push Notifications
## ข้อมูล/ข้อมูลแยกกันอย่างไร?
ซีโร่ (S24 Ultra) และเพื่อน (iPhone 13) ต่างมี **FCM token เฉพาะเครื่อง** ที่สุ่มขึ้นมาโดย Firebase
GAS Sheet เก็บแค่ `{token, ชื่องาน, เวลาแจ้งเตือน}` — **ไม่มีชื่อ/ตัวตนของใคร** ไม่มีทางรู้ว่าเครื่องไหนเป็นของใคร
ข้อมูลงาน/นัดหมายจริงอยู่ในเครื่องตัวเองตามเดิม ไม่ขึ้น server

---

## ขั้นตอนตั้งค่า Firebase

### 1. สร้าง Firebase Project
1. ไปที่ https://console.firebase.google.com
2. กด **"Create a project"**
3. ใส่ชื่อ เช่น `task-schedule-push`
4. ปิด Google Analytics (ไม่จำเป็น) → **Create project**

### 2. เพิ่ม Web App
1. ใน Project overview กด **</> (Web)**
2. ตั้งชื่อ App: `task-schedule`
3. ไม่ต้องติ๊ก Firebase Hosting
4. **Register app**
5. Copy ค่า `firebaseConfig` ที่แสดงไว้ก่อน

### 3. เปิด Cloud Messaging
1. เมนูซ้าย **Project Settings** (ไอคอนฟันเฟือง)
2. แท็บ **Cloud Messaging**
3. ในส่วน **Web Push certificates** กด **Generate key pair**
4. Copy **Key pair** (VAPID key) — ยาวประมาณ 87 ตัวอักษร

### 4. ดาวน์โหลด Service Account Key
1. **Project Settings** → แท็บ **Service accounts**
2. กด **"Generate new private key"**
3. กด **"Generate key"** → ได้ไฟล์ JSON ดาวน์โหลด
4. **เก็บไฟล์นี้ไว้ในที่ปลอดภัย อย่าส่งให้ใคร**

---

## ขั้นตอนตั้งค่า GAS

### 5. สร้าง GAS Project
1. ไปที่ https://drive.google.com สร้าง Google Sheet ใหม่ ชื่อ `Task Schedule Push Server`
2. เมนู **Extensions → Apps Script**
3. ลบโค้ดเดิมทิ้ง แล้ว copy-paste เนื้อหาจากไฟล์ `gas_push_server.gs`

### 6. ตั้งค่า Script Properties
1. ไอคอนฟันเฟือง (⚙) → **Project Settings**
2. เลื่อนลงหา **Script Properties** → **Add script property**
3. เพิ่ม 2 ค่า:

| Property | Value |
|---|---|
| `FCM_PROJECT_ID` | Project ID จาก Firebase console (เช่น `task-schedule-push-xxxxx`) |
| `FCM_SERVICE_ACCOUNT_JSON` | เนื้อหาทั้งหมดของไฟล์ JSON ที่ดาวน์โหลด (Step 4) |

### 7. Deploy GAS Web App
1. บน Apps Script กด **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. กด **Deploy** → Copy **Web app URL** (ลงท้าย `/exec`)

---

## ขั้นตอนตั้งค่า App

### 8. ใส่ค่าใน index.html
เปิดไฟล์ `index.html` หาบรรทัด `const FIREBASE_CONFIG = {` แล้วใส่ค่า:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIza...",       // จาก firebaseConfig Step 2
  projectId:         "task-schedule-push-xxxxx",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
const FCM_VAPID_KEY  = "BK...";   // VAPID key Step 3
const GAS_PUSH_URL   = "https://script.google.com/macros/s/.../exec";  // Step 7
```

### 9. ตั้ง Trigger ใน GAS
1. กลับไปที่ Apps Script
2. เมนูซ้าย **Triggers** (ไอคอนนาฬิกา)
3. **Add Trigger**:
   - Function: `checkAndSendPush`
   - Event source: **Time-driven**
   - Type: **Minute timer**
   - Interval: **Every minute**
4. **Save** → อนุญาต permissions

### 10. Upload ไฟล์ใหม่ขึ้น GitHub Pages
อัปโหลดไฟล์ `index.html` และ `sw.js` ที่แก้ไขแล้วขึ้น repo

---

## การทดสอบ
1. เปิดแอปบนมือถือ → **Add to Home Screen** (ต้องทำก่อนเสมอ)
2. เพิ่มงาน/นัดหมายพร้อมตั้งเวลาแจ้งเตือน
3. ปิดแอปและล็อกหน้าจอ
4. รอถึงเวลาที่ตั้ง → ต้องได้รับการแจ้งเตือน
5. ตรวจสอบ Google Sheet `push_queue` ว่ามีแถวข้อมูลและ `sent=true`

## ข้อจำกัด iPhone (iOS)
- ต้อง **Add to Home Screen** ผ่าน **Safari** เท่านั้น
- iOS 16.4+ รองรับ Web Push
- iPhone 13 รองรับ (iOS 16+)
- กรณีเพื่อนใช้ iOS < 16.4: ไม่ได้รับ background push แต่ยังได้รับ foreground notification

## Troubleshooting
- **ไม่ได้รับ push**: ตรวจ GAS execution log ว่า `checkAndSendPush` รันได้ปกติ
- **FCM error 401**: Service account JSON ผิด หรือไม่ได้ enable Cloud Messaging API
- **FCM error 404**: Project ID ผิด
- **ไม่มีแถวใน Sheet**: GAS URL ผิด หรือ deploy ไม่ได้ตั้ง "Anyone"

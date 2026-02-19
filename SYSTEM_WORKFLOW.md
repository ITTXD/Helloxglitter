# คำอธิบายระบบและการทำงานของโค้ด (System Workflow)

เอกสารนี้อธิบายการทำงานของระบบจัดการคิว (Queue Management System) โดยละเอียด ตั้งแต่หน้าบ้าน (Frontend) ไปจนถึงหลังบ้าน (Backend) และฐานข้อมูล (Database)

## 📁 โครงสร้างไฟล์หลัก (Core Files)

1.  **`server.js`**
    -   เปรียบเสมือน **พนักงานต้อนรับ (API Gateway)**
    -   ทำหน้าที่รับคำสั่งจากหน้าเว็บ (Dashboard/Customer Page)
    -   ส่งต่อคำสั่งไปยัง `firebase.js` เพื่อทำงานจริง
    -   **Endpoint สำคัญ:** `POST /api/add`, `GET /api/queue`, `DELETE /api/queue/:id` เป็นต้น

2.  **`firebase.js`**
    -   เปรียบเสมือน **สมองและระบบจัดเก็บข้อมูล (Logic & Database)**
    -   ทำหน้าที่ติดต่อกับ Firebase Firestore โดยตรง
    -   จัดการ Logic ที่ซับซ้อน เช่น การรันเลขคิว, การลบประวัติ, การย้ายสถานะ

3.  **`public/dashboard.html`**
    -   **หน้าจอแอดมิน**: สำหรับเจ้าของร้าน/พนักงาน
    -   ใช้ดูคิว, เรียกคิว, แก้ไขข้อมูล, ล้างประวัติ, และ Export Excel

4.  **`public/customer.html`**
    -   **หน้าจอลูกค้า**: สำหรับลูกค้าดูคิวของตัวเอง
    -   แสดงเลขคิวปัจจุบันและสถานะ

---

## 🔄 ขั้นตอนการทำงาน (Workflows)

### 1. การเพิ่มคิว (Add Queue)
> **เส้นทาง:** `index.html` (ฟอร์ม) → `server.js` → `firebase.js` → **Firestore**

1.  ลูกค้ากรอกข้อมูลในหน้าเว็บ
2.  Browser ส่งข้อมูลไปที่ `POST /api/add`
3.  **`firebase.js` (ฟังก์ชัน `addCustomer`)** ทำงาน:
    -   ดึงเลขคิวล่าสุดจาก `metadata/counters`
    -   บวกเลขเพิ่มขึ้น 1 (เช่น จาก 5 เป็น 6)
    -   บันทึกลง Database ด้วยสถานะ `status: 'waiting'`

### 2. การกด "เสร็จสิ้น" (Complete Queue)
> **เส้นทาง:** `dashboard.html` (ปุ่ม ✅) → `server.js` → `firebase.js` → **Firestore**

1.  แอดมินกดปุ่ม "เสร็จสิ้น"
2.  Browser ส่งคำสั่ง `DELETE /api/queue/:id`
3.  **`firebase.js` (ฟังก์ชัน `deleteCustomer`)** ทำงาน:
    -   ค้นหาคิวตาม ID
    -   เปลี่ยนสถานะเป็น `status: 'completed'` (สีเขียว)
    -   บันทึกเวลาที่เสร็จ (`completedAt`)

### 3. การกด "ข้าม" (Skip Queue)
> **เส้นทาง:** `dashboard.html` (ปุ่ม ⏭️) → `server.js` → `firebase.js` → **Firestore**

1.  แอดมินกดปุ่ม "ข้าม" (สำหรับลูกค้าที่ไม่อยู่)
2.  Browser ส่งคำสั่ง `POST /api/queue/:id/skip`
3.  **`firebase.js` (ฟังก์ชัน `skipCustomer`)** ทำงาน:
    -   ค้นหาคิวตาม ID
    -   เปลี่ยนสถานะเป็น `status: 'skipped'` (สีแดง)
    -   รายการจะย้ายไปอยู่ในหมวด "ประวัติ" แต่เป็นสีแดง

### 4. การแก้ไขข้อมูลลูกค้า (Edit Customer)
> **เส้นทาง:** `dashboard.html` (ปุ่ม ✏️) → `server.js` → `firebase.js` → **Firestore**

1.  แอดมินกดแก้ไขและบันทึกฟอร์ม
2.  Browser ส่งคำสั่ง `PUT /api/queue/:id` พร้อมข้อมูลใหม่
3.  **`firebase.js` (ฟังก์ชัน `updateCustomer`)** ทำงาน:
    -   ค้นหาคิวตาม ID
    -   อัปเดตข้อมูลเฉพาะส่วนที่แก้ไข (เช่น เบอร์โทร, หมายเหตุ)

### 5. การย้ายกลับมารอ (Restore Queue)
> **เส้นทาง:** `dashboard.html` (ปุ่ม 🔙 ในประวัติ) → `server.js` → `firebase.js` → **Firestore**

1.  แอดมินกดปุ่ม "กลับมาแล้ว" ที่รายการสีแดงในประวัติ
2.  Browser ส่งคำสั่ง `POST /api/queue/:id/restore`
3.  **`firebase.js` (ฟังก์ชัน `restoreCustomer`)** ทำงาน:
    -   เปลี่ยนสถานะกลับเป็น `status: 'waiting'`
    -   ลบเวลาเสร็จสิ้น/เวลาข้าม ออก
    -   รายการจะเด้งกลับไปที่รายการคิวรอ

### 6. การ "ล้างประวัติ" (Clear History) **(Logic สำคัญ)**
> **เส้นทาง:** `dashboard.html` (ปุ่ม 🗑️) → `server.js` → `firebase.js` → **Firestore**

ระบบนี้มี Logic พิเศษเพื่อจัดการกรณีที่มี "คิวที่ถูกข้าม" (Skipped) หลงเหลืออยู่

1.  แอดมินกดปุ่ม "ล้างประวัติ"
2.  Browser ส่งคำสั่ง `DELETE /api/history`
3.  **`firebase.js` (ฟังก์ชัน `clearHistory`)** ทำงานเป็นขั้นตอนดังนี้:
    *   **ขั้นตอนที่ 1:** ลบทุกรายการที่เป็น `status: 'completed'` (สีเขียว) ทิ้งถาวร
    *   **ขั้นตอนที่ 2:** ค้นหารายการที่ยังอยู่ (`skipped` และ `waiting`)
    *   **ขั้นตอนที่ 3:** **Re-indexing (เรียงเลขใหม่)**
        *   นำรายการที่เหลือมาเรียงตาม ID เดิม
        *   เปลี่ยนเลข ID ใหม่เริ่มจาก 1, 2, 3... ไล่ไปเรื่อยๆ
    *   **ขั้นตอนที่ 4:** อัปเดตตัวนับ `lastId` ใน `metadata/counters` ให้เท่ากับจำนวนที่เหลือ เพื่อให้คิวถัดไปรันเลขต่อได้ถูกต้อง

---

## 💻 ตารางสรุปคำสั่ง API (API Reference)

| การกระทำ | URL Path | ไฟล์ที่ทำงานหลัก | ผลลัพธ์ใน DB |
| :--- | :--- | :--- | :--- |
| **เพิ่มคิว** | `POST /api/add` | `firebase.js` -> `addCustomer` | สร้าง doc ใหม่, `status: waiting` |
| **ดึงข้อมูลคิว** | `GET /api/queue` | `firebase.js` -> `getQueue` | อ่านข้อมูล `waiting` |
| **ดึงประวัติ** | `GET /api/history` | `firebase.js` -> `getQueue` | อ่านข้อมูล `completed` + `skipped` |
| **กดเสร็จสิ้น** | `DELETE /api/queue/:id` | `firebase.js` -> `deleteCustomer` | อัปเดตเป็น `completed` |
| **กดข้าม** | `POST /api/queue/:id/skip` | `firebase.js` -> `skipCustomer` | อัปเดตเป็น `skipped` |
| **ย้ายกลับ** | `POST /api/queue/:id/restore` | `firebase.js` -> `restoreCustomer` | อัปเดตเป็น `waiting` |
| **แก้ไขข้อมูล** | `PUT /api/queue/:id` | `firebase.js` -> `updateCustomer` | อัปเดต field ข้อมูล |
| **ล้างประวัติ** | `DELETE /api/history` | `firebase.js` -> `clearHistory` | ลบ `completed`, เรียงเลขที่เหลือใหม่ |

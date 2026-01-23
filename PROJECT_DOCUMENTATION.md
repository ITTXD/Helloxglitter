# 📄 Project P.M. Queue System - Full Technical Documentation

เอกสารฉบับนี้อธิบายรายละเอียดการทำงานเชิงลึก (Logic) ของทุกไฟล์ในระบบที่ได้รับการปรับปรุงให้มีประสิทธิภาพสูงสุด (Optimization)

---

## 📂 1. Backend & Connectivity (กลไกหลัก)

### 🔌 [firebase.js](file:///Users/ittxd/Documents/project_p_m/firebase.js) - ส่วนจัดการฐานข้อมูล
ไฟล์จัดการข้อมูลใน Firestore ที่ผ่านการ Query Optimization:
- **`addCustomer(data)`**: ใช้ **Firestore Transaction** เพื่อรับประกันว่าเลขคิวจะไม่ซ้ำกัน (Consecutive IDs)
- **`getQueue(status, limit, after)`**: รองรับระบบ **Pagination** โดยใช้วิธี `startAfter` เพื่อดึงข้อมูลเป็นชุดๆ (Chunks) ช่วยประหยัดโควตา Firebase Reads อย่างมาก
- **`checkCustomerStatus(phone)`**: ค้นหาผ่านฟิลด์ `phone_normalized` ด้วย Query โดยตรง (Direct Match) แทนการดึงข้อมูลทั้งหมดมาฟิลเตอร์ในหน่วยความจำ
- **`listenToQueue(callback)`**: ใช้ `onSnapshot` เพื่อรับการแจ้งเตือนจาก Firestore เมื่อคิวมีการเปลี่ยนแปลงแบบ Real-time
- **`clearHistory()`**: ล้างประวัติโดยจำกัดที่ 500 รายการต่อครั้งเพื่อไม่ให้เกินขีดจำกัด Batch ของ Firestore

### 🚀 [server.js](file:///Users/ittxd/Documents/project_p_m/server.js) - ส่วนเว็บเซิร์ฟเวอร์ (Real-time SSE)
ทำหน้าที่เป็นศูนย์กลางการสื่อสาร:
- **Server-Sent Events (SSE)**: เปิด Endpoint `/api/events` เพื่อ Push ข้อมูลคิวล่าสุดไปยัง Dashboard ทันทีที่มีการเปลี่ยนแปลง โดยไม่ต้องมีการ Polling (ประหยัด Request 90%+)
- **API Endpoints**:
    - `POST /api/add`: รับข้อมูลการจอง -> บันทึกด้วย Transaction
    - `GET /api/history`: รองรับ Query Parameters (`limit`, `after`) สำหรับระบบ Pagination

---

## 📂 2. Frontend (หน้าจอการใช้งาน)

### 🎫 [index.html](file:///Users/ittxd/Documents/project_p_m/public/index.html) - หน้าลงทะเบียน
- **Standardized Products**: ใช้ชื่อสินค้ามาตรฐาน ("กลต") เพื่อความแม่นยำในการคำนวณราคาและเก็บสถิติ
- **Admin Persistence**: จดจำชื่อแอดมินใน `localStorage` ตลอดการใช้งาน

### 📊 [dashboard.html](file:///Users/ittxd/Documents/project_p_m/public/dashboard.html) - หน้าจัดการแบบ Real-time
- **Live Connection Status**: มีป้ายแจ้งสถานะการเชื่อมต่อ (Live/Connecting/Disconnected) เพื่อให้แอดมินมั่นใจว่าได้รับข้อมูลล่าสุดเสมอ
- **SSE Integration**: ยกเลิกการดึงข้อมูลทุก 2 วินาที เปลี่ยนมารับข้อมูลอัตโนมัติจาก Server

### 📜 [history.html](file:///Users/ittxd/Documents/project_p_m/public/history.html) - หน้าประวัติประสิทธิภาพสูง
- **Pagination (Load More)**: โหลดข้อมูลทีละ 20 รายการ ช่วยให้การเปิดหน้าประวัติทำได้รวดเร็วแม้มีข้อมูลเป็นหมื่นรายการ
- **Manual Refresh**: เปลี่ยนจาก Auto-refresh เป็นปุ่มรีเฟรชมือ เพื่อลดการอ่านข้อมูลที่ไม่จำเป็น

### 👀 [customer.html](file:///Users/ittxd/Documents/project_p_m/public/customer.html) - หน้าเช็กคิวลูกค้า
- **Optimized Search**: ค้นหาเบอร์โทรได้รวดเร็วและแม่นยำผ่าน Backend Query ที่ปรับแต่งมาแล้ว

---

## 🎨 3. Design System ([styles.css](file:///Users/ittxd/Documents/project_p_m/public/styles.css))
- **Aesthetics**: ใช้โทนสีชมพู Modern (#D63384), Glassmorphism, และ Animation ที่นุ่มนวล
- **Responsiveness**: รองรับการใช้งานทั้งบนคอมพิวเตอร์และมือถืออย่างสมบูรณ์

---

## 🔄 ลำดับเหตุการณ์ (System Workflow)

1.  **การลงทะเบียน**: แอดมินเลือกชื่อ (ระบบจำไว้) -> กรอกข้อมูล -> บันทึกผ่าน Transaction ปลอดภัยสูง
2.  **การติดตาม**: หน้า Dashboard แสดงสีเขียว "Live" อัปเดตข้อมูลทันทีที่คิวถูกจอง หรือถูกข้าม
3.  **การตรวจสอบ**: ลูกค้าค้นหาเบอร์โทร -> เห็นข้อมูลที่ถูกต้องและสถานะปัจจุบันคิวของตน
4.  **การสรุป**: แอดมินตรวจสอบประวัติผ่าน Load More -> Export Excel -> ล้างข้อมูลส่วนเกินได้ด้วยตัวเองเมื่อต้องการ (Manual)

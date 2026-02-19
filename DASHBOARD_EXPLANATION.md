# คำอธิบายไฟล์ Dashboard.html (Dashboard Explanation)

ไฟล์ **`public/dashboard.html`** เป็นหัวใจหลักของระบบจัดการคิว (Admin Panel) ซึ่งรวมส่วนการแสดงผล (UI) และการทำงาน (Logic) ไว้ด้วยกัน เพื่อให้เจ้าหน้าที่สามารถจัดการคิวทั้งหมดได้

---

## 🏗️ 1. โครงสร้างหน้าเว็บ (Structure & Layout)

หน้าเว็บถูกออกแบบด้วย **Grid Layout** แบ่งออกเป็น 2 ส่วนหลักๆ คือ:

### 1.1 ส่วนซ้าย: รายการคิวรอ (Current Queue)
*   **Container Class:** `.queue-section`
*   **หน้าที่:** แสดงรายการลูกค้าที่กำลังรอรับบริการ
*   **องค์ประกอบ:**
    *   **Header:** แสดงสถานะการเชื่อมต่อ (Live/Connecting) และจำนวนคิวรวม
    *   **Search Box:** ช่องค้นหาสำหรับคิวรอ (Search Filter Client-side)
    *   **Queue List:** รายการการ์ดลูกค้า (`#queueList`) ที่อัปเดตแบบ Real-time

### 1.2 ส่วนขวา: ประวัติเสร็จสิ้น (History)
*   **Container Class:** `.history-section`
*   **หน้าที่:** แสดงรายการที่ดำเนินการเสร็จแล้ว หรือถูกข้ามไป
*   **องค์ประกอบ:**
    *   **Control Buttons:**
        *   `🔄 รีเฟรช`: โหลดข้อมูลประวัติใหม่
        *   `📥 Excel`: ดาวน์โหลดรายงานเป็นไฟล์ Excel
        *   `🗑️ ล้าง`: ล้างประวัติ (Clear History)
    *   **Search Box:** ช่องค้นหาประวัติ
    *   **History List:** รายการการ์ดประวัติ (`#historyList`)
    *   **Load More:** ปุ่มโหลดข้อมูลเพิ่มเติม (Pagination)

### 1.3 หน้าต่างแก้ไข (Edit Modal)
*   **ID:** `#editModal`
*   **หน้าที่:** ฟอร์มสำหรับแก้ไขข้อมูลลูกค้า (ชื่อ, เบอร์, สินค้า, หมายเหตุ)
*   ซ่อนอยู่ (`display: none`) และจะแสดงขึ้นมาเมื่อกดปุ่ม ✏️ แก้ไข

---

## 🎨 2. การตกแต่งและสไตล์ (CSS Styles)

ไฟล์นี้มีการเขียน CSS ฝังไว้ใน `<style>` (Internal CSS) เพื่อความสะดวกในการจัดการเฉพาะหน้า

*   **Responsive Design:**
    *   **Desktop:** ใช้ Grid 2 คอลัมน์ (ซ้าย/ขวา) เต็มความสูงหน้าจอ (`100vh`)
    *   **Mobile:** ยุบเหลือ 1 คอลัมน์ เรียงลงมา (Stack) และจำกัดความสูงรายการคิว (`max-height: 60vh`)
*   **Theme & Colors:**
    *   **Queue Cards:** แยกสีตามช่องทาง (Line=เขียว, Shopee=ส้ม, TikTok=ดำ)
    *   **Completed Item:** สีเขียวอ่อน (`#dcfce7`)
    *   **Skipped Item:** สีแดงอ่อน (`#ffebee`) พร้อมขอบสีแดง
*   **Animations:** มี Animation `pulse-green` ที่จุดสถานะ Live เพื่อบอกว่าระบบทำงานอยู่

---

## ⚙️ 3. การทำงานของโค้ด (JavaScript Logic)

ส่วน JavaScript ทำหน้าที่เชื่อมต่อกับ Backend และจัดการหน้าจอ

### 3.1 ตัวแปรสำคัญ
*   `currentQueueData`: เก็บข้อมูลคิวรอปัจจุบัน (Array)
*   `masterHistoryData`: เก็บข้อมูลประวัติทั้งหมดที่โหลดมา (Array)
*       

### 3.2 ฟังก์ชันหลัก (Key Functions)

#### A. การจัดการคิว (Queue Management)
*   **`initRealtimeUpdates()`**:
    *   ใช้ `db.collection('queue').onSnapshot(...)` เพื่อฟังการเปลี่ยนแปลงจาก Firebase โดยตรง
    *   เมื่อมีข้อมูลใหม่ จะเรียก `displayQueue()` เพื่อวาดหน้าจอทันที (Real-time)
*   **`displayQueue(queue)`**:
    *   รับข้อมูลคิวมาสร้าง HTML (Card)
    *   ปุ่ม **"✅ เสร็จสิ้น"** จะเรียก `completeQueue(id)`
    *   ปุ่ม **"⏭️ ข้าม"** จะเรียก `skipQueue(id)`

#### B. การจัดการประวัติ (History Management)
*   **`initHistory()`**:
    *   ดึงข้อมูลจาก API `/api/history`
    *   เก็บลง `masterHistoryData` และเรียก `renderHistoryList`
*   **`renderHistoryList(data)`**:
    *   แสดงผลรายการประวัติ
    *   รองรับการแบ่งหน้า (Load More) โดยตัด Array มาแสดงทีละส่วน
*   **`clearAllHistory()`**:
    *   เรียก API `DELETE /api/history` เพื่อล้างข้อมูล
    *   (ตาม Logic ใหม่: ลบสีเขียว, เรียงสีแดงใหม่)

#### C. การกระทำ (Actions)
*   **`completeQueue(id)`**: ส่งคำสั่ง `DELETE` ไปที่ Server เพื่อจบงาน
*   **`skipQueue(id)`**: ส่งคำสั่ง `POST .../skip` เพื่อข้ามคิว
*   **`restoreQueue(id)`**: ส่งคำสั่ง `POST .../restore` เพื่อดึงคิวกลับมารอ
*   **`exportToExcel()`**: ใช้ library `xlsx.full.min.js` เพื่อแปลงข้อมูล JSON เป็นไฟล์ Excel ดาวน์โหลดลงเครื่อง

#### D. การแก้ไขข้อมูล (Edit)
*   **`openEditModal(id)`**: ดึงข้อมูลลูกค้ามาใส่ในฟอร์ม Modal
*   **`editForm.onsubmit`**: ส่งข้อมูลที่แก้ไขผ่าน `PUT /api/queue/:id` ไปบันทึก

---

## 🔗 4. การเชื่อมต่อกับภายนอก
*   **Firebase SDK:** ใช้สำหรับ Real-time Listener (คิวรอ)
*   **Backend API:** ใช้สำหรับ Action ต่างๆ (เพิ่ม, ลบ, แก้ไข) เพื่อความปลอดภัยและรวม Logic ไว้ที่เดียว
*   **SheetJS (XLSX):** Library สำหรับ Export Excel

---

สรุปคือ **Dashboard.html** เป็นศูนย์บัญชาการที่รวมทุกฟังก์ชันที่จำเป็นสำหรับการทำงานหน้าร้านไว้ในที่เดียว โดยเน้นความรวดเร็ว (Real-time) และความง่ายในการใช้งาน (UI/UX)

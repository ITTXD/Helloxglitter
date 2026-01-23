# Firebase Setup Guide

คำแนะนำการตั้งค่า Firebase สำหรับระบบจัดการคิวลูกค้าเพื่อใช้ฐานข้อมูลจริง (Firestore)

## 📋 ขั้นตอนการตั้งค่า

### 1. สร้าง Firebase Project

1. ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. คลิก "Create a project" (หรือ "Add project")
3. ตั้งชื่อโปรเจกต์ เช่น `queue-system`
4. ปิดการใช้งาน Google Analytics (ไม่จำเป็นสำหรับโปรเจกต์นี้)
5. คลิก "Create project"

### 2. สร้าง Firestore Database

1. ในเมนูด้านซ้าย เลือก **Build** > **Firestore Database**
2. คลิก "Create database"
3. เลือก Location (แนะนำ `asia-southeast1` สิงคโปร์ เพื่อความเร็ว)
4. **สำคัญ:** ในขั้นตอน Security rules เลือก **Start in test mode**
   - *Test mode จะอนุญาตให้ใครก็ได้อ่านเขียนได้ชั่วคราว (30 วัน) ซึ่งสะดวกสำหรับการพัฒนาระบบในช่วงแรก*

### 3. สร้าง Service Account Key

1. คลิกที่รูปเฟือง ⚙️ (Project settings) ข้างๆ Project Overview
2. ไปที่แท็บ **Service accounts**
3. คลิก **Generate new private key** (ปุ่มสีน้ำเงินด้านล่าง)
4. ยืนยันโดยคลิก "Generate key"
5. ไฟล์จะถูกดาวน์โหลดลงเครื่องคอมพิวเตอร์

### 4. ติดตั้ง Key ในโปรเจกต์

1. เปลี่ยนชื่อไฟล์ที่ดาวน์โหลดมาเป็น `serviceAccountKey.json`
2. ย้ายไฟล์มาไว้ที่โฟลเดอร์หลักของโปรเจกต์:
   `/Users/ittxd/Documents/project_p_m/serviceAccountKey.json`

## 🚀 ทดสอบการใช้งาน

1. รัน Server:
   ```bash
   npm start
   ```

2. หากทุกอย่างถูกต้อง จะขึ้นข้อความ:
   ```
   ✅ Firebase initialized successfully
   ```

3. ลองเพิ่มลูกค้าผ่านหน้าเว็บ ข้อมูลจะไปโผล่ใน Firestore Database ทันที!

## ⚠️ การแก้ปัญหา

- **"Firebase Service Account Key not found"**:
  - ตรวจสอบว่ามีไฟล์ `serviceAccountKey.json` อยู่ในโฟลเดอร์ `project_p_m`
  - ตรวจสอบชื่อไฟล์ให้ถูกต้องทุกตัวอักษร

- **"Permission denied"**:
  - ตรวจสอบใน Firebase Console ว่า Firestore Rules ตั้งเป็น Test mode หรือยัง
  - ปกติควรเป็น: `allow read, write: if true;`

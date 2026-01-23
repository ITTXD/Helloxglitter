const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeFirebase, addCustomer, getQueue, deleteCustomer, skipCustomer, checkCustomerStatus, updateCustomer, clearHistory, listenToQueue } = require('./firebase');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Firebase
const firebaseInitialized = initializeFirebase();
if (!firebaseInitialized) {
    console.warn('⚠️ WARNING: Firebase not initialized properly. Database operations will fail.');
    console.warn('👉 Please check FIREBASE_SETUP.md and ensure serviceAccountKey.json is present.');
}

// --- Real-time Setup (SSE + onSnapshot) ---
let clients = [];
let currentQueueBuffer = [];

// Initialize Firestore listener
if (firebaseInitialized) {
    listenToQueue((newQueue) => {
        currentQueueBuffer = newQueue;
        // Broadcast to all connected clients
        const payload = JSON.stringify({
            success: true,
            queue: newQueue,
            total: newQueue.length
        });

        clients.forEach(client => {
            client.res.write(`data: ${payload}\n\n`);
        });
    });
}

// SSE Endpoint for real-time updates
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial data immediately
    const initialPayload = JSON.stringify({
        success: true,
        queue: currentQueueBuffer,
        total: currentQueueBuffer.length
    });
    res.write(`data: ${initialPayload}\n\n`);

    // Add client to broadcast list
    const clientId = Date.now();
    const newClient = { id: clientId, res };
    clients.push(newClient);

    // Remove client on disconnect
    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
    });
});

// API Routes

// POST /api/add - Add new customer to queue
app.post('/api/add', async (req, res) => {
    const { name, tracking, phone, note, channel, product, addon, price, recordedBy } = req.body;

    // Validation
    if (!name || !tracking || !phone) {
        return res.status(400).json({
            success: false,
            message: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อ, เลข Tracking, เบอร์โทรศัพท์)'
        });
    }

    try {
        const customer = await addCustomer({
            name: name.trim(),
            tracking: tracking.trim(),
            phone: phone.trim(),
            note: note ? note.trim() : '',
            channel,
            product,
            addon,
            price,
            recordedBy
        });

        res.json({
            success: true,
            message: 'เพิ่มลูกค้าเข้าคิวสำเร็จ',
            customer
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message
        });
    }
});

// GET /api/queue - Get all customers in queue (waiting)
app.get('/api/queue', async (req, res) => {
    try {
        const queue = await getQueue('waiting');

        res.json({
            success: true,
            queue: queue,
            total: queue.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message
        });
    }
});

// GET /api/history - Get completed customers (with pagination support)
app.get('/api/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const after = req.query.after || null;

        const history = await getQueue('history', limit, after);

        res.json({
            success: true,
            queue: history,
            total: history.length,
            hasMore: history.length === limit
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงประวัติ: ' + error.message
        });
    }
});

// DELETE /api/queue/:id - Remove customer from queue (Complete)
app.delete('/api/queue/:id', async (req, res) => {
    const customerId = req.params.id; // Keep as string or int depending on logic

    try {
        const removedCustomer = await deleteCustomer(customerId);

        res.json({
            success: true,
            message: 'เสร็จสิ้นแล้ว',
            customer: removedCustomer
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: 'ไม่สามารถประมวลผลได้ หรือไม่พบข้อมูล: ' + error.message
        });
    }
});

// POST /api/queue/:id/skip - Skip customer (Not present)
app.post('/api/queue/:id/skip', async (req, res) => {
    const customerId = req.params.id;

    try {
        const skippedCustomer = await skipCustomer(customerId);

        res.json({
            success: true,
            message: 'ข้ามเรียบร้อยแล้ว (ไม่อยู่)',
            customer: skippedCustomer
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: 'ไม่สามารถข้ามคิวได้ หรือไม่พบข้อมูล: ' + error.message
        });
    }
});

// GET /api/check/:phone - Check specific customer status
app.get('/api/check/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        console.log(`🔍 Search request for phone: ${phone}`);
        const customers = await checkCustomerStatus(phone);

        if (!customers || customers.length === 0) {
            console.log(`❌ No customer found for phone: ${phone}`);
            return res.json({
                success: false,
                message: `ไม่พบข้อมูลคิวสำหรับเบอร์ ${phone}`
            });
        }

        console.log(`✅ Found ${customers.length} records for phone: ${phone}`);
        res.json({
            success: true,
            customers: customers
        });
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบ: ' + error.message
        });
    }
});

// PUT /api/queue/:id - Update customer information
app.put('/api/queue/:id', async (req, res) => {
    const customerId = req.params.id;
    const updateData = req.body;

    try {
        const updatedCustomer = await updateCustomer(customerId, updateData);

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ',
            customer: updatedCustomer
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไข: ' + error.message
        });
    }
});

// DELETE /api/history - Clear all completed history
app.delete('/api/history', async (req, res) => {
    try {
        const result = await clearHistory();
        res.json({
            success: true,
            message: `ล้างประวัติสำเร็จ (${result.count} รายการ)`,
            count: result.count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการล้างประวัติ: ' + error.message
        });
    }
});

// Start server if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
        console.log(`📝 Customer Registration: http://localhost:${PORT}`);
        console.log(`📊 Admin Dashboard: http://localhost:${PORT}/dashboard.html`);
        console.log(`👀 Customer Check: http://localhost:${PORT}/customer.html`);
        console.log(`📜 Queue History: http://localhost:${PORT}/history.html`);
    });
}

// Export for Vercel
module.exports = app;

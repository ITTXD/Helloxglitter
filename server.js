const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeFirebase, addCustomer, getQueue, deleteCustomer, skipCustomer, checkCustomerStatus, updateCustomer, clearHistory, restoreCustomer, permanentlyDeleteCustomer } = require('./firebase');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Enable caching for static files (Disabled for debugging/updates)
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '0'
}));

// Ensure fresh HTML is always served (avoid CDN/browser caching HTML)
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/') {
        res.set('Cache-Control', 'no-store');
    }
    next();
});

// Root route to ensure index.html is served
app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Special route for customer queue (Alias)
app.get('/helloxglitter.queue', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});

// Handle typo version just in case
app.get('/helloxglitte.queue', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});

// New Alias as requested by user
app.get('/helloxglitter.custumer.check', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});

// Initialize Firebase
const firebaseInitialized = initializeFirebase();
if (!firebaseInitialized) {
    console.warn('⚠️ WARNING: Firebase not initialized properly. Database operations will fail.');
    console.warn('👉 Please check FIREBASE_SETUP.md and ensure serviceAccountKey.json is present.');
}

// API Routes

// POST /api/add - Add new customer to queue
// Forced rebuild timestamp: 2026-01-24
app.post('/api/add', async (req, res) => {
    const { name, tracking, phone, note, channel, product, addon, price, recordedBy } = req.body;

    // Validation (Relaxed for optional fields)
    // if (!name || !tracking || !phone) {
    //     return res.status(400).json({
    //         success: false,
    //         message: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อ, เลข Tracking, เบอร์โทรศัพท์)'
    //     });
    // }

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
        const search = req.query.search || null;

        const history = await getQueue('history', limit, after, search);

        res.json({
            success: true,
            queue: history,
            total: history.length,
            hasMore: history.length === limit // Note: This might be inaccurate with search, but acceptable
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

// POST /api/queue/:id/restore - Restore customer to waiting queue
app.post('/api/queue/:id/restore', async (req, res) => {
    const customerId = req.params.id;

    try {
        const restoredCustomer = await restoreCustomer(customerId);

        res.json({
            success: true,
            message: 'ย้ายกลับมาคิวรอเรียบร้อยแล้ว',
            customer: restoredCustomer
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: 'ไม่สามารถย้ายกลับได้ หรือไม่พบข้อมูล: ' + error.message
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

// DELETE /api/queue/:id/permanent - Permanently delete customer
app.delete('/api/queue/:id/permanent', async (req, res) => {
    const customerId = req.params.id;

    try {
        const result = await permanentlyDeleteCustomer(customerId);

        res.json({
            success: true,
            message: 'ลบข้อมูลถาวรสำเร็จ',
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message
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

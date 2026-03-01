const admin = require('firebase-admin');
const fs = require('fs');

// Path to service account key
// By default, looks for "serviceAccountKey.json" in the project root
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

let db = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
    try {
        let serviceAccount;

        // Priority 1: Check Environment Variable (Best for Vercel/Production)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                console.log('✅ Loaded Firebase credentials from Environment Variable');
            } catch (e) {
                console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable');
                return false;
            }
        } 
        // Priority 2: Check Local File (Best for Local Development)
        else if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
            serviceAccount = require(SERVICE_ACCOUNT_PATH);
            console.log('✅ Loaded Firebase credentials from local file');
        } else {
            console.error('❌ Firebase Service Account Key not found!');
            console.error(`Please place your "${SERVICE_ACCOUNT_PATH}" file in the project root OR set FIREBASE_SERVICE_ACCOUNT env var.`);
            return false;
        }

        // Avoid double initialization
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        db = admin.firestore();
        console.log('✅ Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error.message);
        return false;
    }
}

/**
 * Add a new customer to the queue
 */
async function addCustomer(data) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        const timestamp = new Date().toISOString();
        const counterRef = db.collection('metadata').doc('counters');
        const queueRef = db.collection('queue');

        let resultData = null;

        await db.runTransaction(async (t) => {
            // 1. Find the global maximum ID (including completed/skipped)
            // We look for the highest ID across the entire collection to ensure continuity
            const maxIdQuery = queueRef.orderBy('id', 'desc').limit(1);
            const maxIdSnapshot = await t.get(maxIdQuery);
            
            let nextId = 1;
            if (!maxIdSnapshot.empty) {
                const lastDoc = maxIdSnapshot.docs[0].data();
                // Ensure we handle cases where id might be missing or not a number
                const lastId = Number(lastDoc.id);
                if (!isNaN(lastId)) {
                    nextId = lastId + 1;
                }
            }

            // 2. Prepare customer data
            const newCustomer = {
                id: nextId,
                name: data.name,
                tracking: data.tracking || '',
                phone: data.phone.trim(),
                phone_normalized: data.phone.replace(/\D/g, ''),
                note: data.note || '',
                channel: data.channel || '',
                product: data.product || '',
                addon: data.addon || '',
                price: data.price || 0,
                recordedBy: data.recordedBy || 'System',
                timestamp,
                status: 'waiting'
            };

            // 3. Update counter
            t.set(counterRef, { lastId: nextId }, { merge: true });

            // 4. Create new queue document
            const newDocRef = queueRef.doc(); // Generate random ID for doc but numeric ID in data
            t.set(newDocRef, newCustomer);

            resultData = { ...newCustomer, firebaseId: newDocRef.id };
        });

        return resultData;
    } catch (error) {
        console.error('Error adding customer (Transaction):', error.message);
        throw error;
    }
}

/**
 * Search for a customer status by phone number
 * @param {string} phone 
 */
async function checkCustomerStatus(phone) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // Normalize the input phone number
        const normalizedSearch = String(phone).replace(/\D/g, '');
        console.log(`[FIREBASE] Checking for phone (normalized): ${normalizedSearch}`);

        if (!normalizedSearch) return [];

        // Direct query using 'phone_normalized' field logic!
        // This effectively reads ONLY the matching documents, saving huge quota.
        try {
            const snapshot = await db.collection('queue')
                .where('phone_normalized', '==', normalizedSearch)
                .orderBy('timestamp', 'desc') // Get newest first
                .limit(50) // Limit just in case to safely bound usage (increased to 50 as requested)
                .get();

            if (snapshot.empty) {
                console.log(`[FIREBASE] No match found for: ${normalizedSearch}`);
                return [];
            }

            const customers = [];
            snapshot.forEach(doc => {
                customers.push({ firebaseId: doc.id, ...doc.data() });
            });

            console.log(`[FIREBASE] Found ${customers.length} matches for: ${normalizedSearch}`);
            return customers;
        } catch (error) {
            // Check if it's a missing index error
            if (error.code === 9 || error.message.includes('index')) {
                console.warn('\n⚠️ [FIREBASE] Missing Index detected for checkCustomerStatus!');
                console.warn('👉 Please create the required index by clicking the link in your terminal or implementation_plan.md');

                console.log('🔄 Attempting fallback query (un-ordered) to show data...');
                // Fallback: Query without orderBy
                const fallbackSnapshot = await db.collection('queue')
                    .where('phone_normalized', '==', normalizedSearch)
                    .limit(50)
                    .get();

                const customers = [];
                fallbackSnapshot.forEach(doc => {
                    customers.push({ firebaseId: doc.id, ...doc.data() });
                });

                // Sort manually in memory
                customers.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
                return customers;
            }
            throw error;
        }
    } catch (error) {
        console.error('Error checking customer status:', error.message);
        throw error;
    }
}

/**
 * Get customers by status with optional pagination
 * @param {string} status - 'waiting' or 'completed'
 * @param {number} limitNum - Number of records to fetch
 * @param {string} lastDocId - Optional ID to start after (for pagination)
 * @param {string} searchQuery - Optional search term
 */
async function getQueue(status = 'waiting', limitNum = 100, lastDocId = null, searchQuery = null) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // If searching history, we switch strategy to "Fetch Recent & Filter in Memory"
        // This avoids complex Firestore composite indexes and allows fuzzy search
        if (searchQuery && status === 'history') {
            console.log(`[FIREBASE] Searching history for: "${searchQuery}"`);
            
            // Fetch a larger chunk of recent history (e.g., last 200 items)
            // Ideally, for a full search system, we'd need a dedicated search service (Algolia/Meilisearch)
            // But for this scale, memory filtering of recent items is sufficient and cost-effective.
            const fetchLimit = 200; 
            
            const snapshot = await db.collection('queue')
                .where('status', 'in', ['completed', 'skipped'])
                .orderBy('finishedAt', 'desc')
                .limit(fetchLimit)
                .get();

            const queue = [];
            const lowerQuery = searchQuery.toLowerCase();

            snapshot.forEach(doc => {
                const data = doc.data();
                // Check for matches in name, phone, or tracking
                const matchName = (data.name || '').toLowerCase().includes(lowerQuery);
                const matchPhone = (data.phone || '').includes(searchQuery);
                const matchTracking = (data.tracking || '').toLowerCase().includes(lowerQuery);

                if (matchName || matchPhone || matchTracking) {
                    queue.push({ firebaseId: doc.id, ...data });
                }
            });

            return queue;
        }

        // Standard Pagination Logic (No Search)
        let query = db.collection('queue');

        if (status === 'history') {
            query = query.where('status', 'in', ['completed', 'skipped'])
                .orderBy('finishedAt', 'desc');
        } else {
            query = query.where('status', '==', status);
            if (status === 'completed') {
                query = query.orderBy('completedAt', 'desc');
            } else {
                query = query.orderBy('timestamp', 'asc');
            }
        }

        // Apply pagination if lastDocId is provided
        if (lastDocId) {
            const lastDoc = await db.collection('queue').doc(lastDocId).get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }

        try {
            const snapshot = await query.limit(limitNum).get();
            const queue = [];
            snapshot.forEach(doc => {
                queue.push({ firebaseId: doc.id, ...doc.data() });
            });
            return queue;
        } catch (error) {
            // Check if it's a missing index error
            if (error.code === 9 || error.message.includes('index')) {
                console.warn('\n⚠️ [FIREBASE] Missing Index detected!');
                console.warn('👉 Please create the required index by clicking this link:');
                const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s']+/);
                if (match) console.warn('\x1b[36m%s\x1b[0m', match[0]); // Cyan color

                console.log('🔄 Attempting fallback query (un-ordered) to show data...');
                
                // Fallback: Query without orderBy (will work without index)
                let fallbackQuery = db.collection('queue');
                if (status === 'history') {
                    fallbackQuery = fallbackQuery.where('status', 'in', ['completed', 'skipped']);
                } else {
                    fallbackQuery = fallbackQuery.where('status', '==', status);
                }

                const fallbackSnapshot = await fallbackQuery.limit(limitNum).get();

                const queue = [];
                fallbackSnapshot.forEach(doc => {
                    queue.push({ firebaseId: doc.id, ...doc.data() });
                });
                // Sort manually in memory as a temporary measure
                if (status === 'history') {
                    queue.sort((a, b) => new Date(b.finishedAt || 0) - new Date(a.finishedAt || 0));
                } else if (status === 'completed') {
                    queue.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
                } else {
                    queue.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                }
                return queue;
            }
            throw error;
        }
    } catch (error) {
        console.error(`Error getting queue (${status}):`, error.message);
        throw error;
    }
}

/**
 * Clear all completed customer history (safely in batches of 500)
 */
async function clearHistory() {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // 1. Delete 'completed' items (green)
        // We do this in a loop to handle cases > 500 items if needed, 
        // though here we just do one batch for simplicity as per original code limit.
        const completedSnapshot = await db.collection('queue')
            .where('status', '==', 'completed')
            .limit(500)
            .get();

        if (!completedSnapshot.empty) {
            const deleteBatch = db.batch();
            completedSnapshot.docs.forEach(doc => {
                deleteBatch.delete(doc.ref);
            });
            await deleteBatch.commit();
            console.log(`✅ Cleared ${completedSnapshot.size} COMPLETED history records`);
        }

        // 2. Re-index remaining items (skipped/waiting) to start from 1
        // Fetch ALL remaining items ordered by current ID to preserve relative order
        const remainingSnapshot = await db.collection('queue')
            .orderBy('id', 'asc')
            .get();

        let reindexedCount = 0;

        if (!remainingSnapshot.empty) {
            const updateBatch = db.batch();
            let newId = 1;
            let needsUpdate = false;

            remainingSnapshot.docs.forEach(doc => {
                const currentId = doc.data().id;
                // Only update if the ID is different (save writes)
                if (currentId !== newId) {
                    updateBatch.update(doc.ref, { id: newId });
                    needsUpdate = true;
                }
                newId++;
            });

            if (needsUpdate) {
                // Also update the metadata counter
                const lastAssignedId = newId - 1;
                updateBatch.set(db.collection('metadata').doc('counters'), { lastId: lastAssignedId }, { merge: true });

                await updateBatch.commit();
                reindexedCount = remainingSnapshot.size;
                console.log(`✅ Re-indexed ${reindexedCount} remaining records starting from ID 1`);
            } else {
                 // Even if no docs needed update, ensure counter is correct
                 const lastAssignedId = newId - 1;
                 await db.collection('metadata').doc('counters').set({ lastId: lastAssignedId }, { merge: true });
            }
        } else {
            // If no items remain, reset counter to 0
            await db.collection('metadata').doc('counters').set({ lastId: 0 }, { merge: true });
            console.log(`✅ No remaining records. Reset counter to 0.`);
        }

        return { count: completedSnapshot.size, reindexed: reindexedCount };
    } catch (error) {
        console.error('Error clearing history:', error.message);
        throw error;
    }
}

/**
 * Update a customer's information
 * @param {number} id - The numeric ID of the customer
 * @param {Object} data - The data to update
 */
async function updateCustomer(id, data) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // Normalize phone if it's being updated
        if (data.phone) {
            data.phone_normalized = data.phone.replace(/\D/g, '');
        }

        // Find the document with this numeric ID
        const snapshot = await db.collection('queue')
            .where('id', '==', parseInt(id))
            .get();

        if (snapshot.empty) {
            throw new Error('Customer not found');
        }

        const doc = snapshot.docs[0];

        // Update the document
        await db.collection('queue').doc(doc.id).update(data);

        console.log(`✅ Updated customer ID: ${id}`);

        return { id, ...data };
    } catch (error) {
        console.error('Error updating customer:', error.message);
        throw error;
    }
}

/**
 * Mark a customer as completed (Soft delete)
 * @param {number} id - The numeric ID of the customer
 */
async function deleteCustomer(id) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // Find the document with this numeric ID
        const snapshot = await db.collection('queue')
            .where('id', '==', parseInt(id))
            .get();

        if (snapshot.empty) {
            throw new Error('Customer not found');
        }

        const doc = snapshot.docs[0];

        // Update status to 'completed' instead of deleting
        const now = new Date().toISOString();
        await db.collection('queue').doc(doc.id).update({
            status: 'completed',
            completedAt: now,
            finishedAt: now
        });

        console.log(`✅ Marked customer as completed ID: ${id}`);

        return doc.data();
    } catch (error) {
        console.error('Error completing customer:', error.message);
        throw error;
    }
}

/**
 * Mark a customer as skipped (when they are not present)
 * @param {number} id - The numeric ID of the customer
 */
async function skipCustomer(id) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // Find the document with this numeric ID
        const snapshot = await db.collection('queue')
            .where('id', '==', parseInt(id))
            .get();

        if (snapshot.empty) {
            throw new Error('Customer not found');
        }

        const doc = snapshot.docs[0];

        // Update status to 'skipped'
        const now = new Date().toISOString();
        await db.collection('queue').doc(doc.id).update({
            status: 'skipped',
            skippedAt: now,
            finishedAt: now
        });

        console.log(`⏭️ Marked customer as skipped ID: ${id}`);

        return doc.data();
    } catch (error) {
        console.error('Error skipping customer:', error.message);
        throw error;
    }
}

/**
 * Restore a customer to the waiting queue
 * @param {number} id - The numeric ID of the customer
 */
async function restoreCustomer(id) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // Find the document with this numeric ID
        const snapshot = await db.collection('queue')
            .where('id', '==', parseInt(id))
            .get();

        if (snapshot.empty) {
            throw new Error('Customer not found');
        }

        const doc = snapshot.docs[0];

        // Update status to 'waiting' and remove completion timestamps
        await db.collection('queue').doc(doc.id).update({
            status: 'waiting',
            completedAt: admin.firestore.FieldValue.delete(),
            skippedAt: admin.firestore.FieldValue.delete(),
            finishedAt: admin.firestore.FieldValue.delete()
        });

        console.log(`🔙 Restored customer to waiting queue ID: ${id}`);

        return doc.data();
    } catch (error) {
        console.error('Error restoring customer:', error.message);
        throw error;
    }
}

/**
 * Permanently delete a customer from the database
 * @param {number} id - The numeric ID of the customer
 */
async function permanentlyDeleteCustomer(id) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // 1. Find and delete the document with this numeric ID
        const snapshot = await db.collection('queue')
            .where('id', '==', parseInt(id))
            .get();

        if (snapshot.empty) {
            throw new Error('Customer not found');
        }

        const deletedDoc = snapshot.docs[0];
        await db.collection('queue').doc(deletedDoc.id).delete();
        console.log(`🗑️ Permanently deleted customer ID: ${id}`);

        return { id, success: true };
    } catch (error) {
        console.error('Error permanently deleting customer:', error.message);
        throw error;
    }
}

/**
 * Swap a customer's position in the queue
 * @param {number} id - The numeric ID of the customer to move
 * @param {string} direction - 'up' or 'down'
 */
async function swapQueue(id, direction) {
    try {
        if (!db) throw new Error('Firebase not initialized');

        // 1. Get all waiting customers sorted by timestamp (or whatever logic getQueue uses)
        const snapshot = await db.collection('queue')
            .where('status', '==', 'waiting')
            .orderBy('timestamp', 'asc')
            .get();

        if (snapshot.empty) {
            throw new Error('No waiting customers found');
        }

        const queue = [];
        snapshot.forEach(doc => {
            queue.push({ firebaseId: doc.id, ...doc.data() });
        });

        // 2. Find current item index
        const index = queue.findIndex(c => c.id === parseInt(id));
        if (index === -1) throw new Error('Customer not found in waiting queue');

        // 3. Determine target index
        let targetIndex = -1;
        if (direction === 'up') {
            targetIndex = index - 1;
        } else if (direction === 'down') {
            targetIndex = index + 1;
        }

        // Check bounds
        if (targetIndex < 0 || targetIndex >= queue.length) {
            console.log(`Cannot move ${direction}: Already at boundary`);
            return { success: false, message: 'Already at boundary' };
        }

        const currentItem = queue[index];
        const targetItem = queue[targetIndex];

        // 4. Perform Swap (Timestamp AND ID)
        await db.runTransaction(async (t) => {
            const currentRef = db.collection('queue').doc(currentItem.firebaseId);
            const targetRef = db.collection('queue').doc(targetItem.firebaseId);

            // Swap Timestamps (to keep order in queries)
            const ts1 = currentItem.timestamp;
            const ts2 = targetItem.timestamp;
            
            // Swap IDs (to keep "Queue Number" sequential visually)
            const id1 = currentItem.id;
            const id2 = targetItem.id;

            t.update(currentRef, {
                timestamp: ts2,
                id: id2
            });

            t.update(targetRef, {
                timestamp: ts1,
                id: id1
            });
        });

        console.log(`✅ Swapped Queue: ID ${id} moved ${direction} (swapped with ${targetItem.id})`);
        return { success: true };

    } catch (error) {
        console.error('Error swapping queue:', error.message);
        throw error;
    }
}

module.exports = {
    initializeFirebase,
    addCustomer,
    getQueue,
    deleteCustomer,
    skipCustomer,
    checkCustomerStatus,
    updateCustomer,
    clearHistory,
    restoreCustomer,
    permanentlyDeleteCustomer,
    swapQueue
};
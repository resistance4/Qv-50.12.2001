
const { Pool } = require('pg');

// Database connection pool
let pool = null;
let useInMemory = false;

// In-memory fallback storage
const helpInteractions = new Map();
const loggingChannels = new Map();
const auditLogs = new Map();

// Cleanup interval for old interactions
let cleanupInterval = null;

// Initialize database with automatic PostgreSQL detection
async function initializeDatabase() {
    try {
        const databaseUrl = process.env.DATABASE_URL;
        
        if (databaseUrl && databaseUrl !== 'postgresql://localhost:5432/discord_bot?sslmode=disable') {
            // PostgreSQL is available in Replit
            console.log('🔍 PostgreSQL detected, initializing connection...');
            
            // Use connection pooling for better performance
            const poolUrl = databaseUrl.includes('-pooler.') ? databaseUrl : databaseUrl.replace('.us-east-2', '-pooler.us-east-2');
            
            pool = new Pool({
                connectionString: poolUrl,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
                ssl: databaseUrl.includes('postgresql://') ? { rejectUnauthorized: false } : false
            });

            // Test the connection
            const client = await pool.connect();
            console.log('✅ PostgreSQL connection established successfully');

            // Create table if it doesn't exist
            await client.query(`
                CREATE TABLE IF NOT EXISTS help_interactions (
                    id SERIAL PRIMARY KEY,
                    interaction_id VARCHAR(255) UNIQUE NOT NULL,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    current_card INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes for better performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_help_interactions_user_guild 
                ON help_interactions(user_id, guild_id)
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_help_interactions_created_at 
                ON help_interactions(created_at)
            `);

            // Create logging_channels table
            await client.query(`
                CREATE TABLE IF NOT EXISTS logging_channels (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(20) UNIQUE NOT NULL,
                    channel_id VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_logging_channels_guild 
                ON logging_channels(guild_id)
            `);

            // Create audit_logs table
            await client.query(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(20) NOT NULL,
                    log_type VARCHAR(50) NOT NULL,
                    user_id VARCHAR(20),
                    moderator_id VARCHAR(20),
                    reason TEXT,
                    details TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_audit_logs_guild_type 
                ON audit_logs(guild_id, log_type)
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
                ON audit_logs(created_at)
            `);

            client.release();
            console.log('✅ PostgreSQL database tables initialized successfully');
            useInMemory = false;

        } else {
            // Fall back to in-memory storage
            console.log('📝 PostgreSQL not available, using in-memory storage');
            useInMemory = true;
        }

        // Start cleanup interval (every 6 hours)
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
        }
        
        cleanupInterval = setInterval(() => {
            cleanupOldInteractions();
        }, 6 * 60 * 60 * 1000);

        console.log('✅ Database initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing PostgreSQL, falling back to in-memory:', error);
        useInMemory = true;
        return true; // Don't fail, just use in-memory
    }
}

// Save or update help interaction with robust error handling
async function saveHelpInteraction(interactionId, userId, guildId, currentCard = 1) {
    try {
        if (useInMemory || !pool) {
            // In-memory fallback
            const key = `${userId}_${guildId}`;
            const data = {
                interactionId,
                userId,
                guildId,
                currentCard,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            helpInteractions.set(key, data);
            console.log(`✅ Saved help interaction (in-memory): ${interactionId} for user ${userId}`);
            return true;
        }

        // PostgreSQL implementation
        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO help_interactions (interaction_id, user_id, guild_id, current_card, updated_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (interaction_id)
                DO UPDATE SET current_card = $4, updated_at = CURRENT_TIMESTAMP
            `, [interactionId, userId, guildId, currentCard]);

            console.log(`✅ Saved help interaction (PostgreSQL): ${interactionId} for user ${userId}`);
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`❌ Error saving help interaction:`, error);
        
        // Fallback to in-memory on PostgreSQL error
        if (!useInMemory) {
            const key = `${userId}_${guildId}`;
            const data = {
                interactionId,
                userId,
                guildId,
                currentCard,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            helpInteractions.set(key, data);
            console.log(`✅ Saved help interaction (fallback): ${interactionId} for user ${userId}`);
        }
        
        return false;
    }
}

// Get help interaction for user
async function getHelpInteraction(userId, guildId) {
    try {
        if (useInMemory || !pool) {
            // In-memory fallback
            const key = `${userId}_${guildId}`;
            const data = helpInteractions.get(key);
            
            if (!data) {
                return null;
            }
            
            // Check if interaction is still valid (within 24 hours)
            const now = Date.now();
            const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
            
            if (now - data.createdAt > expiryTime) {
                helpInteractions.delete(key);
                return null;
            }
            
            return { valid: true, ...data };
        }

        // PostgreSQL implementation
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM help_interactions 
                WHERE user_id = $1 AND guild_id = $2 
                AND created_at > NOW() - INTERVAL '24 hours'
                ORDER BY updated_at DESC 
                LIMIT 1
            `, [userId, guildId]);

            if (result.rows.length === 0) {
                return null;
            }

            return { valid: true, ...result.rows[0] };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error getting help interaction:', error);
        
        // Fallback to in-memory on error
        if (!useInMemory) {
            const key = `${userId}_${guildId}`;
            const data = helpInteractions.get(key);
            return data ? { valid: true, ...data } : null;
        }
        
        return null;
    }
}

// Delete help interaction
async function deleteHelpInteraction(userId, guildId) {
    try {
        if (useInMemory || !pool) {
            // In-memory fallback
            const key = `${userId}_${guildId}`;
            const deleted = helpInteractions.delete(key);
            
            if (deleted) {
                console.log(`✅ Deleted help interaction (in-memory) for user ${userId}`);
            }
            
            return true;
        }

        // PostgreSQL implementation
        const client = await pool.connect();
        try {
            const result = await client.query(`
                DELETE FROM help_interactions 
                WHERE user_id = $1 AND guild_id = $2
            `, [userId, guildId]);

            if (result.rowCount > 0) {
                console.log(`✅ Deleted help interaction (PostgreSQL) for user ${userId}`);
            }

            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error deleting help interaction:', error);
        return false;
    }
}

// Clean up old interactions (older than 24 hours)
async function cleanupOldInteractions() {
    try {
        if (useInMemory || !pool) {
            // In-memory cleanup
            const now = Date.now();
            const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
            let cleanedCount = 0;
            
            for (const [key, data] of helpInteractions.entries()) {
                if (now - data.createdAt > expiryTime) {
                    helpInteractions.delete(key);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} old help interactions (in-memory)`);
            }
            
            return true;
        }

        // PostgreSQL cleanup
        const client = await pool.connect();
        try {
            const result = await client.query(`
                DELETE FROM help_interactions 
                WHERE created_at < NOW() - INTERVAL '24 hours'
            `);

            if (result.rowCount > 0) {
                console.log(`🧹 Cleaned up ${result.rowCount} old help interactions (PostgreSQL)`);
            }

            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error cleaning up old interactions:', error);
        return false;
    }
}

// Close database (cleanup function)
async function closeDatabase() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    
    if (pool) {
        await pool.end();
        console.log('📴 PostgreSQL connection pool closed');
    }
    
    if (useInMemory) {
        helpInteractions.clear();
        console.log('📴 In-memory database cleared');
    }
}

// Get statistics
async function getDatabaseStats() {
    try {
        if (useInMemory || !pool) {
            // In-memory stats
            return {
                type: 'in-memory',
                totalInteractions: helpInteractions.size,
                activeInteractions: Array.from(helpInteractions.values()).filter(data => {
                    const now = Date.now();
                    return (now - data.createdAt) < (24 * 60 * 60 * 1000);
                }).length
            };
        }

        // PostgreSQL stats
        const client = await pool.connect();
        try {
            const totalResult = await client.query('SELECT COUNT(*) as count FROM help_interactions');
            const activeResult = await client.query(`
                SELECT COUNT(*) as count FROM help_interactions 
                WHERE created_at > NOW() - INTERVAL '24 hours'
            `);

            return {
                type: 'postgresql',
                totalInteractions: parseInt(totalResult.rows[0].count),
                activeInteractions: parseInt(activeResult.rows[0].count)
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error getting database stats:', error);
        return {
            type: 'error',
            totalInteractions: 0,
            activeInteractions: 0
        };
    }
}

// ===== TICKET SYSTEM STORAGE =====
// Ticket panels: guildId -> { channelId, messageId, roleId, message }
const ticketPanels = new Map();
// Active tickets: ticketChannelId -> { userId, guildId, ticketNumber, createdAt }
const activeTickets = new Map();
// Ticket numbers: guildId -> ticketNumber
const ticketNumbers = new Map();

// Save ticket panel configuration
function saveTicketPanel(guildId, panelData) {
    ticketPanels.set(guildId, panelData);
    console.log(`✅ Saved ticket panel for guild ${guildId}`);
}

// Get ticket panel configuration
function getTicketPanel(guildId) {
    return ticketPanels.get(guildId) || null;
}

// Save active ticket
function saveActiveTicket(channelId, ticketData) {
    activeTickets.set(channelId, ticketData);
    console.log(`✅ Saved active ticket: ${channelId}`);
}

// Get active ticket
function getActiveTicket(channelId) {
    return activeTickets.get(channelId) || null;
}

// Delete active ticket
function deleteActiveTicket(channelId) {
    const deleted = activeTickets.delete(channelId);
    if (deleted) {
        console.log(`✅ Deleted active ticket: ${channelId}`);
    }
    return deleted;
}

// Find user's active ticket in a guild
function findUserTicket(guildId, userId) {
    for (const [channelId, ticketInfo] of activeTickets.entries()) {
        if (ticketInfo.guildId === guildId && ticketInfo.userId === userId) {
            return channelId;
        }
    }
    return null;
}

// Get all active tickets for a guild
function getGuildTickets(guildId) {
    const tickets = [];
    for (const [channelId, ticketInfo] of activeTickets.entries()) {
        if (ticketInfo.guildId === guildId) {
            tickets.push({ channelId, ...ticketInfo });
        }
    }
    return tickets;
}

// Get or increment ticket number for a guild
function getNextTicketNumber(guildId) {
    let currentNumber = ticketNumbers.get(guildId) || 0;
    currentNumber++;
    ticketNumbers.set(guildId, currentNumber);
    return currentNumber;
}

// Get current ticket number for a guild
function getCurrentTicketNumber(guildId) {
    return ticketNumbers.get(guildId) || 0;
}

// ===== LOGGING SYSTEM =====
// Save logging channel for a guild
async function saveLoggingChannel(guildId, channelId) {
    try {
        if (useInMemory || !pool) {
            loggingChannels.set(guildId, channelId);
            console.log(`✅ Saved logging channel (in-memory) for guild ${guildId}`);
            return true;
        }

        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO logging_channels (guild_id, channel_id, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (guild_id)
                DO UPDATE SET channel_id = $2, updated_at = CURRENT_TIMESTAMP
            `, [guildId, channelId]);

            console.log(`✅ Saved logging channel (PostgreSQL) for guild ${guildId}`);
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error saving logging channel:', error);
        loggingChannels.set(guildId, channelId);
        return false;
    }
}

// Get logging channel for a guild
async function getLoggingChannel(guildId) {
    try {
        if (useInMemory || !pool) {
            return loggingChannels.get(guildId) || null;
        }

        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT channel_id FROM logging_channels WHERE guild_id = $1
            `, [guildId]);

            return result.rows.length > 0 ? result.rows[0].channel_id : null;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error getting logging channel:', error);
        return loggingChannels.get(guildId) || null;
    }
}

// Save audit log entry
async function saveAuditLog(guildId, logType, userId, moderatorId, reason, details = null) {
    try {
        if (useInMemory || !pool) {
            const logId = `${guildId}_${Date.now()}_${Math.random()}`;
            const logEntry = {
                guildId,
                logType,
                userId,
                moderatorId,
                reason,
                details,
                createdAt: Date.now()
            };
            
            if (!auditLogs.has(guildId)) {
                auditLogs.set(guildId, []);
            }
            auditLogs.get(guildId).push(logEntry);
            console.log(`✅ Saved audit log (in-memory) for guild ${guildId}`);
            return true;
        }

        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO audit_logs (guild_id, log_type, user_id, moderator_id, reason, details)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [guildId, logType, userId, moderatorId, reason, details]);

            console.log(`✅ Saved audit log (PostgreSQL) for guild ${guildId}`);
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error saving audit log:', error);
        return false;
    }
}

// Get audit logs for a guild
async function getAuditLogs(guildId, logType = null, limit = 50) {
    try {
        if (useInMemory || !pool) {
            const logs = auditLogs.get(guildId) || [];
            let filtered = logType ? logs.filter(log => log.logType === logType) : logs;
            return filtered.slice(-limit).reverse();
        }

        const client = await pool.connect();
        try {
            let query = `
                SELECT * FROM audit_logs 
                WHERE guild_id = $1
            `;
            const params = [guildId];

            if (logType) {
                query += ` AND log_type = $2`;
                params.push(logType);
                query += ` ORDER BY created_at DESC LIMIT $3`;
                params.push(limit);
            } else {
                query += ` ORDER BY created_at DESC LIMIT $2`;
                params.push(limit);
            }

            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error getting audit logs:', error);
        return [];
    }
}

// Get all audit logs across all guilds (for bot owner)
async function getAllAuditLogs(limit = 100) {
    try {
        if (useInMemory || !pool) {
            const allLogs = [];
            for (const [guildId, logs] of auditLogs.entries()) {
                allLogs.push(...logs);
            }
            return allLogs.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
        }

        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM audit_logs 
                ORDER BY created_at DESC 
                LIMIT $1
            `, [limit]);

            return result.rows;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error getting all audit logs:', error);
        return [];
    }
}

module.exports = {
    initializeDatabase,
    saveHelpInteraction,
    getHelpInteraction,
    deleteHelpInteraction,
    cleanupOldInteractions,
    closeDatabase,
    getDatabaseStats,
    // Ticket system functions
    saveTicketPanel,
    getTicketPanel,
    saveActiveTicket,
    getActiveTicket,
    deleteActiveTicket,
    findUserTicket,
    getGuildTickets,
    getNextTicketNumber,
    getCurrentTicketNumber,
    // Logging system functions
    saveLoggingChannel,
    getLoggingChannel,
    saveAuditLog,
    getAuditLogs,
    getAllAuditLogs
};

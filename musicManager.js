const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const ytsearch = require('youtube-sr').default;
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');

class MusicManager {
    constructor(client) {
        this.client = client;
        this.musicWidgets = new Map(); // Store widget message IDs per guild
        this.players = new Map(); // Store audio players per guild
        this.connections = new Map(); // Store voice connections per guild
        this.queues = new Map(); // Store music queues per guild
        this.musicRequestChannels = new Map(); // Store music request channels per guild
        this.isPlaying = new Map(); // Track playing status per guild
        this.currentTrack = new Map(); // Store currently playing track per guild
        this.lastVoiceChannels = new Map(); // Store last voice channel per guild
        this.musicStates = new Map(); // Store complete music state per guild
        this.errorCounts = new Map(); // Track consecutive errors for exponential backoff
        this.homeVoiceChannels = new Map(); // Store home voice channel per guild
        this.defaultHomeVoiceChannelId = process.env.DEFAULT_HOME_VOICE_CHANNEL_ID || '1377806787431895181';
    }

    async initialize() {
        try {
            console.log('🎵 Initializing Streaming Music Manager...');

            // Load persisted music states
            await this.loadMusicStates();

            console.log('✅ Streaming Music Manager initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Error initializing Streaming Music Manager:', error);
            return false;
        }
    }

    setMusicRequestChannel(guildId, channelId) {
        this.musicRequestChannels.set(guildId, channelId);
        console.log(`🎵 Music request channel set for guild ${guildId}: ${channelId}`);
        this.saveMusicState(guildId).catch(error => console.error('❌ Error saving music state after setting music channel:', error));
    }

    getMusicRequestChannel(guildId) {
        return this.musicRequestChannels.get(guildId);
    }

    async setHomeVoiceChannel(guildId, channelId) {
        this.homeVoiceChannels.set(guildId, channelId);
        console.log(`🏠 Home voice channel set for guild ${guildId}: ${channelId}`);
        await this.saveMusicState(guildId);
        
        // Automatically join the home voice channel after setting it
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                console.log(`❌ Guild ${guildId} not found for joining home VC`);
                return;
            }
            
            const homeChannel = guild.channels.cache.get(channelId);
            if (!homeChannel) {
                console.log(`❌ Home voice channel ${channelId} not found in guild ${guild.name}`);
                return;
            }
            
            // Check if bot is already in the home channel
            const botMember = guild.members.cache.get(this.client.user.id);
            if (botMember && botMember.voice.channel && botMember.voice.channel.id === channelId) {
                console.log(`✅ Bot already in home channel: ${homeChannel.name}`);
                return;
            }
            
            // Destroy existing connection if any
            const existingConnection = this.connections.get(guildId);
            if (existingConnection) {
                try {
                    existingConnection.destroy();
                } catch (error) {
                    console.log(`🧹 Error destroying existing connection: ${error.message}`);
                }
                this.connections.delete(guildId);
            }
            
            // Join the home voice channel
            const { joinVoiceChannel } = require('@discordjs/voice');
            const connection = joinVoiceChannel({
                channelId: channelId,
                guildId: guildId,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });
            
            // Wait for connection to be ready
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 15000);
                
                if (connection.state.status === 'ready') {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    connection.once('ready', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                    
                    connection.once('error', (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                }
            });
            
            this.connections.set(guildId, connection);
            
            // Create or get player and subscribe
            let player = this.players.get(guildId);
            if (!player) {
                player = createAudioPlayer();
                this.players.set(guildId, player);
                
                // Setup player event handlers (only if new player)
                player.on(AudioPlayerStatus.Playing, () => {
                    this.isPlaying.set(guildId, true);
                    this.updateMusicWidget(guild);
                });
                
                player.on(AudioPlayerStatus.Idle, () => {
                    this.isPlaying.set(guildId, false);
                    setTimeout(() => {
                        this.currentTrack.delete(guildId);
                        this.playNext(guildId);
                    }, 500);
                });
                
                player.on('error', (error) => {
                    console.error(`❌ Audio player error in guild ${guildId}:`, error);
                    this.isPlaying.set(guildId, false);
                });
            }
            
            connection.subscribe(player);
            
            console.log(`✅ Joined home voice channel: ${homeChannel.name} in guild ${guild.name}`);
        } catch (error) {
            console.error(`❌ Error joining home voice channel for guild ${guildId}:`, error);
            // Don't throw error - just log it, setting the home VC should still succeed
        }
    }

    getHomeVoiceChannel(guildId) {
        return this.homeVoiceChannels.get(guildId) || this.defaultHomeVoiceChannelId || null;
    }

    async joinVoiceChannel(member, retryCount = 0) {
        const guildId = member.guild.id;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            throw new Error('User not in voice channel');
        }

        // Track the last voice channel for persistence
        this.lastVoiceChannels.set(guildId, voiceChannel.id);
        await this.saveMusicState(guildId);

        // Check if already connected to this channel and connection is valid
        const existingConnection = this.connections.get(guildId);
        if (existingConnection &&
            existingConnection.joinConfig.channelId === voiceChannel.id &&
            existingConnection.state.status === 'ready') {
            console.log(`🔗 Using existing valid connection to ${voiceChannel.name}`);
            return existingConnection;
        }

        // Clean up any invalid connections
        if (existingConnection) {
            try {
                existingConnection.destroy();
                console.log(`🧹 Destroyed invalid connection for guild ${guildId}`);
            } catch (error) {
                console.log(`🧹 Failed to destroy connection: ${error.message}`);
            }
            this.connections.delete(guildId);
        }

        try {
            console.log(`🔗 Creating new voice connection to ${voiceChannel.name} (attempt ${retryCount + 1})...`);

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: member.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
                group: `discord-player-${guildId}`
            });

            // Wait for connection to be ready with error handling
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Voice connection timeout - unable to establish UDP connection'));
                }, 20000);

                const onReady = () => {
                    clearTimeout(timeout);
                    cleanup();
                    resolve();
                };

                const onError = (error) => {
                    clearTimeout(timeout);
                    cleanup();
                    reject(error);
                };

                const cleanup = () => {
                    connection.removeListener('ready', onReady);
                    connection.removeListener('error', onError);
                    connection.removeListener(VoiceConnectionStatus.Signalling, onSignalling);
                };

                const onSignalling = () => {
                    console.log(`📡 Voice connection signalling... (${voiceChannel.name})`);
                };

                if (connection.state.status === 'ready') {
                    onReady();
                } else {
                    connection.once('ready', onReady);
                    connection.once('error', onError);
                    connection.on(VoiceConnectionStatus.Signalling, onSignalling);
                }
            });

            this.connections.set(guildId, connection);
            console.log(`✅ Voice connection ready for ${voiceChannel.name}`);

            // Enhanced connection monitoring with automatic cleanup
            connection.on('error', (error) => {
                console.error(`❌ Voice connection error in guild ${guildId}:`, error.message);
                // Check if it's a socket/UDP error
                if (error.message?.includes('socket') || error.message?.includes('ECONNREFUSED')) {
                    console.log(`⚠️ UDP/Socket error detected - connection will be cleaned up`);
                }
                this.handleConnectionError(guildId, member.guild);
            });

            connection.on('disconnected', () => {
                console.log(`🔌 Voice connection disconnected in guild ${guildId}`);
                this.connections.delete(guildId);
                this.isPlaying.set(guildId, false);
            });

            // Create audio player if doesn't exist
            let player = this.players.get(guildId);
            if (!player) {
                player = createAudioPlayer();
                this.players.set(guildId, player);

                // Handle player events with improved error handling
                player.on(AudioPlayerStatus.Playing, () => {
                    console.log(`🎵 Started playing in guild ${guildId}`);
                    this.isPlaying.set(guildId, true);
                    this.updateMusicWidget(member.guild);
                    this.saveMusicState(guildId); // Save state when playing
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    console.log(`🎵 Finished playing in guild ${guildId}`);
                    this.isPlaying.set(guildId, false);

                    // Small delay to prevent rapid firing
                    setTimeout(() => {
                        this.currentTrack.delete(guildId); // Clear current track when song ends
                        this.saveMusicState(guildId); // Save state when song ends
                        this.playNext(guildId);
                    }, 500);
                });

                player.on(AudioPlayerStatus.Paused, () => {
                    console.log(`⏸️ Paused in guild ${guildId}`);
                    this.isPlaying.set(guildId, false);
                    this.updateMusicWidget(member.guild);
                });

                player.on('error', (error) => {
                    console.error(`❌ Audio player error in guild ${guildId}:`, error);
                    this.isPlaying.set(guildId, false);

                    // Don't delete current track immediately - try to recover
                    const currentTrack = this.currentTrack.get(guildId);
                    const queue = this.queues.get(guildId) || [];

                    // If there was a current track, put it back in queue for retry
                    if (currentTrack) {
                        queue.unshift(currentTrack);
                        this.queues.set(guildId, queue);
                        this.currentTrack.delete(guildId);
                    }

                    // Progressive delay based on consecutive errors
                    const errorCount = this.errorCounts?.get(guildId) || 0;
                    this.errorCounts = this.errorCounts || new Map();
                    this.errorCounts.set(guildId, errorCount + 1);

                    const delay = Math.min(2000 + (errorCount * 1000), 10000); // Max 10s delay

                    setTimeout(async () => {
                        await this.saveMusicState(guildId);

                        // Reset error count on successful retry
                        if (queue.length > 0) {
                            await this.playNext(guildId);
                            // Reset error count after 30 seconds of successful playback
                            setTimeout(() => {
                                if (this.isPlaying.get(guildId)) {
                                    this.errorCounts?.set(guildId, 0);
                                }
                            }, 30000);
                        }
                    }, delay);
                });
            }
            
            // Always subscribe the player to the connection (even if player already existed)
            connection.subscribe(player);

            console.log(`🎵 Joined voice channel: ${voiceChannel.name} in guild ${member.guild.name}`);
            return connection;

        } catch (error) {
            console.error('❌ Error joining voice channel:', error.message);
            
            // Handle specific socket/UDP errors with retry logic
            if (error.message?.includes('socket') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ip discovery') || error.message?.includes('UDP')) {
                console.log(`⚠️ UDP/Socket error detected (Replit platform limitation), retrying in 2 seconds...`);
                
                // Auto-retry once for socket errors
                if (retryCount < 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return this.joinVoiceChannel(member, retryCount + 1);
                } else {
                    throw new Error(`⚠️ Replit Limitation: UDP voice connections are restricted on this platform. Music streaming requires UDP which Replit's network environment blocks for security reasons. Consider using a server with full networking capabilities.`);
                }
            }
            
            throw error;
        }
    }

    async playMusic(query, guild, member, channel) {
        try {
            if (!member.voice.channel) {
                return { success: false, message: '❌ You must be in a voice channel to play music!' };
            }

            // Parse repeat command
            let repeatCount = 1;
            let searchQuery = query;
            const repeatMatch = query.match(/^(.+?)\s+(\d+)$/);
            if (repeatMatch) {
                searchQuery = repeatMatch[1].trim();
                repeatCount = parseInt(repeatMatch[2]);
                repeatCount = Math.min(Math.max(repeatCount, 1), 50); // Limit between 1-50
            }

            console.log(`🔍 Searching for: "${searchQuery}" with ${repeatCount} repeat(s)`);

            // Join voice channel
            await this.joinVoiceChannel(member);

            // Enhanced search with robust error handling and retries
            let videoInfo;
            try {
                console.log(`🔍 Starting robust YouTube search for: "${searchQuery}"`);

                // Try multiple search strategies with better error handling
                const searchStrategies = [
                    // Strategy 1: Direct search with short timeout
                    async () => {
                        console.log(`🔍 Strategy 1 - Direct search: "${searchQuery}"`);
                        try {
                            const results = await Promise.race([
                                ytsearch.search(searchQuery, {
                                    limit: 10,
                                    type: 'video',
                                    safeSearch: false
                                }),
                                new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Direct search timeout')), 8000)
                                )
                            ]);
                            return results && results.length > 0 ? results : null;
                        } catch (error) {
                            console.log(`❌ Direct search failed: ${error.message}`);
                            return null;
                        }
                    },

                    // Strategy 2: Simplified query search
                    async () => {
                        console.log(`🔍 Strategy 2 - Simplified search`);
                        const words = searchQuery.split(' ').filter(word => word.length > 2);
                        if (words.length === 0) return null;
                        
                        const simpleQuery = words.slice(0, 3).join(' '); // Take first 3 words
                        try {
                            const results = await Promise.race([
                                ytsearch.search(simpleQuery, {
                                    limit: 8,
                                    type: 'video'
                                }),
                                new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Simplified search timeout')), 6000)
                                )
                            ]);
                            return results && results.length > 0 ? results : null;
                        } catch (error) {
                            console.log(`❌ Simplified search failed: ${error.message}`);
                            return null;
                        }
                    },

                    // Strategy 3: Single word fallback
                    async () => {
                        console.log(`🔍 Strategy 3 - Single word fallback`);
                        const words = searchQuery.split(' ').filter(word => word.length > 3);
                        if (words.length === 0) return null;
                        
                        const singleWord = words[0];
                        try {
                            const results = await Promise.race([
                                ytsearch.search(singleWord, {
                                    limit: 5,
                                    type: 'video'
                                }),
                                new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Single word search timeout')), 4000)
                                )
                            ]);
                            return results && results.length > 0 ? results : null;
                        } catch (error) {
                            console.log(`❌ Single word search failed: ${error.message}`);
                            return null;
                        }
                    }
                ];

                let searchResults = null;
                let usedStrategy = 0;

                // Try each strategy until one succeeds
                for (let i = 0; i < searchStrategies.length && !searchResults; i++) {
                    searchResults = await searchStrategies[i]();
                    if (searchResults) {
                        usedStrategy = i + 1;
                        console.log(`✅ Strategy ${usedStrategy} succeeded with ${searchResults.length} results`);
                        break;
                    }
                    
                    // Small delay between strategies
                    if (i < searchStrategies.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                if (!searchResults || searchResults.length === 0) {
                    console.log(`❌ All search strategies failed for: "${searchQuery}"`);
                    return {
                        success: false,
                        message: '❌ YouTube search is temporarily unavailable. Please try a simpler song name or try again later.'
                    };
                }

                // Select best result
                console.log(`🎯 Selecting best result from ${searchResults.length} options`);
                const bestResult = this.selectBestResult(searchResults, searchQuery);

                console.log(`✅ Selected: "${bestResult.title}"`);
                console.log(`🔗 URL: ${bestResult.url}`);

                videoInfo = {
                    title: bestResult.title,
                    url: bestResult.url,
                    duration: bestResult.duration,
                    thumbnail: bestResult.thumbnail?.url || bestResult.thumbnail?.thumbnails?.[0]?.url || 'https://i.imgur.com/placeholder.jpg'
                };
            } catch (searchError) {
                console.error('❌ Critical search error:', searchError);
                return { success: false, message: '❌ Music search system temporarily unavailable. Please try again.' };
            }

            // Get or create queue
            const guildId = guild.id;
            if (!this.queues.has(guildId)) {
                this.queues.set(guildId, []);
            }
            const queue = this.queues.get(guildId);

            // Add to queue with repeat count
            for (let i = 0; i < repeatCount; i++) {
                queue.push({
                    title: videoInfo.title,
                    url: videoInfo.url,
                    duration: videoInfo.duration,
                    thumbnail: videoInfo.thumbnail,
                    requester: member.user
                });
            }

            // Update music widget immediately after adding to queue
            await this.updateMusicWidget(guild);

            // Save music state after adding songs
            await this.saveMusicState(guildId);

            // Start playing if not already playing
            if (!this.isPlaying.get(guildId)) {
                console.log(`🎵 Starting playback for guild ${guildId}`);
                await this.playNext(guildId);
            }

            const successMessage = repeatCount > 1
                ? `✅ Added **${videoInfo.title}** to queue (${repeatCount} times)`
                : `✅ ${queue.length > 1 ? 'Added to queue' : 'Now playing'}: **${videoInfo.title}**`;

            return { success: true, message: successMessage, track: videoInfo };

        } catch (error) {
            console.error('❌ Error in playMusic:', error);
            const errorMsg = error.message || error.toString();
            return { success: false, message: `❌ Music system error: ${errorMsg}` };
        }
    }

    async playNext(guildId) {
        // Ensure queue is initialized
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, []);
        }
        
        const queue = this.queues.get(guildId);
        let player = this.players.get(guildId);
        let connection = this.connections.get(guildId);

        console.log(`🎵 playNext called - Queue length: ${queue?.length || 0}, Playing: ${this.isPlaying.get(guildId)}, Connection status: ${connection?.state.status}`);

        if (!queue || queue.length === 0) {
            console.log(`📭 Queue is empty for guild ${guildId}`);
            this.isPlaying.set(guildId, false);
            this.currentTrack.delete(guildId);
            await this.saveMusicState(guildId);
            
            // Only return to home channel if queue is genuinely empty (not still loading)
            // Add a small delay to ensure music has truly ended
            setTimeout(async () => {
                const guild = this.client.guilds.cache.get(guildId);
                const homeVoiceChannelId = this.getHomeVoiceChannel(guildId);
                
                if (guild && homeVoiceChannelId) {
                    try {
                        const homeChannel = guild.channels.cache.get(homeVoiceChannelId);
                        const botMember = guild.members.cache.get(this.client.user.id);
                        
                        // Only move if bot is in a different channel AND not currently playing
                        if (homeChannel && botMember && botMember.voice.channel && 
                            botMember.voice.channel.id !== homeVoiceChannelId &&
                            !this.isPlaying.get(guildId)) {
                            console.log(`🎵 Music ended, returning to home channel: ${homeChannel.name}`);
                            
                            const currentConnection = this.connections.get(guildId);
                            // Destroy current connection
                            if (currentConnection) {
                                currentConnection.destroy();
                                this.connections.delete(guildId);
                            }
                            
                            // Join home channel
                            const { joinVoiceChannel } = require('@discordjs/voice');
                            const homeConnection = joinVoiceChannel({
                                channelId: homeVoiceChannelId,
                                guildId: guildId,
                                adapterCreator: guild.voiceAdapterCreator,
                                selfDeaf: false,
                                selfMute: false,
                            });
                            
                            this.connections.set(guildId, homeConnection);
                            console.log(`✅ Returned to home channel: ${homeChannel.name}`);
                        }
                    } catch (error) {
                        console.error('❌ Error returning to home channel:', error);
                    }
                }
            }, 2000); // 2 second delay before returning to home channel
            
            return;
        }

        // Check if connection is still valid - only if really destroyed
        if (!connection || connection.state.status === 'destroyed') {
            console.log(`🔄 Connection invalid/destroyed for guild ${guildId}, attempting to reconnect...`);

            // Try to find a member in voice channel to rejoin
            const guild = this.client.guilds.cache.get(guildId);
            if (guild) {
                const voiceMembers = guild.members.cache.filter(member =>
                    member.voice.channel && !member.user.bot
                );

                if (voiceMembers.size > 0) {
                    const anyMember = voiceMembers.first();
                    try {
                        console.log(`📍 Attempting to rejoin voice channel for member: ${anyMember.user.username}`);
                        connection = await this.joinVoiceChannel(anyMember);
                        player = this.players.get(guildId); // Get updated player
                        console.log(`✅ Reconnection successful`);
                    } catch (error) {
                        console.error(`❌ Failed to rejoin voice channel for guild ${guildId}:`, error.message);
                        this.isPlaying.set(guildId, false);
                        return;
                    }
                } else {
                    console.log(`❌ No members in voice channels for guild ${guildId}`);
                    this.isPlaying.set(guildId, false);
                    return;
                }
            } else {
                console.error(`❌ Guild ${guildId} not found`);
                return;
            }
        }

        // Ensure player exists - create if needed
        if (!player) {
            console.log(`🎵 Creating new audio player for guild ${guildId}`);
            player = createAudioPlayer();
            this.players.set(guildId, player);
            
            // Setup player event handlers
            player.on(AudioPlayerStatus.Playing, () => {
                console.log(`🎵 Audio player now playing`);
                this.isPlaying.set(guildId, true);
            });

            player.on(AudioPlayerStatus.Idle, () => {
                console.log(`🎵 Audio player went idle`);
                this.isPlaying.set(guildId, false);
                setTimeout(() => this.playNext(guildId), 500);
            });

            player.on('error', (error) => {
                console.error(`❌ Audio player error:`, error.message);
                this.isPlaying.set(guildId, false);
            });
        }

        if (!connection) {
            console.error(`❌ No connection found for guild ${guildId} after reconnection attempt`);
            this.isPlaying.set(guildId, false);
            return;
        }
        
        // Subscribe player to connection
        connection.subscribe(player);

        const track = queue.shift();

        // Validate track URL before attempting to play
        if (!track || !track.url || !track.url.includes('youtube.com/watch') && !track.url.includes('youtu.be/')) {
            console.error(`❌ Invalid track URL for guild ${guildId}:`, track?.url);
            // Try next track
            if (queue.length > 0) {
                setTimeout(() => this.playNext(guildId), 1000);
            } else {
                this.isPlaying.set(guildId, false);
                await this.saveMusicState(guildId);
            }
            return;
        }

        try {
            console.log(`🎵 Playing: ${track.title}`);

            // Store current track for widget display and update widget immediately
            this.currentTrack.set(guildId, track);
            this.isPlaying.set(guildId, true);
            
            // Update widget immediately to show "Now Playing"
            const guild = this.client.guilds.cache.get(guildId);
            if (guild) {
                await this.updateMusicWidget(guild);
            }

            // Use ytdl-core with improved options for reliable streaming
            console.log(`🔄 Creating stream using ytdl-core for: ${track.url}`);
            
            let audioStream = null;
            
            try {
                // Create stream with improved options
                console.log(`⏳ Requesting YouTube stream for: ${track.url}`);
                
                audioStream = ytdl(track.url, {
                    quality: 'lowestaudio',
                    filter: 'audioonly',
                    highWaterMark: 1 << 24,
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
                        }
                    },
                    dl: require('https')
                });
                
                // Log stream creation
                audioStream.on('info', (info) => {
                    console.log(`📊 Stream info received - Title: ${info.videoDetails?.title}`);
                });
                
                audioStream.on('error', (error) => {
                    console.error(`❌ Stream pipeline error: ${error.message}`);
                    console.error(`Error code: ${error.code}`);
                });
                
                audioStream.on('end', () => {
                    console.log(`✅ Stream ended naturally`);
                });
                
                console.log(`✅ Stream created successfully`);
            } catch (streamError) {
                console.error(`❌ ytdl-core streaming failed: ${streamError.message}`);
                console.error(`Stream creation stack: ${streamError.stack}`);
                throw new Error(`Failed to create stream: ${streamError.message}`);
            }

            console.log(`🎵 Creating audio resource from stream`);
            const resource = createAudioResource(audioStream, {
                metadata: track,
                inputType: 'arbitrary',
                inlineVolume: true
            });

            console.log(`✅ Audio resource created`);

            // Add resource error handler to catch socket/UDP issues
            resource.on('error', (error) => {
                console.error(`❌ Audio resource error: ${error.message}`);
                console.error(`Resource error stack: ${error.stack}`);
                if (error.message?.includes('socket') || error.message?.includes('ECONNREFUSED') || error.message?.includes('UDP')) {
                    console.log(`⚠️ UDP/Socket error during playback - This is a Replit platform limitation`);
                }
            });

            console.log(`🎵 Playing resource on player for guild: ${guildId}`);
            console.log(`   Player state before play: ${player.state.status}`);
            console.log(`   Connection state: ${connection?.state.status}`);
            console.log(`   Queue length: ${queue.length}`);
            
            player.play(resource);
            
            console.log(`✅ Resource sent to player`);
            console.log(`   Player state after play: ${player.state.status}`);

            // Save state after starting new track
            await this.saveMusicState(guildId);

        } catch (error) {
            console.error('❌ Error playing track:', error);
            this.isPlaying.set(guildId, false);
            this.currentTrack.delete(guildId);

            // Enhanced retry logic with track validation
            if (queue.length > 0) {
                console.log(`🔄 Retrying next track in 3 seconds...`);
                setTimeout(() => this.playNext(guildId), 3000);
            } else {
                console.log(`📭 Queue empty after error, stopping playback`);
                await this.saveMusicState(guildId);
                await this.updateMusicWidget(guild);
            }
        }
    }

    // Clean stop method for proper cleanup
    async cleanStopMusic(guildId) {
        try {
            const player = this.players.get(guildId);
            const connection = this.connections.get(guildId);
            const queue = this.queues.get(guildId);

            // Stop player
            if (player) {
                player.stop();
            }

            // Clear queue and current track
            if (queue) {
                queue.length = 0;
            }
            this.currentTrack.delete(guildId);
            this.isPlaying.set(guildId, false);

            // Destroy connection
            if (connection) {
                connection.destroy();
                this.connections.delete(guildId);
            }

            // Clean up player
            this.players.delete(guildId);

            // Save cleaned state
            await this.saveMusicState(guildId);

            console.log(`🧹 Clean stop completed for guild ${guildId}`);
        } catch (error) {
            console.error(`❌ Error during clean stop for guild ${guildId}:`, error);
        }
    }

    async initializeMusicWidget(guild) {
        try {
            const musicChannelId = this.getMusicRequestChannel(guild.id);
            if (!musicChannelId) {
                console.log(`No music request channel set for guild ${guild.name}`);
                return false;
            }

            const musicChannel = guild.channels.cache.get(musicChannelId);
            if (!musicChannel) {
                console.error(`Music channel ${musicChannelId} not found in guild ${guild.name}`);
                return false;
            }

            // Clear existing messages with better error handling
            try {
                const existingMessages = await musicChannel.messages.fetch({ limit: 50 });
                const messagesToDelete = existingMessages.filter(msg =>
                    !msg.pinned &&
                    msg.author.id === this.client.user.id && // Only delete bot's own messages
                    Date.now() - msg.createdTimestamp > 5000 // Only delete messages older than 5 seconds
                );

                let deletedCount = 0;
                for (const msg of messagesToDelete.values()) {
                    try {
                        await msg.delete();
                        deletedCount++;
                        // Small delay between deletions to prevent rate limiting
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (deleteError) {
                        // Silently ignore delete errors (message might already be deleted)
                        if (deleteError.code !== 10008) { // Only log if not "Unknown Message"
                            console.log(`Could not delete message ${msg.id}: ${deleteError.message}`);
                        }
                    }
                }
                console.log(`🧹 Cleared ${deletedCount} messages from music channel`);
            } catch (error) {
                console.log('Could not clear existing messages:', error.message);
            }

            // Create and send new widget
            const widget = this.createMusicWidget(guild);
            const newWidget = await musicChannel.send(widget);
            this.musicWidgets.set(guild.id, newWidget.id);
            console.log(`🎵 Streaming music widget created for guild ${guild.name}`);

            return true;

        } catch (error) {
            console.error('❌ Error initializing music widget:', error);
            return false;
        }
    }

    createMusicWidget(guild) {
        const guildId = guild.id;
        const queue = this.queues.get(guildId) || [];
        const isPlaying = this.isPlaying.get(guildId) || false;
        const connection = this.connections.get(guildId);

        let description;
        let connectionStatus = 'ᯓᡣ𐭩 Ready to play';

        if (connection) {
            connectionStatus = 'ᡣ𐭩 Connected & active';
        }

        // Get current playing song from stored metadata
        const currentlyPlaying = this.currentTrack?.get(guildId);

        if (isPlaying && currentlyPlaying) {
            const title = currentlyPlaying.title.length > 40 ? currentlyPlaying.title.substring(0, 40) + '...' : currentlyPlaying.title;

            description = `ᯓᡣ𐭩 discord.gg/scriptspace is a highly engineered discord server providing premium music streaming experience with instant playback and unlimited song requests ᡣ𐭩

**ᯓᡣ𐭩 NOW PLAYING**

✿ **${title}**
❀ **Requested by:** <@${currentlyPlaying.requester.id}>`;

            if (queue.length > 0) {
                description += `\n✿ **Queue:** ${queue.length} song${queue.length > 1 ? 's' : ''} waiting`;

                // Show next 3 songs in queue
                if (queue.length > 0) {
                    description += `\n\n**ᯓᡣ𐭩 UP NEXT**\n`;
                    const nextSongs = queue.slice(0, 3).map((track, index) => {
                        const songTitle = track.title.length > 30 ? track.title.substring(0, 30) + '...' : track.title;
                        return `${index + 1}. ${songTitle}`;
                    }).join('\n');
                    description += nextSongs;

                    if (queue.length > 3) {
                        description += `\n... and ${queue.length - 3} more`;
                    }
                }
            }

            description += `\n\n❀ **Status:** ${connectionStatus}

**ᯓᡣ𐭩 MUSIC FEATURES**

ᡣ𐭩 **Instant** song search & playback
ᡣ𐭩 **Unlimited** song requests
ᡣ𐭩 **Queue** management system
ᡣ𐭩 **High quality** audio streaming
ᡣ𐭩 **Voice controls** available

**✿ Type any song name to add to queue!**`;
        } else {
            description = `ᯓᡣ𐭩 discord.gg/scriptspace is a highly engineered discord server providing premium music streaming experience with instant playback and unlimited song requests ᡣ𐭩

**ᯓᡣ𐭩 MUSIC PLAYER FEATURES**

ᡣ𐭩 **Instant** song search & playback
ᡣ𐭩 **Unlimited** song requests available
ᡣ𐭩 **High quality** audio streaming
ᡣ𐭩 **Queue** management system
ᡣ𐭩 **Voice controls** with buttons
ᡣ𐭩 **Auto-join** your voice channel

**ᯓᡣ𐭩 HOW TO USE**

❀ **Join** any voice channel
✿ **Type** song name in this channel
❀ **Enjoy** instant high-quality music

**✿ Status:** ${connectionStatus}`;
        }

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setAuthor({
                name: 'Quarantianizo made at discord.gg/scriptspace by script.agi',
                iconURL: 'https://cdn.discordapp.com/attachments/1410011813398974626/1441522999319597246/InShot_20251121_222914967.jpg?ex=69236be9&is=69221a69&hm=ea10cf32552de29bbc4836cb3ab1dda5b4679efb59ef14233225d755130110c0&'
            })
            .setTitle('ᯓᡣ𐭩 **Compact Music Player**')
            .setDescription(description)
            .setThumbnail(this.client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setImage('https://cdn.discordapp.com/attachments/1410011813398974626/1441522999319597246/InShot_20251121_222914967.jpg?ex=69236be9&is=69221a69&hm=ea10cf32552de29bbc4836cb3ab1dda5b4679efb59ef14233225d755130110c0&')
            .setFooter({
                text: isPlaying ? 'Music Player • Now playing' : 'Music Player • Ready for requests',
                iconURL: 'https://cdn.discordapp.com/attachments/1410011813398974626/1441522999319597246/InShot_20251121_222914967.jpg?ex=69236be9&is=69221a69&hm=ea10cf32552de29bbc4836cb3ab1dda5b4679efb59ef14233225d755130110c0&'
            })
            .setTimestamp();

        // Create control buttons with help command styling
        const hasQueue = queue.length > 0;
        const hasConnection = !!connection;

        const playPauseButton = new ButtonBuilder()
            .setCustomId(`music_${isPlaying ? 'pause' : 'play'}_${guild.id}`)
            .setLabel(isPlaying ? 'ᯓᡣ𐭩 Pause' : 'ᯓᡣ𐭩 Play')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasQueue);

        const skipButton = new ButtonBuilder()
            .setCustomId(`music_skip_${guild.id}`)
            .setLabel('✿ Skip')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasQueue || queue.length <= 1);

        const queueButton = new ButtonBuilder()
            .setCustomId(`music_queue_${guild.id}`)
            .setLabel('❀ Queue')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasQueue);

        const stopButton = new ButtonBuilder()
            .setCustomId(`music_stop_${guild.id}`)
            .setLabel('ᡣ𐭩 Stop')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!hasConnection);

        const buttonRow = new ActionRowBuilder()
            .addComponents(playPauseButton, skipButton, queueButton, stopButton);

        return {
            embeds: [embed],
            components: [buttonRow]
        };
    }

    async updateMusicWidget(guild) {
        try {
            const musicChannelId = this.getMusicRequestChannel(guild.id);
            if (!musicChannelId) return;

            const musicChannel = guild.channels.cache.get(musicChannelId);
            if (!musicChannel) return;

            const widgetMessageId = this.musicWidgets.get(guild.id);
            if (!widgetMessageId) return;

            const widgetMessage = await musicChannel.messages.fetch(widgetMessageId);
            if (!widgetMessage) return;

            const updatedWidget = this.createMusicWidget(guild);
            await widgetMessage.edit(updatedWidget);

        } catch (error) {
            console.error('❌ Error updating music widget:', error);
        }
    }

    async handleMusicControls(interaction) {
        try {
            const [, action, guildId] = interaction.customId.split('_');
            const guild = this.client.guilds.cache.get(guildId);

            if (!guild) {
                await interaction.reply({ content: '❌ Guild not found!', ephemeral: true });
                return;
            }

            const member = guild.members.cache.get(interaction.user.id);
            if (!member || !member.voice.channel) {
                await interaction.reply({ content: '❌ You must be in a voice channel to use music controls!', ephemeral: true });
                return;
            }

            const player = this.players.get(guild.id);
            const queue = this.queues.get(guildId) || [];

            switch (action) {
                case 'play':
                    if (queue.length === 0) {
                        await interaction.reply({ content: '❌ No music in queue to play!', ephemeral: true });
                        return;
                    }

                    // Ensure we have a valid connection and player
                    try {
                        await this.joinVoiceChannel(member);

                        if (!this.isPlaying.get(guildId)) {
                            await this.playNext(guildId);
                            await interaction.reply({ content: 'ᡣ𐭩 Started playback!', ephemeral: true });
                        } else {
                            // If paused, try to unpause
                            const currentPlayer = this.players.get(guildId);
                            if (currentPlayer) {
                                currentPlayer.unpause();
                                this.isPlaying.set(guildId, true);
                                await this.saveMusicState(guildId);
                            }
                            await interaction.reply({ content: 'ᡣ𐭩 Resumed playback!', ephemeral: true });
                        }
                    } catch (error) {
                        console.error('❌ Error starting playback:', error);
                        await interaction.reply({ content: '❌ Failed to start playback. Try again!', ephemeral: true });
                    }
                    break;

                case 'pause':
                    if (!player || !this.isPlaying.get(guildId)) {
                        await interaction.reply({ content: '❌ No music playing to pause!', ephemeral: true });
                        return;
                    }
                    player.pause();
                    this.isPlaying.set(guildId, false);
                    await this.saveMusicState(guildId);
                    await interaction.reply({ content: '❀ Paused playback!', ephemeral: true });
                    break;

                case 'stop':
                    // Clean stop with proper state cleanup
                    await this.cleanStopMusic(guildId);
                    await interaction.reply({ content: '❀ Stopped playback and left voice channel!', ephemeral: true });
                    break;

                case 'skip':
                    const currentlyPlayingTrack = this.currentTrack.get(guildId);
                    if (!currentlyPlayingTrack && queue.length === 0) {
                        await interaction.reply({ content: '❌ No music playing to skip!', ephemeral: true });
                        return;
                    }
                    if (player) {
                        player.stop(); // This will trigger playNext through the Idle event
                    } else if (queue.length > 0) {
                        // If no player but queue exists, start next song
                        await this.playNext(guildId);
                    }
                    await interaction.reply({ content: `ᯓᡣ𐭩 Skipped: **${currentlyPlayingTrack?.title || 'Unknown'}**`, ephemeral: true });
                    break;

                case 'queue':
                    if (queue.length === 0) {
                        await interaction.reply({ content: '❌ Queue is empty!', ephemeral: true });
                        return;
                    }

                    const queueList = queue.map((track, index) =>
                        `**${index + 1}.** ${track.title} - <@${track.requester.id}>`
                    ).slice(0, 10).join('\n');

                    const queueEmbed = new EmbedBuilder()
                        .setColor('#af7cd2')
                        .setTitle('ᯓᡣ𐭩 Music Queue')
                        .setDescription(queueList)
                        .setFooter({
                            text: queue.length > 10 ? `And ${queue.length - 10} more...` : `Total: ${queue.length} songs`
                        })
                        .setTimestamp();

                    await interaction.reply({ embeds: [queueEmbed], ephemeral: true });
                    break;

                default:
                    await interaction.reply({ content: '❌ Unknown music control!', ephemeral: true });
            }

            // Update widget after any control action
            await this.updateMusicWidget(guild);

        } catch (error) {
            console.error('❌ Error handling music controls:', error);
            await interaction.reply({ content: '❌ An error occurred while processing your request!', ephemeral: true });
        }
    }

    // Handle connection errors with auto-recovery
    async handleConnectionError(guildId, guild) {
        try {
            console.log(`🔄 Attempting connection recovery for guild ${guildId}...`);

            // Clean up current connection
            const connection = this.connections.get(guildId);
            if (connection) {
                connection.destroy();
                this.connections.delete(guildId);
            }

            // Find members in voice channels for reconnection
            const voiceMembers = guild.members.cache.filter(member =>
                member.voice.channel && !member.user.bot
            );

            if (voiceMembers.size > 0) {
                const anyMember = voiceMembers.first();

                // Wait a moment before reconnecting
                setTimeout(async () => {
                    try {
                        await this.joinVoiceChannel(anyMember);
                        console.log(`✅ Connection recovered for guild ${guildId}`);

                        // Resume playback if there was a current track or queue
                        const queue = this.queues.get(guildId) || [];
                        const currentTrack = this.currentTrack.get(guildId);

                        if (currentTrack) {
                            // Re-add current track to front of queue
                            queue.unshift(currentTrack);
                            this.queues.set(guildId, queue);
                            this.currentTrack.delete(guildId);
                        }

                        if (queue.length > 0) {
                            await this.playNext(guildId);
                        }

                    } catch (recoveryError) {
                        console.error(`❌ Connection recovery failed for guild ${guildId}:`, recoveryError);
                    }
                }, 5000);
            }

        } catch (error) {
            console.error(`❌ Error in connection recovery for guild ${guildId}:`, error);
        }
    }

    handleVoiceUpdate(oldState, newState) {
        // Handle bot disconnection
        if (newState.member && newState.member.id === this.client.user.id) {
            if (!newState.channelId && oldState.channelId) {
                const guildId = newState.guild.id;
                const player = this.players.get(guildId);
                if (player) {
                    player.stop();
                }
                this.connections.delete(guildId);
                this.isPlaying.set(guildId, false);
                console.log('🔌 Bot disconnected from voice, stopped music');
            }
        }
    }

    // Generate simplified search queries for better reliability
    generateSimpleSearchQueries(query) {
        const simpleQueries = [];
        const cleanQuery = query.toLowerCase().trim();
        const words = cleanQuery.split(' ').filter(word => word.length > 1);

        // Basic single words (most reliable)
        if (words.length >= 1) {
            simpleQueries.push(words[0]); // First word only
        }

        if (words.length >= 2) {
            simpleQueries.push(words.slice(0, 2).join(' ')); // First two words
            simpleQueries.push(`${words[0]} ${words[words.length - 1]}`); // First and last word
        }

        if (words.length >= 3) {
            simpleQueries.push(words.slice(0, 3).join(' ')); // First three words
        }

        // Clean the original query
        const cleanedQuery = cleanQuery.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanedQuery !== cleanQuery && cleanedQuery.length > 0) {
            simpleQueries.push(cleanedQuery);
        }

        return [...new Set(simpleQueries)]; // Remove duplicates
    }

    // Generate search variations for better fuzzy matching
    generateSearchVariations(query) {
        const variations = [];
        const cleanQuery = query.toLowerCase().trim();

        // Remove common words that might interfere with search
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'na', 'da', 'ka', 'ra'];
        const words = cleanQuery.split(' ').filter(word => !stopWords.includes(word) && word.length > 1);

        // Original query (highest priority)
        variations.push(cleanQuery);

        // Exact phrase search with quotes
        variations.push(`"${cleanQuery}"`);

        // Clean special characters and normalize
        const normalizedQuery = cleanQuery
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (normalizedQuery !== cleanQuery && normalizedQuery.length > 0) {
            variations.push(normalizedQuery);
            variations.push(`"${normalizedQuery}"`);
        }

        // Key word combinations for better matching
        if (words.length >= 2) {
            // First two words (most important)
            variations.push(words.slice(0, 2).join(' '));
            variations.push(`"${words.slice(0, 2).join(' ')}"`);

            // Last two words
            if (words.length > 2) {
                variations.push(words.slice(-2).join(' '));
            }

            // First and last word
            if (words.length > 2) {
                variations.push(`${words[0]} ${words[words.length - 1]}`);
            }
        }

        // Add song/music modifiers (lower priority)
        variations.push(`${cleanQuery} song`);
        variations.push(`${cleanQuery} music`);
        variations.push(`${cleanQuery} audio`);
        variations.push(`${cleanQuery} official`);

        // Try phonetic variations for common misspellings
        const phoneticVariations = this.generatePhoneticVariations(cleanQuery);
        variations.push(...phoneticVariations);

        return [...new Set(variations)]; // Remove duplicates
    }

    // Generate phonetic variations for better matching
    generatePhoneticVariations(query) {
        const variations = [];
        const words = query.toLowerCase().split(' ');

        // Common phonetic substitutions
        const substitutions = [
            ['ph', 'f'], ['ck', 'k'], ['qu', 'kw'], ['x', 'ks'],
            ['ch', 'k'], ['sh', 'ch'], ['th', 't'], ['gh', 'g'],
            ['oo', 'u'], ['ee', 'i'], ['aa', 'a'], ['iy', 'i'],
            ['ay', 'ai'], ['ey', 'ei'], ['oy', 'oi']
        ];

        for (const word of words) {
            let phoneticWord = word;
            for (const [from, to] of substitutions) {
                phoneticWord = phoneticWord.replace(new RegExp(from, 'g'), to);
            }
            if (phoneticWord !== word) {
                const phoneticQuery = words.map(w => w === word ? phoneticWord : w).join(' ');
                variations.push(phoneticQuery);
            }
        }

        return variations;
    }

    // Generate lyric-based search queries
    generateLyricSearchQueries(query) {
        const lyricQueries = [];
        const cleanQuery = query.toLowerCase().trim();
        const words = cleanQuery.split(' ').filter(word => word.length > 2);

        // Exact phrase searches
        lyricQueries.push(`"${cleanQuery}" lyrics`);
        lyricQueries.push(`"${cleanQuery}" song`);
        lyricQueries.push(`"${cleanQuery}" music video`);

        // Word combinations for partial matches
        if (words.length >= 2) {
            // Try different word combinations
            for (let i = 0; i < words.length - 1; i++) {
                for (let j = i + 2; j <= Math.min(i + 4, words.length); j++) {
                    const phrase = words.slice(i, j).join(' ');
                    if (phrase.length > 4) {
                        lyricQueries.push(`"${phrase}" song`);
                        lyricQueries.push(`${phrase} lyrics`);
                    }
                }
            }

            // Most important words (first 3)
            if (words.length > 3) {
                const keyPhrase = words.slice(0, 3).join(' ');
                lyricQueries.push(`"${keyPhrase}"`);
                lyricQueries.push(`${keyPhrase} song`);
            }
        }

        // Alternative search patterns
        lyricQueries.push(`${cleanQuery} official video`);
        lyricQueries.push(`${cleanQuery} full song`);
        lyricQueries.push(`${cleanQuery} audio`);

        // Remove duplicates and return
        return [...new Set(lyricQueries)];
    }

    // Select the best result from search results
    selectBestResult(results, originalQuery) {
        if (results.length === 1) return results[0];

        const query = originalQuery.toLowerCase().trim();
        const queryWords = query.split(' ').filter(word => word.length > 1);
        let bestResult = results[0];
        let bestScore = -1000;

        console.log(`🎯 Evaluating ${results.length} results for query: "${query}"`);

        for (const result of results) {
            let score = 0;
            const title = result.title.toLowerCase();
            const channel = result.channel?.name?.toLowerCase() || '';
            const description = result.description?.toLowerCase() || '';

            // 1. Exact query match (highest priority)
            if (title.includes(query)) {
                score += 50;
                console.log(`   📈 Exact query match bonus: +50 for "${result.title}"`);
            }

            // 2. Word-by-word matching with position weighting
            let wordMatchScore = 0;
            let wordMatchCount = 0;
            for (let i = 0; i < queryWords.length; i++) {
                const queryWord = queryWords[i];
                if (title.includes(queryWord)) {
                    const positionWeight = queryWords.length - i; // Earlier words more important
                    wordMatchScore += positionWeight * 5;
                    wordMatchCount++;
                }
            }

            // Bonus for matching most/all words
            const wordMatchRatio = wordMatchCount / queryWords.length;
            score += wordMatchScore * wordMatchRatio;
            if (wordMatchCount === queryWords.length) {
                score += 20; // All words match bonus
            }

            // 3. Title quality indicators
            if (title.includes('official video') || title.includes('music video')) {
                score += 15;
            } else if (title.includes('official')) {
                score += 10;
            } else if (title.includes('audio') || title.includes('song')) {
                score += 5;
            }

            // 4. Channel quality
            if (channel.includes('official') || channel.includes('records') || channel.includes('music')) {
                score += 8;
            } else if (channel.includes('vevo')) {
                score += 12;
            }

            // 5. Duration preference (2-8 minutes ideal for songs)
            const duration = result.duration || 0;
            if (duration >= 120 && duration <= 480) { // 2-8 minutes
                score += 5;
            } else if (duration > 480 && duration <= 600) { // 8-10 minutes
                score += 2;
            } else if (duration > 600) { // Too long
                score -= 3;
            } else if (duration < 60 && duration > 0) { // Too short
                score -= 5;
            }

            // 6. View count (popularity indicator)
            if (result.views) {
                const viewScore = Math.min(Math.log10(result.views) * 2, 10);
                score += viewScore;
            }

            // 7. Title length preference
            if (title.length < 80) {
                score += 3;
            } else if (title.length > 150) {
                score -= 5;
            }

            // 8. Penalties for unwanted content
            const penalties = [
                ['cover', -8], ['remix', -6], ['karaoke', -10], ['instrumental', -4],
                ['reaction', -12], ['live', -3], ['concert', -3], ['mashup', -5],
                ['speed up', -8], ['slowed', -6], ['8d', -4], ['bass boosted', -6],
                ['nightcore', -8], ['tutorial', -15], ['how to', -15], ['making of', -10]
            ];

            for (const [keyword, penalty] of penalties) {
                if (title.includes(keyword) || description.includes(keyword)) {
                    score += penalty;
                }
            }

            // 9. Sequence matching (consecutive words)
            let maxSequenceLength = 0;
            for (let i = 0; i < queryWords.length - 1; i++) {
                let sequenceLength = 1;
                let titleIndex = title.indexOf(queryWords[i]);

                if (titleIndex !== -1) {
                    for (let j = i + 1; j < queryWords.length; j++) {
                        const nextWordIndex = title.indexOf(queryWords[j], titleIndex);
                        if (nextWordIndex !== -1 && nextWordIndex - titleIndex < 50) {
                            sequenceLength++;
                            titleIndex = nextWordIndex;
                        } else {
                            break;
                        }
                    }
                }
                maxSequenceLength = Math.max(maxSequenceLength, sequenceLength);
            }
            score += maxSequenceLength * 8;

            console.log(`   📊 "${result.title.substring(0, 50)}..." - Score: ${score.toFixed(1)}`);

            if (score > bestScore) {
                bestScore = score;
                bestResult = result;
            }
        }

        console.log(`🎯 Best result selected with score ${bestScore.toFixed(1)}: "${bestResult.title}"`);
        return bestResult;
    }

    getConnectionStatus() {
        const totalConnections = this.connections.size;
        return { connected: totalConnections, total: totalConnections };
    }

    // Save music state to file system for persistence
    async saveMusicState(guildId) {
        try {
            const queue = this.queues.get(guildId) || [];
            const currentTrack = this.currentTrack.get(guildId);
            const isPlaying = this.isPlaying.get(guildId) || false;
            const lastVoiceChannel = this.lastVoiceChannels.get(guildId);
            const musicRequestChannel = this.musicRequestChannels.get(guildId);
            const homeVoiceChannel = this.homeVoiceChannels.get(guildId);

            const musicState = {
                guildId,
                queue,
                currentTrack,
                isPlaying,
                lastVoiceChannel,
                musicRequestChannel,
                homeVoiceChannel,
                timestamp: Date.now()
            };

            this.musicStates.set(guildId, musicState);

            // Save to file system
            const fs = require('fs').promises;
            const stateData = JSON.stringify(Object.fromEntries(this.musicStates), null, 2);
            await fs.writeFile('./music_states.json', stateData);

            console.log(`💾 Music state saved for guild ${guildId}`);
        } catch (error) {
            console.error('❌ Error saving music state:', error);
        }
    }

    // Load music states from file system
    async loadMusicStates() {
        try {
            const fs = require('fs').promises;

            try {
                const stateData = await fs.readFile('./music_states.json', 'utf8');
                const states = JSON.parse(stateData);

                for (const [guildId, state] of Object.entries(states)) {
                    // Only restore states that are less than 24 hours old
                    if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                        this.musicStates.set(guildId, state);
                        this.queues.set(guildId, state.queue || []);
                        this.currentTrack.set(guildId, state.currentTrack);
                        this.isPlaying.set(guildId, false); // Always start as not playing
                        this.lastVoiceChannels.set(guildId, state.lastVoiceChannel);
                        if (state.musicRequestChannel) {
                            this.musicRequestChannels.set(guildId, state.musicRequestChannel);
                        }
                        if (state.homeVoiceChannel) {
                            this.homeVoiceChannels.set(guildId, state.homeVoiceChannel);
                        }

                        console.log(`🔄 Restored music state for guild ${guildId} - ${state.queue?.length || 0} songs in queue`);
                    }
                }

                console.log('✅ Music states loaded from persistence');
            } catch (fileError) {
                console.log('📝 No existing music states file found, starting fresh');
            }
        } catch (error) {
            console.error('❌ Error loading music states:', error);
        }
    }

    // Restore music session for a guild
    async restoreMusicSession(guild) {
        try {
            const guildId = guild.id;
            const musicState = this.musicStates.get(guildId);

            if (!musicState) {
                console.log(`No music state to restore for guild ${guild.name}`);
                return false;
            }

            const queue = this.queues.get(guildId) || [];
            const currentTrack = this.currentTrack.get(guildId);
            const lastVoiceChannel = this.lastVoiceChannels.get(guildId);

            if (!lastVoiceChannel || (queue.length === 0 && !currentTrack)) {
                console.log(`No music to restore for guild ${guild.name}`);
                return false;
            }

            // Find the last voice channel
            const voiceChannel = guild.channels.cache.get(lastVoiceChannel);
            if (!voiceChannel) {
                console.log(`Last voice channel not found for guild ${guild.name}`);
                return false;
            }

            // Check if there are members in the voice channel
            const membersInChannel = voiceChannel.members.filter(m => !m.user.bot);
            if (membersInChannel.size === 0) {
                console.log(`No members in last voice channel for guild ${guild.name}, skipping restore`);
                return false;
            }

            console.log(`🔄 Restoring music session for guild ${guild.name}`);
            console.log(`📍 Last voice channel: ${voiceChannel.name}`);
            console.log(`🎵 Queue length: ${queue.length}`);
            console.log(`🎧 Current track: ${currentTrack?.title || 'None'}`);

            // Try to join the last voice channel
            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guildId,
                    adapterCreator: guild.voiceAdapterCreator,
                });

                this.connections.set(guildId, connection);

                // Create audio player if doesn't exist
                if (!this.players.has(guildId)) {
                    const player = createAudioPlayer();
                    this.players.set(guildId, player);
                    connection.subscribe(player);

                    // Handle player events
                    player.on(AudioPlayerStatus.Playing, () => {
                        console.log(`🎵 Resumed playing in guild ${guildId}`);
                        this.isPlaying.set(guildId, true);
                        this.updateMusicWidget(guild);
                    });

                    player.on(AudioPlayerStatus.Idle, () => {
                        console.log(`🎵 Finished playing in guild ${guildId}`);
                        this.isPlaying.set(guildId, false);
                        this.currentTrack.delete(guildId);
                        this.playNext(guildId);
                    });

                    player.on('error', (error) => {
                        console.error(`❌ Audio player error in guild ${guildId}:`, error);
                        this.isPlaying.set(guildId, false);
                        this.playNext(guildId);
                    });
                }

                // If there was a current track, add it back to the beginning of the queue
                if (currentTrack) {
                    queue.unshift(currentTrack);
                    this.queues.set(guildId, queue);
                    this.currentTrack.delete(guildId); // Clear current track so it gets picked from queue
                }

                // Start playing if there's music in queue
                if (queue.length > 0) {
                    console.log(`🎵 Auto-resuming music playback for guild ${guild.name}`);
                    await this.playNext(guildId);
                }

                // Update the music widget
                await this.updateMusicWidget(guild);

                // Send restoration notification to music channel
                const musicChannelId = this.getMusicRequestChannel(guildId);
                if (musicChannelId) {
                    const musicChannel = guild.channels.cache.get(musicChannelId);
                    if (musicChannel) {
                        const restoreEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('🔄 Music Session Restored')
                            .setDescription(`Reconnected to **${voiceChannel.name}** and restored your music queue!`)
                            .addFields(
                                { name: '🎵 Queue', value: `${queue.length} song${queue.length !== 1 ? 's' : ''}`, inline: true },
                                { name: '🔊 Status', value: queue.length > 0 ? 'Auto-playing resumed' : 'Ready for requests', inline: true }
                            )
                            .setFooter({ text: 'Your music never stops!' })
                            .setTimestamp();

                        const restoreMsg = await musicChannel.send({ embeds: [restoreEmbed] });

                        // Delete the restore message after 10 seconds
                        setTimeout(() => restoreMsg.delete().catch(console.error), 10000);
                    }
                }

                console.log(`✅ Music session restored successfully for guild ${guild.name}`);
                return true;

            } catch (connectionError) {
                console.error(`❌ Failed to restore voice connection for guild ${guild.name}:`, connectionError);
                return false;
            }

        } catch (error) {
            console.error('❌ Error restoring music session:', error);
            return false;
        }
    }

    // Robust YouTube search with multiple strategies and better error handling
    async performRobustYouTubeSearch(query, maxResults = 1) {
        console.log(`🔍 Starting robust YouTube search for: "${query}"`);

        const searchStrategies = [
            () => this.directYouTubeSearch(query, maxResults),
            () => this.fallbackYouTubeSearch(query, maxResults),
            () => this.basicYouTubeSearch(query, maxResults)
        ];

        for (let i = 0; i < searchStrategies.length; i++) {
            try {
                console.log(`🔍 Strategy ${i + 1} - ${['Direct search with retries', 'Fallback search with cleaned query', 'Basic search'][i]}: "${query}"`);

                // Add timeout to prevent infinite hanging
                const results = await Promise.race([
                    searchStrategies[i](),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Search timeout')), 15000)
                    )
                ]);

                if (results && results.length > 0) {
                    console.log(`✅ Strategy ${i + 1} successful - Found ${results.length} results`);
                    return results;
                }
            } catch (error) {
                console.log(`❌ Strategy ${i + 1} failed:`, error.message);
                if (i === searchStrategies.length - 1) {
                    console.log('❌ All search strategies exhausted');
                }
            }
        }

        return [];
    }

    // Direct YouTube search with retry mechanism
    async directYouTubeSearch(query, maxResults = 1, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const results = await ytsearch.search(query, {
                    limit: maxResults,
                    type: 'video',
                    safeSearch: false
                });
                if (results && results.length > 0) {
                    return results
                        .filter(item => item.duration)
                        .slice(0, maxResults);
                }
            } catch (error) {
                console.log(`❌ Search attempt ${attempt} failed:`, error.message);
                if (attempt < maxRetries) {
                    const waitTime = 2000; // Fixed 2 second wait
                    console.log(`⏳ Waiting ${waitTime/1000}s before retry ${attempt + 1}...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    throw error;
                }
            }
        }
        return [];
    }

    // Fallback search using play-dl
    async fallbackYouTubeSearch(query, maxResults = 1) {
        try {
            const playDl = require('play-dl');
            const results = await playDl.search(query, { limit: maxResults, source: { youtube: 'video' } });

            if (results && results.length > 0) {
                return results.map(video => ({
                    type: 'video',
                    title: video.title,
                    url: video.url,
                    duration: video.durationInSec ? `${Math.floor(video.durationInSec / 60)}:${(video.durationInSec % 60).toString().padStart(2, '0')}` : null,
                    thumbnail: video.thumbnails?.[0]?.url,
                    channel: {
                        name: video.channel?.name || 'Unknown'
                    }
                }));
            }
        } catch (error) {
            console.log(`❌ play-dl search failed:`, error.message);

            // Try with cleaned query using youtube-sr
            try {
                const variations = this.generateSearchVariations(query);

                for (const variation of variations) {
                    try {
                        const results = await ytsearch.search(variation, { 
                            limit: maxResults,
                            type: 'video',
                            safeSearch: false
                        });
                        if (results && results.length > 0) {
                            return results
                                .filter(item => item.duration)
                                .slice(0, maxResults);
                        }
                    } catch (error) {
                        console.log(`❌ Variation "${variation}" failed:`, error.message);
                        continue;
                    }
                }
            } catch (fallbackError) {
                throw fallbackError;
            }
        }
        return [];
    }

    // Basic search as last resort with timeout
    async basicYouTubeSearch(query, maxResults = 1) {
        try {
            // Ultra-simplified search
            const simplifiedQuery = query.replace(/[^\w\s]/g, '').trim();
            if (!simplifiedQuery) throw new Error('Query too simple');

            // Add timeout for basic search
            const searchPromise = ytsearch.search(simplifiedQuery, { 
                limit: maxResults,
                type: 'video'
            });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Basic search timeout')), 8000)
            );

            const results = await Promise.race([searchPromise, timeoutPromise]);

            if (results && results.length > 0) {
                return results.slice(0, maxResults);
            }
        } catch (error) {
            console.log(`❌ Basic search failed:`, error.message);
            throw error;
        }
        return [];
    }

    async handleMusicRequest(interaction, searchQuery, repeat) {
        try {
            // Search for the song with timeout
            console.log(`🔍 Searching for: "${searchQuery}" with ${repeat} repeat(s)`);

            const searchResults = await Promise.race([
                this.performRobustYouTubeSearch(searchQuery, 1),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Search operation timeout')), 20000)
                )
            ]);

            if (!searchResults || searchResults.length === 0) {
                console.log(`❌ No results found for: "${searchQuery}"`);
                const noResultsEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ No Results Found')
                    .setDescription(`Could not find any results for "${searchQuery}"\nTry a different search term or check your spelling.`)
                    .addFields(
                        { name: '💡 Tips', value: '• Use simpler keywords\n• Check spelling\n• Try artist name + song title', inline: false }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [noResultsEmbed] });
                return;
            }

            const videoInfo = {
                title: searchResults[0].title,
                url: searchResults[0].url,
                duration: searchResults[0].duration,
                thumbnail: searchResults[0].thumbnail?.url || searchResults[0].thumbnail?.thumbnails?.[0]?.url || 'https://i.imgur.com/placeholder.jpg'
            };

            // Add to queue
            const guildId = interaction.guildId;
            if (!this.queues.has(guildId)) {
                this.queues.set(guildId, []);
            }
            const queue = this.queues.get(guildId);

            for (let i = 0; i < repeat; i++) {
                queue.push({
                    title: videoInfo.title,
                    url: videoInfo.url,
                    duration: videoInfo.duration,
                    thumbnail: videoInfo.thumbnail,
                    requester: interaction.user
                });
            }

            // Play if not already playing
            if (!this.isPlaying.get(guildId)) {
                await this.playNext(guildId);
            }

            await this.saveMusicState(guildId);
            await this.updateMusicWidget(interaction.guild);

            const successMessage = repeat > 1
                ? `✅ Added **${videoInfo.title}** to queue (${repeat} times)`
                : `✅ Added to queue: **${videoInfo.title}**`;

            await interaction.editReply({ content: successMessage });

        } catch (error) {
            console.error('Error in music request:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Music Request Failed')
                .setDescription('An error occurred while processing your music request.')
                .addFields(
                    { name: '🔧 Error Details', value: error.message || 'Unknown error', inline: false },
                    { name: '💡 Troubleshooting', value: '• Check your internet connection\n• Try a simpler search term\n• Wait a moment and try again', inline: false }
                )
                .setTimestamp();

            try {
                await interaction.editReply({ embeds: [errorEmbed] });
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError);
                // Last resort - try to send a simple message
                try {
                    await interaction.followUp({ content: `❌ Music request failed: ${error.message}`, ephemeral: true });
                } catch (finalError) {
                    console.error('All reply attempts failed:', finalError);
                }
            }
        }
    }
}

module.exports = MusicManager;
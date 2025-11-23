const { EmbedBuilder } = require('discord.js');

class UtilityCommands {
    constructor(client) {
        this.client = client;
        this.afkUsers = new Map(); // userId -> { message, startTime, duration }
        const AcknowledgementService = require('./acknowledgementService');
        this.ackService = new AcknowledgementService();
    }

    async handleCommand(message, command, args) {
        try {
            switch(command) {
                case 'ping':
                    return this.handlePing(message);
                case 'dev':
                    return this.handleDev(message);
                case 'ui':
                case 'userinfo':
                    return this.handleUserInfo(message, args);
                case 'dm':
                    return this.handleDM(message, args);
                case 'fck':
                    return this.handleFck(message);
                case 'avatar':
                    return this.handleAvatar(message, args);
                case 'serverlogo':
                    return this.handleServerLogo(message);
                case 'banner':
                    return this.handleBannerText(message, args);
                case 'roleinfo':
                    return this.handleRoleInfo(message, args);
                case 'rename':
                    return this.handleRename(message, args);
                case 'srvpasuse':
                    return this.handleServerPause(message);
                case 'si':
                case 'serverinfo':
                    return this.handleServerInfoText(message);
                case 'rolecolor':
                    return this.handleRoleColorText(message, args);
                case 'membercount':
                    return this.handleMemberCountText(message);
                case 'botstats':
                    return this.handleBotStatsText(message);
                case 'invite':
                    return this.handleInviteText(message);
                case 'uptime':
                    return this.handleUptimeText(message);
                case 'emojis':
                    return this.handleEmojisText(message);
                case 'stickers':
                    return this.handleStickersText(message);
                case 'boosters':
                    return this.handleBoostersText(message);
                case 'afk':
                    return this.handleAFK(message, args);
                default:
                    return false;
            }
        } catch (error) {
            console.error(`Error in utility command ${command}:`, error);
            await message.reply(`❌ Error executing command: ${error.message}`);
            return true;
        }
    }

    async handlePing(message) {
        const botLatency = Date.now() - message.createdTimestamp;
        const apiLatency = Math.round(this.client.ws.ping);
        const status = botLatency < 200 ? '✅ Excellent' : botLatency < 500 ? '🟡 Good' : '🔴 Poor';

        await this.ackService.send(
            message,
            `🏓 Pong!\n**Bot Latency:** ${botLatency}ms\n**API Latency:** ${apiLatency}ms\n**Status:** ${status}`,
            'ping'
        );
        return true;
    }

    async handleDev(message) {
        const devInfo = `✿ **Developer Information**\n\n` +
            `discord.gg/scriptspace was developed by made with love ᡣ𐭩 at scriptspace\n\n` +
            `**✿ Website:** https://scriptspace.in/\n\n` +
            `discord.gg/scriptspace is a highly engineered discord server with AI Integrations, NextGen Quarantine Systems, NextGen Interim Role Management Systems And Temporary Voice Channel management systems everything was made possible by script.agi\n\n` +
            `**ᯓᡣ𐭩 Technical Features**\n` +
            `ᡣ𐭩 God-Level Protection System\n` +
            `ᡣ𐭩 AI-Powered Integrations\n` +
            `ᡣ𐭩 NextGen Quarantine Management\n` +
            `ᡣ𐭩 Advanced Interim Role System\n` +
            `ᡣ𐭩 Voice Channel Management\n` +
            `ᡣ𐭩 Real-time Security Monitoring\n\n` +
            `**✿ Built with Script.AGI Technology**`;

        await this.ackService.send(message, devInfo);
        return true;
    }

    async handleUserInfo(message, args) {
        const user = message.mentions.users.first() || message.author;
        const member = message.guild.members.cache.get(user.id);

        if (!member) {
            await message.reply('❌ User not found in this server.');
            return true;
        }

        const roles = member.roles.cache
            .filter(role => role.id !== message.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, 10);

        let userInfoText = `👤 **User Information: ${user.username}**\n\n` +
            `**🆔 User ID:** \`${user.id}\`\n` +
            `**📅 Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n` +
            `**📥 Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n` +
            `**🤖 Bot:** ${user.bot ? 'Yes' : 'No'}\n` +
            `**👑 Server Owner:** ${message.guild.ownerId === user.id ? 'Yes' : 'No'}`;

        if (roles.length > 0) {
            userInfoText += `\n**🎭 Roles:** ${roles.join(', ')}${member.roles.cache.size > 11 ? ` +${member.roles.cache.size - 11} more` : ''}`;
        } else {
            userInfoText += `\n**🎭 Roles:** No roles`;
        }

        await this.ackService.send(message, userInfoText);
        return true;
    }

    async handleDM(message, args) {
        const user = message.mentions.users.first();
        if (!user) {
            await message.reply('❌ Please mention a user to send a DM.');
            return true;
        }

        const dmMessage = args.slice(1).join(' ');
        if (!dmMessage) {
            await message.reply('❌ Please provide a message to send.');
            return true;
        }

        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('📧 Direct Message from Server Staff')
                .setDescription(dmMessage)
                .addFields(
                    { name: '🏠 Server', value: message.guild.name, inline: true },
                    { name: '👤 From', value: message.author.username, inline: true }
                )
                .setFooter({ text: 'This is an official message from server staff' })
                .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
            await message.reply(`✅ DM sent successfully to ${user.username}`);
        } catch (error) {
            await message.reply('❌ Could not send DM. User may have DMs disabled.');
        }
        return true;
    }

    async handleFck(message) {
        const fckEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚨 FUCK YOU MOTHERFUCKER')
            .setDescription(`Fuck You MotherFucker, don't even think about nuking discord.gg/scriptspace even in your dream you will be brutally fucked by script.agi`)
            .setImage('https://cdn.discordapp.com/attachments/1377710452653424711/1411748251920765018/have-a-nice-day-fuck-you.gif')
            .setFooter({ text: 'Script.AGI Maximum Security System' })
            .setTimestamp();

        await message.reply({ embeds: [fckEmbed] });
        return true;
    }

    async handleAvatar(message, args) {
        const user = message.mentions.users.first() || message.author;

        const avatarText = `🖼️ **${user.username}'s Avatar**\n\n` +
            `**Avatar URL:** ${user.displayAvatarURL({ dynamic: true, size: 1024 })}\n\n` +
            `**🔗 Download Links:**\n` +
            `[PNG](${user.displayAvatarURL({ extension: 'png', size: 1024 })}) | [JPG](${user.displayAvatarURL({ extension: 'jpg', size: 1024 })}) | [WEBP](${user.displayAvatarURL({ extension: 'webp', size: 1024 })})`;

        await this.ackService.send(message, avatarText);
        return true;
    }

    async handleServerLogo(message) {
        const guild = message.guild;

        if (!guild.iconURL()) {
            await message.reply('❌ This server has no icon set.');
            return true;
        }

        const logoText = `🏰 **${guild.name}'s Server Logo**\n\n` +
            `**Logo URL:** ${guild.iconURL({ dynamic: true, size: 1024 })}\n\n` +
            `**🔗 Download Links:**\n` +
            `[PNG](${guild.iconURL({ extension: 'png', size: 1024 })}) | [JPG](${guild.iconURL({ extension: 'jpg', size: 1024 })}) | [WEBP](${guild.iconURL({ extension: 'webp', size: 1024 })})`;

        await this.ackService.send(message, logoText);
        return true;
    }

    async handleRoleInfo(message, args) {
        const user = message.mentions.users.first() || message.author;
        const member = message.guild.members.cache.get(user.id);

        if (!member) {
            await message.reply('❌ User not found in this server.');
            return true;
        }

        const roles = member.roles.cache
            .filter(role => role.id !== message.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, 20);

        let roleInfoText = `🎭 **Role Information: ${user.username}**\n\n` +
            `**👤 User:** ${user.username} (\`${user.id}\`)\n` +
            `**🎨 Display Color:** ${member.displayHexColor || 'Default'}\n` +
            `**📊 Total Roles:** ${member.roles.cache.size - 1}\n` +
            `**🎭 Highest Role:** ${member.roles.highest.name}\n` +
            `**📍 Position:** ${member.roles.highest.position}\n` +
            `**🔹 Hoisted:** ${member.roles.highest.hoist ? 'Yes' : 'No'}`;

        if (roles.length > 0) {
            roleInfoText += `\n\n**🎭 Roles (${member.roles.cache.size - 1}):**\n${roles.join(', ')}${member.roles.cache.size - 1 > 20 ? `\n... and ${member.roles.cache.size - 21} more` : ''}`;
        }

        await this.ackService.send(message, roleInfoText);
        return true;
    }

    async handleRename(message, args) {
        const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '1327564898460242015';
        const isAuthorized = message.author.id === BOT_OWNER_ID || 
                            message.author.id === message.guild.ownerId ||
                            message.member.permissions.has('ManageNicknames');

        if (!isAuthorized) {
            await message.reply('❌ You need Manage Nicknames permission to use this command.');
            return true;
        }

        const user = message.mentions.users.first();
        if (!user) {
            await message.reply('❌ Please mention a user to rename. Usage: `rename @user "new name"`');
            return true;
        }

        const member = message.guild.members.cache.get(user.id);
        if (!member) {
            await message.reply('❌ User not found in this server.');
            return true;
        }

        // Extract nickname from quotes
        const nicknameMatch = message.content.match(/"([^"]+)"/);
        if (!nicknameMatch) {
            await message.reply('❌ Please provide a nickname in quotes. Usage: `rename @user "new name"`');
            return true;
        }

        const newNickname = nicknameMatch[1];

        if (newNickname.length > 32) {
            await message.reply('❌ Nickname must be 32 characters or less.');
            return true;
        }

        try {
            const oldNickname = member.nickname || member.user.username;
            await member.setNickname(newNickname, `Renamed by ${message.author.username}`);

            const renameEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✏️ User Renamed')
                .setDescription(`Successfully renamed user`)
                .addFields(
                    { name: '👤 User', value: `${user.username}`, inline: true },
                    { name: '📝 Old Name', value: oldNickname, inline: true },
                    { name: '📝 New Name', value: newNickname, inline: true },
                    { name: '👮 Renamed By', value: message.author.username, inline: true }
                )
                .setFooter({ text: 'User Management System' })
                .setTimestamp();

            await message.reply({ embeds: [renameEmbed] });

            // Send to logs
            const LOGS_CHANNEL_ID = '1410019894568681617';
            const logsChannel = message.guild.channels.cache.get(LOGS_CHANNEL_ID);
            if (logsChannel) {
                await logsChannel.send({ embeds: [renameEmbed] });
            }

        } catch (error) {
            console.error('Error renaming user:', error);
            await message.reply('❌ Failed to rename user. Make sure I have the Manage Nicknames permission and the user\'s highest role is below mine.');
        }

        return true;
    }

    async handleServerPause(message) {
        const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '1327564898460242015';
        const isAuthorized = message.author.id === BOT_OWNER_ID || 
                            message.author.id === message.guild.ownerId;

        if (!isAuthorized) {
            await message.reply('❌ Only the server owner or bot owner can use this command.');
            return true;
        }

        try {
            const guild = message.guild;
            const currentInvites = await guild.invites.fetch();

            // Check current server settings
            const currentSettings = {
                invitesDisabled: guild.features.includes('INVITES_DISABLED'),
                verificationLevel: guild.verificationLevel
            };

            // Toggle invite pause
            if (currentInvites.size > 0 && !currentSettings.invitesDisabled) {
                // Pause invites by deleting all existing invites
                let deletedCount = 0;
                for (const invite of currentInvites.values()) {
                    try {
                        await invite.delete(`Server invites paused by ${message.author.username}`);
                        deletedCount++;
                    } catch (err) {
                        console.error('Error deleting invite:', err);
                    }
                }

                const pauseEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⏸️ Server Invites Paused')
                    .setDescription(`Server invites have been paused`)
                    .addFields(
                        { name: '🔗 Invites Deleted', value: `${deletedCount}`, inline: true },
                        { name: '👮 Paused By', value: message.author.username, inline: true },
                        { name: '⏰ Paused At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                        { name: '📊 Status', value: '🔴 **INVITES DISABLED**', inline: false }
                    )
                    .setFooter({ text: 'Server Management System' })
                    .setTimestamp();

                await message.reply({ embeds: [pauseEmbed] });

                // Send to logs
                const LOGS_CHANNEL_ID = '1410019894568681617';
                const logsChannel = message.guild.channels.cache.get(LOGS_CHANNEL_ID);
                if (logsChannel) {
                    await logsChannel.send({ embeds: [pauseEmbed] });
                }
            } else {
                // Inform that invites are already paused or there are no active invites
                await message.reply('ℹ️ Server invites are already paused or there are no active invites to delete.');
            }

        } catch (error) {
            console.error('Error pausing server invites:', error);
            await message.reply('❌ Failed to pause server invites. Make sure I have the Manage Server permission.');
        }

        return true;
    }

    // Text command handlers for new commands
    async handleServerInfoText(message) {
        const guild = message.guild;
        await guild.members.fetch();

        const members = guild.members.cache;
        const humans = members.filter(m => !m.user.bot);
        const bots = members.filter(m => m.user.bot);
        const online = members.filter(m => m.presence?.status === 'online');
        const idle = members.filter(m => m.presence?.status === 'idle');
        const dnd = members.filter(m => m.presence?.status === 'dnd');
        const offline = members.filter(m => !m.presence || m.presence.status === 'offline');
        const admins = members.filter(m => m.permissions.has('Administrator'));
        const boosters = members.filter(m => m.premiumSince);

        const channels = guild.channels.cache;
        const textChannels = channels.filter(c => c.type === 0);
        const voiceChannels = channels.filter(c => c.type === 2);
        const categories = channels.filter(c => c.type === 4);

        const verificationLevels = {
            0: 'None',
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Very High'
        };

        const mfaLevels = {
            0: 'Disabled',
            1: 'Enabled'
        };

        const serverInfoEmbed = new EmbedBuilder()
            .setColor('#C8A2C8')
            .setAuthor({
                name: 'Quarantianizo made at discord.gg/scriptspace by script.agi',
                iconURL: 'https://cdn.discordapp.com/attachments/1438520973300338871/1439364441492816163/InShot_20251115_124839476.jpg?ex=691a4018&is=6918ee98&hm=66e891ba77134ca48725774137a29bd0aec7ea1442a7840125442f050ace00dc&'
            })
            .setTitle(`✗ 𖹭 **Server Information - ${guild.name}**`)
            .setThumbnail(this.client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(
                `**❥ Server Overview**\n` +
                `• **Name:** ${guild.name}\n` +
                `• **ID:** \`${guild.id}\`\n` +
                `• **Owner:** <@${guild.ownerId}>\n` +
                `• **Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n\n` +

                `**❥ Member Statistics**\n` +
                `• **Total Members:** \`${guild.memberCount}\`\n` +
                `• **Humans:** \`${humans.size}\` • **Bots:** \`${bots.size}\`\n` +
                `• **Online:** \`${online.size}\` • **Idle:** \`${idle.size}\` • **DND:** \`${dnd.size}\` • **Offline:** \`${offline.size}\`\n` +
                `• **Admins:** \`${admins.size}\` • **Boosters:** \`${boosters.size}\`\n\n` +

                `**❥ Channel Statistics**\n` +
                `• **Total Channels:** \`${channels.size}\`\n` +
                `• **Text Channels:** \`${textChannels.size}\` • **Voice Channels:** \`${voiceChannels.size}\`\n` +
                `• **Categories:** \`${categories.size}\`\n\n` +

                `**❥ Server Features**\n` +
                `• **Roles:** \`${guild.roles.cache.size}\` • **Emojis:** \`${guild.emojis.cache.size}\` • **Stickers:** \`${guild.stickers.cache.size}\`\n` +
                `• **Boost Level:** \`Level ${guild.premiumTier}\` • **Boosts:** \`${guild.premiumSubscriptionCount || 0}\`\n\n` +

                `**❥ Security & Verification**\n` +
                `• **Verification Level:** ${verificationLevels[guild.verificationLevel] || 'Unknown'}\n` +
                `• **2FA Requirement:** ${mfaLevels[guild.mfaLevel] || 'Unknown'}\n` +
                `• **Security Status:** ${guild.verificationLevel >= 3 ? 'High Security' : guild.verificationLevel >= 2 ? 'Medium Security' : 'Low Security'}`
            )
            .setImage('https://cdn.discordapp.com/attachments/1438520973300338871/1439364441492816163/InShot_20251115_124839476.jpg?ex=691a4018&is=6918ee98&hm=66e891ba77134ca48725774137a29bd0aec7ea1442a7840125442f050ace00dc&')
            .setFooter({ 
                text: `Server Information System • Created ${new Date(guild.createdTimestamp).toLocaleDateString()}`, 
                iconURL: 'https://cdn.discordapp.com/attachments/1438520973300338871/1439364441492816163/InShot_20251115_124839476.jpg?ex=691a4018&is=6918ee98&hm=66e891ba77134ca48725774137a29bd0aec7ea1442a7840125442f050ace00dc&' 
            })
            .setTimestamp();

        await message.reply({ embeds: [serverInfoEmbed] });
        return true;
    }

    async handleBannerText(message, args) {
        const user = message.mentions.users.first() || message.author;
        const fetchedUser = await user.fetch(true);

        if (!fetchedUser.bannerURL()) {
            await message.reply('❌ This user has no banner set');
            return true;
        }

        const bannerText = `🎨 **${user.username}'s Banner**\n\n` +
            `**Banner URL:** ${fetchedUser.bannerURL({ size: 1024 })}\n\n` +
            `**🔗 Download Links:**\n` +
            `[PNG](${fetchedUser.bannerURL({ extension: 'png', size: 1024 })}) | [JPG](${fetchedUser.bannerURL({ extension: 'jpg', size: 1024 })}) | [WEBP](${fetchedUser.bannerURL({ extension: 'webp', size: 1024 })})`;

        await this.ackService.send(message, bannerText);
        return true;
    }

    async handleRoleColorText(message, args) {
        const role = message.mentions.roles.first();

        if (!role) {
            await message.reply('❌ Please mention a role to check its color. Usage: `!rolecolor @role`');
            return true;
        }

        const roleColorText = `🎨 **${role.name} Color**\n\n` +
            `**🔢 Hex:** ${role.hexColor}\n` +
            `**🔢 RGB:** ${(role.color >> 16) & 255}, ${(role.color >> 8) & 255}, ${role.color & 255}\n` +
            `**🔢 Integer:** ${role.color}\n` +
            `**👥 Members:** ${role.members.size}\n` +
            `**📊 Position:** ${role.position}\n` +
            `**🔹 Hoisted:** ${role.hoist ? 'Yes' : 'No'}`;

        await this.ackService.send(message, roleColorText);
        return true;
    }

    async handleMemberCountText(message) {
        const guild = message.guild;
        await guild.members.fetch();

        const total = guild.memberCount;
        const humans = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const online = guild.members.cache.filter(m => m.presence?.status === 'online').size;
        const idle = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
        const dnd = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;

        const memberCountText = `📊 **Member Statistics**\n\n` +
            `**👥 Total Members:** ${total}\n` +
            `**👤 Humans:** ${humans}\n` +
            `**🤖 Bots:** ${bots}\n` +
            `**🟢 Online:** ${online}\n` +
            `**🟡 Idle:** ${idle}\n` +
            `**🔴 DND:** ${dnd}`;

        await this.ackService.send(message, memberCountText);
        return true;
    }

    async handleBotStatsText(message) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const botStatsText = `🤖 **Bot Statistics**\n\n` +
            `**⏰ Uptime:** ${days}d ${hours}h ${minutes}m\n` +
            `**📡 Ping:** ${Math.round(this.client.ws.ping)}ms\n` +
            `**🏰 Servers:** ${this.client.guilds.cache.size}\n` +
            `**👥 Users:** ${this.client.users.cache.size}\n` +
            `**💬 Channels:** ${this.client.channels.cache.size}\n` +
            `**💾 Memory:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n\n` +
            `Made with ❤️ at ScriptSpace`;

        await this.ackService.send(message, botStatsText);
        return true;
    }

    async handleInviteText(message) {
        const invite = `https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=8&scope=bot%20applications.commands`;

        const inviteText = `🔗 **Invite Bot**\n\n` +
            `[Click here to invite ${this.client.user.username}](${invite})\n\n` +
            `**🔑 Permissions:** Administrator\n` +
            `**📊 Currently in:** ${this.client.guilds.cache.size} servers`;

        await this.ackService.send(message, inviteText);
        return true;
    }

    async handleUptimeText(message) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const uptimeText = `⏰ **Bot Uptime**\n\n` +
            `**Duration:** ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds\n` +
            `**📅 Started:** <t:${Math.floor((Date.now() - uptime * 1000) / 1000)}:F>`;

        await this.ackService.send(message, uptimeText);
        return true;
    }

    async handleEmojisText(message) {
        const emojis = message.guild.emojis.cache;

        if (emojis.size === 0) {
            await message.reply('❌ No custom emojis in this server');
            return true;
        }

        const emojiList = emojis.map(e => `${e} \`:${e.name}:\``).join('\n');

        const emojisText = `🎨 **Server Emojis (${emojis.size})**\n\n${emojiList.substring(0, 1900)}`;

        await this.ackService.send(message, emojisText);
        return true;
    }

    async handleStickersText(message) {
        const stickers = message.guild.stickers.cache;

        if (stickers.size === 0) {
            await message.reply('❌ No custom stickers in this server');
            return true;
        }

        const stickerList = stickers.map(s => `**${s.name}** - ${s.description || 'No description'}`).join('\n');

        const stickersText = `🎪 **Server Stickers (${stickers.size})**\n\n${stickerList.substring(0, 1900)}`;

        await this.ackService.send(message, stickersText);
        return true;
    }

    async handleBoostersText(message) {
        const boosters = message.guild.members.cache.filter(m => m.premiumSince);

        if (boosters.size === 0) {
            await message.reply('❌ No server boosters');
            return true;
        }

        const boosterList = boosters.map(m => `${m.user.username} - Boosting since <t:${Math.floor(m.premiumSince.getTime() / 1000)}:R>`).join('\n');

        const boostersText = `💎 **Server Boosters (${boosters.size})**\n\n` +
            `${boosterList.substring(0, 1800)}\n\n` +
            `**🚀 Boost Level:** Level ${message.guild.premiumTier}\n` +
            `**💫 Total Boosts:** ${message.guild.premiumSubscriptionCount || 0}`;

        await this.ackService.send(message, boostersText);
        return true;
    }

    async handleAFK(message, args) {
        const user = message.mentions.users.first();

        if (!user) {
            await message.reply('❌ Usage: `afk @user <duration_minutes> <message>`\nExample: `afk @user 30 Going to lunch`');
            return true;
        }

        if (args.length < 3) {
            await message.reply('❌ Please provide duration in minutes and AFK message.\nExample: `afk @user 30 Going to lunch`');
            return true;
        }

        const duration = parseInt(args[1]);
        if (isNaN(duration) || duration < 1) {
            await message.reply('❌ Please provide a valid duration in minutes (minimum 1 minute).');
            return true;
        }

        const afkMessage = args.slice(2).join(' ');
        const startTime = Date.now();
        const endTime = startTime + (duration * 60 * 1000);

        this.afkUsers.set(user.id, {
            message: afkMessage,
            startTime,
            duration,
            guildId: message.guild.id
        });

        const afkEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('💤 User is Now AFK')
            .setDescription(`${user.username} is now AFK`)
            .addFields(
                { name: '👤 User', value: user.toString(), inline: true },
                { name: '⏰ Duration', value: `${duration} minute(s)`, inline: true },
                { name: '📝 Message', value: afkMessage, inline: false },
                { name: '🕒 Returns At', value: `<t:${Math.floor(endTime / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: 'AFK System - Auto-welcome on return' })
            .setTimestamp();

        await message.reply({ embeds: [afkEmbed] });

        // Set timeout to welcome back
        setTimeout(async () => {
            const afkData = this.afkUsers.get(user.id);
            if (afkData) {
                this.afkUsers.delete(user.id);

                try {
                    const guild = this.client.guilds.cache.get(afkData.guildId);
                    if (guild) {
                        const welcomeEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('👋 Welcome Back!')
                            .setDescription(`${user.username} is back from AFK`)
                            .addFields(
                                { name: '👤 User', value: user.toString(), inline: true },
                                { name: '⏰ AFK Duration', value: `${duration} minute(s)`, inline: true },
                                { name: '📝 Previous Status', value: afkMessage, inline: false }
                            )
                            .setFooter({ text: 'AFK System' })
                            .setTimestamp();

                        await message.channel.send({ embeds: [welcomeEmbed] });

                        // Try to DM the user
                        try {
                            await user.send({ embeds: [welcomeEmbed] });
                        } catch (dmError) {
                            console.log('Could not DM user about AFK return');
                        }
                    }
                } catch (error) {
                    console.error('Error welcoming back AFK user:', error);
                }
            }
        }, duration * 60 * 1000);

        return true;
    }

    checkAFK(message) {
        // Check if mentioned users are AFK
        message.mentions.users.forEach(user => {
            const afkData = this.afkUsers.get(user.id);
            if (afkData) {
                const timeLeft = Math.ceil((afkData.startTime + (afkData.duration * 60 * 1000) - Date.now()) / 60000);
                message.reply(`💤 ${user.username} is currently AFK: ${afkData.message}\nReturns in approximately ${timeLeft} minute(s)`).catch(() => {});
            }
        });
    }

    async handleSlashCommand(interaction) {
        const { commandName } = interaction;

        try {
            switch(commandName) {
                case 'serverinfo':
                    return await this.serverInfoSlash(interaction);
                case 'avatar':
                    return await this.avatarSlash(interaction);
                case 'banner':
                    return await this.bannerSlash(interaction);
                case 'rolecolor':
                    return await this.roleColorSlash(interaction);
                case 'membercount':
                    return await this.memberCountSlash(interaction);
                case 'botstats':
                    return await this.botStatsSlash(interaction);
                case 'invite':
                    return await this.inviteSlash(interaction);
                case 'uptime':
                    return await this.uptimeSlash(interaction);
                case 'emojis':
                    return await this.emojisSlash(interaction);
                case 'stickers':
                    return await this.stickersSlash(interaction);
                case 'boosters':
                    return await this.boostersSlash(interaction);
                default:
                    return false;
            }
        } catch (error) {
            console.error('Error in utility slash command:', error);
            const reply = { content: '❌ Error: ' + error.message, ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    async serverInfoSlash(interaction) {
        const guild = interaction.guild;
        await guild.members.fetch();

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
                { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '🎨 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
                { name: '🎪 Stickers', value: `${guild.stickers.cache.size}`, inline: true },
                { name: '💎 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
                { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
                { name: '🔒 Verification', value: guild.verificationLevel.toString(), inline: true }
            )
            .setTimestamp();

        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 }));
        }

        await interaction.reply({ embeds: [embed] });
    }

    async avatarSlash(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;

        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`🖼️ ${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .addFields(
                { name: '🔗 Links', value: `[PNG](${user.displayAvatarURL({ extension: 'png', size: 1024 })}) | [JPG](${user.displayAvatarURL({ extension: 'jpg', size: 1024 })}) | [WEBP](${user.displayAvatarURL({ extension: 'webp', size: 1024 })})`, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async bannerSlash(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const fetchedUser = await user.fetch(true);

        if (!fetchedUser.bannerURL()) {
            return await interaction.reply({ content: '❌ This user has no banner set', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(fetchedUser.accentColor || '#0099FF')
            .setTitle(`🎨 ${user.username}'s Banner`)
            .setImage(fetchedUser.bannerURL({ size: 1024 }))
            .addFields(
                { name: '🔗 Links', value: `[PNG](${fetchedUser.bannerURL({ extension: 'png', size: 1024 })}) | [JPG](${fetchedUser.bannerURL({ extension: 'jpg', size: 1024 })}) | [WEBP](${fetchedUser.bannerURL({ extension: 'webp', size: 1024 })})`, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async roleColorSlash(interaction) {
        const role = interaction.options.getRole('role');

        const embed = new EmbedBuilder()
            .setColor(role.color || '#000000')
            .setTitle(`🎨 ${role.name} Color`)
            .addFields(
                { name: '🔢 Hex', value: role.hexColor, inline: true },
                { name: '🔢 RGB', value: `${(role.color >> 16) & 255}, ${(role.color >> 8) & 255}, ${role.color & 255}`, inline: true },
                { name: '🔢 Integer', value: `${role.color}`, inline: true },
                { name: '👥 Members', value: `${role.members.size}`, inline: true },
                { name: '📊 Position', value: `${role.position}`, inline: true },
                { name: '🔹 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async memberCountSlash(interaction) {
        const guild = interaction.guild;
        await guild.members.fetch();

        const total = guild.memberCount;
        const humans = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const online = guild.members.cache.filter(m => m.presence?.status === 'online').size;
        const idle = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
        const dnd = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setTitle('📊 Member Statistics')
            .addFields(
                { name: '👥 Total Members', value: `${total}`, inline: true },
                { name: '👤 Humans', value: `${humans}`, inline: true },
                { name: '🤖 Bots', value: `${bots}`, inline: true },
                { name: '🟢 Online', value: `${online}`, inline: true },
                { name: '🟡 Idle', value: `${idle}`, inline: true },
                { name: '🔴 DND', value: `${dnd}`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async botStatsSlash(interaction) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setTitle('🤖 Bot Statistics')
            .setThumbnail(this.client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⏰ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
                { name: '📡 Ping', value: `${Math.round(this.client.ws.ping)}ms`, inline: true },
                { name: '🏰 Servers', value: `${this.client.guilds.cache.size}`, inline: true },
                { name: '👥 Users', value: `${this.client.users.cache.size}`, inline: true },
                { name: '💬 Channels', value: `${this.client.channels.cache.size}`, inline: true },
                { name: '💾 Memory', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true }
            )
            .setFooter({ text: 'Made with ❤️ at ScriptSpace' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async inviteSlash(interaction) {
        const invite = `https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=8&scope=bot%20applications.commands`;

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setTitle('🔗 Invite Bot')
            .setDescription(`[Click here to invite ${this.client.user.username}](${invite})`)
            .addFields(
                { name: '🔑 Permissions', value: 'Administrator', inline: true },
                { name: '📊 Servers', value: `${this.client.guilds.cache.size}`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async uptimeSlash(interaction) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setTitle('⏰ Bot Uptime')
            .setDescription(`**${days}** days, **${hours}** hours, **${minutes}** minutes, **${seconds}** seconds`)
            .addFields(
                { name: '📅 Started', value: `<t:${Math.floor((Date.now() - uptime * 1000) / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async emojisSlash(interaction) {
        const emojis = interaction.guild.emojis.cache;

        if (emojis.size === 0) {
            return await interaction.reply({ content: '❌ No custom emojis in this server', ephemeral: true });
        }

        const emojiList = emojis.map(e => `${e} \`:${e.name}:\``).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setTitle(`🎨 Server Emojis (${emojis.size})`)
            .setDescription(emojiList.substring(0, 4096))
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async stickersSlash(interaction) {
        const stickers = interaction.guild.stickers.cache;

        if (stickers.size === 0) {
            return await interaction.reply({ content: '❌ No custom stickers in this server', ephemeral: true });
        }

        const stickerList = stickers.map(s => `**${s.name}** - ${s.description || 'No description'}`).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setTitle(`🎪 Server Stickers (${stickers.size})`)
            .setDescription(stickerList.substring(0, 4096))
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async boostersSlash(interaction) {
        const boosters = interaction.guild.members.cache.filter(m => m.premiumSince);

        if (boosters.size === 0) {
            return await interaction.reply({ content: '❌ No server boosters', ephemeral: true });
        }

        const boosterList = boosters.map(m => `${m.user.username} - Boosting since <t:${Math.floor(m.premiumSince.getTime() / 1000)}:R>`).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#8A00C4')
            .setTitle(`💎 Server Boosters (${boosters.size})`)
            .setDescription(boosterList.substring(0, 4096))
            .addFields(
                { name: '🚀 Boost Level', value: `Level ${interaction.guild.premiumTier}`, inline: true },
                { name: '💫 Total Boosts', value: `${interaction.guild.premiumSubscriptionCount || 0}`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = UtilityCommands;
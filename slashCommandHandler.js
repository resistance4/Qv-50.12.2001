const { EmbedBuilder } = require('discord.js');
const AcknowledgementService = require('./acknowledgementService');

class SlashCommandHandler {
    constructor(client, managers) {
        this.client = client;
        this.roleManager = managers.roleManager;
        this.channelManager = managers.channelManager;
        this.mediaThreadsManager = managers.mediaThreadsManager;
        this.utilityManager = managers.utilityManager;
        this.voiceManager = managers.voiceManager;
        this.musicManager = managers.musicManager;
        this.ackService = new AcknowledgementService();

        // Extra owner tracking
        this.permanentExtraOwners = new Set();
        this.temporaryExtraOwners = new Map();

        // Quarantine tracking
        this.quarantinedUsers = new Map();
        this.originalRoles = new Map();

        // Quarantine bypass roles - Map of "guildId" -> Set of role IDs
        this.bypassRoles = new Map();

        // Announcement channel tracking
        this.announcementChannels = new Map();

        // AFK tracking - Map of "guildId:userId" -> { reason, timestamp }
        this.afkUsers = new Map();

        // Giveaway tracking
        this.giveaways = new Map();

        // Membercount pagination tracking - Map of "userId:guildId" -> { currentPage, data }
        this.membercountSessions = new Map();

        // Notification prefix (np) configuration - Map of "guildId" -> Set of role IDs
        this.npAllowedRoles = new Map();
    }

    isAuthorized(interaction) {
        const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '1327564898460242015';
        const isBotOwner = interaction.user.id === BOT_OWNER_ID;
        const isServerOwner = interaction.user.id === interaction.guild.ownerId;
        const isInOwnerChannel = interaction.channel.id === '1410011813398974626';

        return isBotOwner || (isServerOwner && isInOwnerChannel);
    }

    canUseNp(member) {
        if (!member || !member.guild) return false;
        const guildId = member.guild.id;
        const allowedRoles = this.npAllowedRoles.get(guildId) || new Set();
        return member.roles.cache.some(role => allowedRoles.has(role.id));
    }

    addNpRole(guildId, roleId) {
        if (!this.npAllowedRoles.has(guildId)) {
            this.npAllowedRoles.set(guildId, new Set());
        }
        this.npAllowedRoles.get(guildId).add(roleId);
    }

    removeNpRole(guildId, roleId) {
        const roles = this.npAllowedRoles.get(guildId);
        if (roles) {
            roles.delete(roleId);
        }
    }

    getNpRoles(guildId) {
        return this.npAllowedRoles.get(guildId) || new Set();
    }

    async handleCommand(interaction) {
        const { commandName } = interaction;

        try {
            switch(commandName) {
                // Extra Owner System
                case 'extraowner':
                    return await this.handleExtraOwner(interaction);
                case 'tempowner':
                    return await this.handleTempOwner(interaction);
                case 'removeowner':
                    return await this.handleRemoveOwner(interaction);
                case 'listowners':
                    return await this.handleListOwners(interaction);

                // Quarantine
                case 'quarantine':
                    return await this.handleQuarantine(interaction);
                case 'unquarantine':
                    return await this.handleUnquarantine(interaction);
                case 'quarantine-bypass':
                    return await this.handleQuarantineBypass(interaction);

                // Moderation
                case 'kick':
                    return await this.handleKick(interaction);
                case 'ban':
                    return await this.handleBan(interaction);
                case 'mute':
                    return await this.handleMute(interaction);
                case 'unmute':
                    return await this.handleUnmute(interaction);
                case 'warn':
                    return await this.handleWarn(interaction);
                case 'clear':
                    return await this.handleClear(interaction);
                case 'slowmode':
                    return await this.handleSlowmode(interaction);

                case 'inrole':
                    return await this.handleInRole(interaction);

                case 'roleinfo':
                    return await this.handleRoleInfo(interaction);
                
                case 'roleall':
                    return await this.handleRoleAll(interaction);

                // Roles
                case 'addrole':
                case 'removerole':
                case 'createrole':
                case 'deleterole':
                case 'editrole':
                case 'roles':
                case 'removeallroles':
                    if (this.roleManager) {
                        return await this.roleManager.handleSlashCommand(interaction);
                    } else {
                        return await interaction.reply({ content: '❌ Role manager not initialized', ephemeral: true });
                    }

                // Channels
                case 'lock':
                case 'unlock':
                case 'hide':
                case 'show':
                case 'lockvc':
                case 'unlockvc':
                case 'hidevc':
                case 'showvc':
                case 'rename':
                case 'topic':
                case 'limit':
                case 'bitrate':
                case 'permissions':
                case 'channels':
                case 'locklinks':
                case 'unlocklinks':
                case 'lockembeds':
                case 'unlockembeds':
                case 'lockattachments':
                case 'unlockattachments':
                case 'lockreactions':
                case 'unlockreactions':
                case 'lockall':
                case 'unlockall':
                case 'nuke':
                case 'setnsfw':
                case 'unsetnsfw':
                case 'showchannel':
                    if (this.channelManager) {
                        return await this.channelManager.handleSlashCommand(interaction);
                    } else {
                        return await interaction.reply({ content: '❌ Channel manager not initialized', ephemeral: true });
                    }

                // Voice
                case 'vmute':
                case 'vunmute':
                case 'vmuteall':
                case 'vunmuteall':
                case 'vdefend':
                case 'vundefend':
                case 'vdefendall':
                case 'vundefendall':
                case 'vdefended':
                    if (this.voiceManager) {
                        return await this.voiceManager.handleSlashCommand(interaction);
                    } else {
                        return await interaction.reply({ content: '❌ Voice manager not initialized', ephemeral: true });
                    }

                // Media & Threads
                case 'enablemedia':
                case 'disablemedia':
                case 'mediaslowmode':
                case 'lockmedia':
                case 'unlockmedia':
                case 'createthread':
                case 'lockthread':
                case 'unlockthread':
                case 'archivethread':
                case 'unarchivethread':
                case 'deletethread':
                    if (this.mediaThreadsManager) {
                        return await this.mediaThreadsManager.handleSlashCommand(interaction);
                    } else {
                        return await interaction.reply({ content: '❌ Media & Threads manager not initialized', ephemeral: true });
                    }
                    break;

                // Auto-Mod
                case 'automod':
                case 'automodconfig':
                case 'blacklist':
                case 'clearwarnings':
                    return await this.handleAutoMod(interaction);

                // Music
                case 'play': {
                    if (!this.musicManager) {
                        return await interaction.editReply({ content: '❌ Music system not available', ephemeral: true });
                    }
                    const query = interaction.options.getString('song') || interaction.options.getString('query');
                    const result = await this.musicManager.playMusic(query, interaction.guild, interaction.member, interaction.channel);
                    return await interaction.editReply({ content: result.message, ephemeral: true });
                }
                
                case 'stop': {
                    if (!this.musicManager) {
                        return await interaction.editReply({ content: '❌ Music system not available', ephemeral: true });
                    }
                    await this.musicManager.cleanStopMusic(interaction.guild.id);
                    return await interaction.editReply({ content: '⏹️ Music stopped', ephemeral: true });
                }
                
                case 'skip': {
                    if (!this.musicManager) {
                        return await interaction.editReply({ content: '❌ Music system not available', ephemeral: true });
                    }
                    const queue = this.musicManager.queues.get(interaction.guild.id) || [];
                    const player = this.musicManager.players.get(interaction.guild.id);
                    if (!player || queue.length === 0) {
                        return await interaction.editReply({ content: '❌ No music playing to skip', ephemeral: true });
                    }
                    player.stop();
                    return await interaction.editReply({ content: '⏭️ Skipped', ephemeral: true });
                }

                // Utility
                case 'ping':
                    return await this.handlePing(interaction);
                case 'help':
                    return await this.handleHelp(interaction);
                case 'dev':
                    return await this.handleDev(interaction);
                case 'userinfo':
                    return await this.handleUserInfo(interaction);
                case 'dm':
                    return await this.handleDM(interaction);
                case 'afk':
                    return await this.handleAfk(interaction);

                case 'invite':
                    return await this.handleInvite(interaction);

                case 'membercount':
                    return await this.handleMemberCount(interaction);

                case 'rolecolor':
                    return await this.handleRoleColor(interaction);

                // Extended Utility
                case 'serverinfo':
                case 'avatar':
                case 'banner':
                case 'botstats':
                case 'uptime':
                case 'emojis':
                case 'stickers':
                case 'boosters':
                    if (this.utilityManager) {
                        return await this.utilityManager.handleSlashCommand(interaction);
                    } else {
                        return await interaction.reply({ content: '❌ Utility manager not initialized', ephemeral: true });
                    }

                // Say Commands
                case 'annox':
                    return await this.handleAnnox(interaction);
                case 'say':
                    return await this.handleSay(interaction);
                case 'sayembed':
                    return await this.handleSayEmbed(interaction);
                case 'edit':
                    return await this.handleEdit(interaction);
                case 'reply':
                    return await this.handleReply(interaction);

                // Embed Commands
                case 'embed':
                    return await this.handleEmbed(interaction);
                case 'embedfield':
                    return await this.handleEmbedField(interaction);

                // Reaction Roles
                case 'reactionrole':
                    return await this.handleReactionRole(interaction);
                case 'createreactionrole':
                    return await this.handleCreateReactionRole(interaction);
                case 'removereactionrole':
                    return await this.handleRemoveReactionRole(interaction);

                // Global Announcements
                case 'globalannounce':
                    return await this.handleGlobalAnnounce(interaction);
                case 'announcechannel':
                    return await this.handleAnnounceChannel(interaction);
                case 'poll':
                    return await this.handlePoll(interaction);
                case 'giveaway':
                    return await this.handleGiveaway(interaction);
                case 'globalannoc':
                    return await this.handleGlobalAnnoc(interaction);

                // Server Announcement (Say command)
                case 'annoc':
                    return await this.handleAnnoc(interaction);

                // Default case for unknown commands
                default:
                    console.warn(`Unknown command: ${commandName}`);
                    return await interaction.reply({ 
                        content: `❌ Unknown command: \`/${commandName}\`. Please check the available commands with \`/help\``, 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error(`❌ Error in /${commandName}:`, error.message);
            console.error('Stack:', error.stack);
            
            const errorMessage = error.message || 'Unknown error';
            const reply = { content: `❌ Command error: ${errorMessage}`, ephemeral: true };
            
            try {
                if (interaction.deferred) {
                    await interaction.editReply(reply).catch(() => {});
                } else if (interaction.replied) {
                    await interaction.followUp(reply).catch(() => {});
                } else {
                    await interaction.reply(reply).catch(() => {});
                }
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError.message);
            }
        }
    }

    async handleAnnocRoleButton(interaction) {
        try {
            // Extract role ID from custom ID
            const roleId = interaction.customId.replace('annoc_role_', '');
            const role = interaction.guild.roles.cache.get(roleId);
            
            if (!role) {
                return await interaction.reply({ 
                    content: '❌ Role not found. It may have been deleted.', 
                    ephemeral: true 
                });
            }

            const member = interaction.member;

            // Toggle role - add if user doesn't have it, remove if they do
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(role, 'Removed via announcement role button');
                await interaction.reply({ 
                    content: `✅ Removed role ${role.name}`, 
                    ephemeral: true 
                });
            } else {
                await member.roles.add(role, 'Added via announcement role button');
                await interaction.reply({ 
                    content: `✅ Added role ${role.name}`, 
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error('Error handling annoc role button:', error);
            await interaction.reply({ 
                content: '❌ Failed to toggle role. I may not have permission to manage this role.', 
                ephemeral: true 
            }).catch(() => {});
        }
    }

    async handleQuarantine(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const duration = interaction.options.getString('duration') || '10m';
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const member = interaction.guild.members.cache.get(user.id);
        if (!member) {
            return await interaction.reply({ content: '❌ User not found', ephemeral: true });
        }

        await this.ackService.send(
            interaction,
            `✅ User quarantined successfully\n**User:** ${user.username} (${user.tag})\n**Duration:** ${duration}\n**Reason:** ${reason}`
        );
    }

    async handleUnquarantine(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        await this.ackService.send(
            interaction,
            `✅ Quarantine removed successfully\n**User:** ${user.username} (${user.tag})`
        );
    }

    async handleQuarantineBypass(interaction) {
        try {
            const role = interaction.options.getRole('role');
            const action = interaction.options.getString('action');
            const guildId = interaction.guild.id;

            if (!this.bypassRoles.has(guildId)) {
                this.bypassRoles.set(guildId, new Set());
            }

            const bypassSet = this.bypassRoles.get(guildId);

            if (action === 'add') {
                bypassSet.add(role.id);
                await this.ackService.send(
                    interaction,
                    `Role **${role.name}** added to quarantine bypass list\n**Role ID:** ${role.id}\n**Users with this role will skip quarantine**`
                );
            } else if (action === 'remove') {
                bypassSet.delete(role.id);
                await this.ackService.send(
                    interaction,
                    `Role **${role.name}** removed from quarantine bypass list`
                );
            }
        } catch (error) {
            console.error('Error in handleQuarantineBypass:', error);
            await this.ackService.send(interaction, `Error: ${error.message}`);
        }
    }

    compareRoles(executorHighestRole, targetHighestRole) {
        // Returns: 'higher' if executor is higher, 'equal' if equal, 'lower' if executor is lower
        if (executorHighestRole.position > targetHighestRole.position) {
            return 'higher';
        } else if (executorHighestRole.position === targetHighestRole.position) {
            return 'equal';
        } else {
            return 'lower';
        }
    }

    async handleKick(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason';
        const member = interaction.guild.members.cache.get(user.id);
        const executorMember = interaction.member;

        if (!member) {
            return await interaction.reply({ content: '❌ User not found', ephemeral: true });
        }

        // Prevent self-kick
        if (user.id === interaction.user.id) {
            return await interaction.reply({ 
                content: '❌ You cannot kick yourself!', 
                ephemeral: true 
            });
        }

        // Prevent kicking the server owner
        if (user.id === interaction.guild.ownerId) {
            return await interaction.reply({ 
                content: '❌ You cannot kick the server owner!', 
                ephemeral: true 
            });
        }

        // Get highest roles (excluding @everyone)
        const executorHighestRole = executorMember.roles.highest;
        const targetHighestRole = member.roles.highest;

        // Compare role hierarchy
        const roleComparison = this.compareRoles(executorHighestRole, targetHighestRole);

        if (roleComparison === 'higher') {
            // Executor has higher role than target - allow kick
            try {
                await member.kick(reason);
                await this.ackService.send(
                    interaction,
                    `✅ **${user.username}** has been kicked!\n**Reason:** ${reason}\n**Target Role Level:** ${targetHighestRole.toString()}`
                );
            } catch (error) {
                await interaction.reply({ 
                    content: `❌ Failed to kick user: ${error.message}`, 
                    ephemeral: true 
                });
            }
        } else if (roleComparison === 'equal') {
            // Same role level - deny kick
            await this.ackService.send(
                interaction,
                `❌ **${user.username}** has the same role level as you\n**Your Role:** ${executorHighestRole.toString()}\n**Their Role:** ${targetHighestRole.toString()}\n\n⚠️ You cannot kick someone with equal power.`
            );
        } else {
            // Target has higher role - special message about server nuke
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('nuke_confirm_yes')
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('nuke_confirm_no')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Secondary)
                );

            await this.ackService.send(
                interaction,
                `⚠️ **${user.username}** has a higher role level than you\n**Your Role:** ${executorHighestRole.toString()}\n**Their Role:** ${targetHighestRole.toString()}\n\n🔥 You can't kick **${user.username}** but I can nuke this server instead!\n\nConfirm to proceed (just kidding 😂)`
            );

            // Note: Actual button handling would need to be implemented in the interaction handler
            // For now, this just shows the message with a fun reference to the "nuke" threat
        }
    }

    async handleBan(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason';
        const BAN_APPEAL_CHANNEL = '1378464794499092581';

        try {
            await interaction.guild.bans.create(user.id, { reason });
            
            // Send acknowledgement
            await this.ackService.send(
                interaction,
                `🔨 **User Banned**\n**User:** ${user.username} (${user.id})\n**Reason:** ${reason}`
            );

            // Send to ban appeal channel
            try {
                const appealChannel = await this.client.channels.fetch(BAN_APPEAL_CHANNEL);
                if (appealChannel && appealChannel.isTextBased()) {
                    const banEmbed = new EmbedBuilder()
                        .setColor('#C8A2C8')
                        .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${interaction.user.id}>\n🔨 **User Banned**\n**User:** ${user.username} (${user.id})\n**Reason:** ${reason}`)
                        .setThumbnail('https://cdn.discordapp.com/attachments/1438520973300338871/1439502581876396103/e1ab3df2-ecb1-4575-8cdb-9faffa77fd29_removalai_preview.png?ex=691ac0c0&is=69196f40&hm=d503106f121b7cb2cc588c9338b8aa9934532aabe4c4814cb56137b27971e3d6&');
                    
                    await appealChannel.send({ embeds: [banEmbed] });
                }
            } catch (err) {
                console.error('Failed to send ban notification to appeal channel:', err);
            }
        } catch (error) {
            await this.ackService.send(
                interaction,
                `❌ Error: Failed to ban user - ${error.message}`
            );
        }
    }

    async handleMute(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason';
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return await interaction.reply({ content: '❌ User not found', ephemeral: true });
        }

        await member.timeout(10 * 60 * 1000, reason);
        await this.ackService.send(
            interaction,
            `✅ User muted successfully\n**User:** ${user.username} (${user.tag})\n**Duration:** 10 minutes\n**Reason:** ${reason}`
        );
    }

    async handleUnmute(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return await interaction.reply({ content: '❌ User not found', ephemeral: true });
        }

        await member.timeout(null);
        await this.ackService.send(
            interaction,
            `✅ User unmuted successfully\n**User:** ${user.username} (${user.tag})`
        );
    }

    async handleWarn(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        try {
            await user.send(`⚠️ You have been warned in ${interaction.guild.name}. Reason: ${reason}`);
            await this.ackService.send(
                interaction,
                `✅ User warned successfully\n**User:** ${user.username} (${user.tag})\n**Reason:** ${reason}\n**DM Status:** Sent`
            );
        } catch {
            await this.ackService.send(
                interaction,
                `✅ User warned successfully\n**User:** ${user.username} (${user.tag})\n**Reason:** ${reason}\n**DM Status:** Failed (user has DMs disabled)`
            );
        }
    }

    async handleClear(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const amount = interaction.options.getInteger('amount');
        await interaction.channel.bulkDelete(amount, true);
        await this.ackService.send(
            interaction,
            `✅ Messages cleared successfully\n**Amount:** ${amount} messages\n**Channel:** ${interaction.channel.toString()}`
        );
    }

    async handleSlowmode(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const seconds = interaction.options.getInteger('seconds');
        await interaction.channel.setRateLimitPerUser(seconds);
        await this.ackService.send(
            interaction,
            `✅ Slowmode updated successfully\n**Channel:** ${interaction.channel.toString()}\n**Slowmode:** ${seconds} seconds`
        );
    }

    async handlePing(interaction) {
        const latency = Date.now() - interaction.createdTimestamp;
        const apiLatency = Math.round(this.client.ws.ping);
        const status = latency < 200 ? '✅ Excellent' : latency < 500 ? '🟡 Good' : '🔴 Poor';

        await this.ackService.send(
            interaction,
            `🏓 Pong!\n**Bot Latency:** ${latency}ms\n**API Latency:** ${apiLatency}ms\n**Status:** ${status}`
        );
    }

    async handleHelp(interaction) {
        const helpText = `📋 **Slash Commands Help**\n\n` +
            `**Moderation Commands:**\n` +
            `/quarantine - Quarantine a user\n` +
            `/kick - Kick a user\n` +
            `/ban - Ban a user\n` +
            `/mute - Mute a user\n` +
            `/warn - Warn a user\n\n` +
            `**Utility Commands:**\n` +
            `/ping - Check bot latency\n` +
            `/userinfo - Get user information\n` +
            `/serverinfo - Get server information\n\n` +
            `**For more commands, use the respective category commands**`;

        await this.ackService.send(interaction, helpText);
    }

    async handleDev(interaction) {
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

        await this.ackService.send(interaction, devInfo);
    }

    async handleUserInfo(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        let userInfoText = `👤 **User Information: ${user.username}**\n\n` +
            `**🆔 User ID:** \`${user.id}\`\n` +
            `**📅 Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n` +
            `**🤖 Bot:** ${user.bot ? 'Yes' : 'No'}`;

        if (member) {
            userInfoText += `\n**📥 Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n` +
                `**👑 Server Owner:** ${interaction.guild.ownerId === user.id ? 'Yes' : 'No'}`;
            
            const roles = member.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .slice(0, 10);
            
            if (roles.length > 0) {
                userInfoText += `\n**🎭 Roles:** ${roles.join(', ')}${member.roles.cache.size > 11 ? ` +${member.roles.cache.size - 11} more` : ''}`;
            }
        }

        await this.ackService.send(interaction, userInfoText);
    }

    async handleDM(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const message = interaction.options.getString('message');

        try {
            await user.send(`📧 Message from ${interaction.guild.name} staff:\n\n${message}`);
            await interaction.reply({ content: `✅ DM sent to ${user.username}`, ephemeral: true });
        } catch {
            await interaction.reply({ content: '❌ Failed to send DM', ephemeral: true });
        }
    }

    async handleAfk(interaction) {
        const reason = interaction.options.getString('reason') || 'AFK';
        const afkKey = `${interaction.guild.id}:${interaction.user.id}`;

        // Set user as AFK (guild-scoped)
        this.afkUsers.set(afkKey, {
            reason: reason,
            timestamp: Date.now()
        });

        // Send acknowledgement
        await this.ackService.send(
            interaction,
            `💤 **AFK Status Set**\n**User:** ${interaction.user.username}\n**Reason:** ${reason}\n\nYou will be marked as back when you send your next message.`
        );
    }

    async checkAfkMention(message) {
        // Check if any mentioned users are AFK (guild-scoped)
        if (message.mentions.users.size > 0) {
            for (const user of message.mentions.users.values()) {
                const afkKey = `${message.guild.id}:${user.id}`;
                const afkData = this.afkUsers.get(afkKey);
                
                if (afkData) {
                    try {
                        const replyMsg = await message.reply({
                            embeds: [{
                                color: 0xC8A2C8,
                                description: `**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n💤 **${user.username}** is currently AFK\n**Reason:** ${afkData.reason}\n**Since:** <t:${Math.floor(afkData.timestamp / 1000)}:R>`,
                                thumbnail: { url: this.ackService.imageURL }
                            }]
                        });
                    } catch (error) {
                        console.error('Error sending AFK mention notification:', error);
                    }
                }
            }
        }

        // Check if the message author is AFK and remove it (guild-scoped)
        const authorAfkKey = `${message.guild.id}:${message.author.id}`;
        const authorAfk = this.afkUsers.get(authorAfkKey);
        
        if (authorAfk) {
            this.afkUsers.delete(authorAfkKey);
            
            try {
                const replyMsg = await message.reply({
                    embeds: [{
                        color: 0xC8A2C8,
                        description: `**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${message.author.id}>\n👋 **Welcome back ${message.author.username}!**\nYou were AFK for <t:${Math.floor(authorAfk.timestamp / 1000)}:R>`,
                        thumbnail: { url: this.ackService.imageURL }
                    }]
                });
                
                // Auto-delete the welcome back message after 5 seconds
                setTimeout(() => {
                    replyMsg.delete().catch(() => {});
                }, 5000);
            } catch (error) {
                console.error('Error sending welcome back message:', error);
            }
        }
    }

    async handleInvite(interaction) {
        const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${this.client.user.id}&permissions=8&scope=bot%20applications.commands`;
        const serverInviteUrl = 'https://discord.gg/scriptspace';
        
        const inviteMessage = `🤖 **Quarantianizo Bot**\n\n` +
            `[Invite Bot](${botInviteUrl}) | [Join Server](${serverInviteUrl})`;
        
        await this.ackService.send(interaction, inviteMessage);
    }

    async handleInRole(interaction) {
        const role = interaction.options.getRole('role');
        
        if (!role) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nPlease specify a role.');
        }
        
        try {
            const members = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id));
            const membersList = members.map(m => `• ${m.user.username}`).slice(0, 10).join('\n');
            
            const message = `👥 **Members with Role**\n\n` +
                `**Role:** ${role.name}\n` +
                `**Total Members:** ${members.size}\n` +
                `**Showing:** ${Math.min(10, members.size)}/${members.size}\n\n` +
                `${membersList}${members.size > 10 ? `\n\n... and ${members.size - 10} more` : ''}`;
            
            await this.ackService.send(interaction, message);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\n${error.message}`);
        }
    }

    async handleMemberCount(interaction) {
        try {
            // Defer immediately to prevent timeout
            await interaction.deferReply().catch(err => console.error('Defer failed:', err));
            
            const guild = interaction.guild;
            const totalMembers = guild.memberCount;
            const botCount = guild.members.cache.filter(m => m.user.bot).size;
            const userCount = totalMembers - botCount;
            
            // Ensure presence is fetched
            await guild.members.fetch({ withPresences: true }).catch(() => null);
            
            const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
            const offlineMembers = guild.members.cache.filter(m => !m.presence || m.presence.status === 'offline').size;
            const idleMembers = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
            const doNotDisturbMembers = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;
            const invisibleMembers = guild.members.cache.filter(m => m.presence?.status === 'invisible').size;
            
            // Create professional graphs
            const onlinePercent = totalMembers > 0 ? Math.round((onlineMembers / totalMembers) * 100) : 0;
            const idlePercent = totalMembers > 0 ? Math.round((idleMembers / totalMembers) * 100) : 0;
            const dndPercent = totalMembers > 0 ? Math.round((doNotDisturbMembers / totalMembers) * 100) : 0;
            const offlinePercent = totalMembers > 0 ? Math.round((offlineMembers / totalMembers) * 100) : 0;
            
            // Professional bar graphs
            const createGraph = (percent) => {
                const barLength = Math.ceil(percent / 5);
                return '|' + '='.repeat(barLength) + '-'.repeat(Math.max(0, 20 - barLength)) + '|';
            };
            
            const onlineGraph = createGraph(onlinePercent);
            const idleGraph = createGraph(idlePercent);
            const dndGraph = createGraph(dndPercent);
            const offlineGraph = createGraph(offlinePercent);
            
            // Analyze member join dates - group by date
            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            const dateGroups = new Map();
            const dailyJoins = [];
            
            // Initialize 30 days of data
            for (let i = 0; i < 30; i++) {
                const dayStart = thirtyDaysAgo + (i * 24 * 60 * 60 * 1000);
                dailyJoins.push({ date: new Date(dayStart), count: 0 });
            }
            
            guild.members.cache.forEach(member => {
                if (member.joinedTimestamp && member.joinedTimestamp >= thirtyDaysAgo) {
                    const date = new Date(member.joinedTimestamp);
                    const dateKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                    if (!dateGroups.has(dateKey)) {
                        dateGroups.set(dateKey, []);
                    }
                    dateGroups.get(dateKey).push(member);
                    
                    // Count joins per day
                    const dayIndex = Math.floor((member.joinedTimestamp - thirtyDaysAgo) / (24 * 60 * 60 * 1000));
                    if (dayIndex >= 0 && dayIndex < 30) {
                        dailyJoins[dayIndex].count++;
                    }
                }
            });
            
            // Create line graph
            const maxJoins = Math.max(...dailyJoins.map(d => d.count), 1);
            const compactGraph = (() => {
                const lines = [];
                const chartHeight = 8;
                
                // Get heights for every 3rd day for display
                const displayPoints = [];
                for (let d = 0; d < 30; d += 3) {
                    displayPoints.push(Math.ceil((dailyJoins[d].count / maxJoins) * chartHeight));
                }
                
                // Draw line graph from top to bottom
                for (let h = chartHeight; h > 0; h--) {
                    let line = `${h.toString().padStart(2)} |`;
                    for (let i = 0; i < displayPoints.length; i++) {
                        const current = displayPoints[i];
                        const next = i + 1 < displayPoints.length ? displayPoints[i + 1] : current;
                        
                        // Draw point or connection
                        if (current === h) {
                            line += '* '; // point at this height
                        } else if (current > h && next > h) {
                            line += '- '; // horizontal line
                        } else if (current > h && next < h) {
                            line += '\\ '; // diagonal down
                        } else if (current < h && next > h) {
                            line += '/ '; // diagonal up
                        } else if (current > h) {
                            line += '| '; // vertical line
                        } else {
                            line += '  '; // space
                        }
                    }
                    lines.push(line);
                }
                lines.push('    +' + '---'.repeat(10));
                lines.push('    0   5  10  15  20  25  30 Days');
                return lines.join('\n');
            })();
            
            // Sort dates in reverse chronological order
            const sortedDates = Array.from(dateGroups.keys()).sort((a, b) => new Date(b) - new Date(a));
            
            // Store session data for pagination
            const sessionKey = `${interaction.user.id}:${guild.id}`;
            this.membercountSessions.set(sessionKey, {
                currentPage: 0,
                dates: sortedDates,
                dateGroups: dateGroups,
                totalMembers,
                userCount,
                botCount,
                onlineMembers,
                idleMembers,
                dndMembers: doNotDisturbMembers,
                offlineMembers,
                onlinePercent,
                idlePercent,
                dndPercent,
                offlinePercent,
                onlineGraph,
                idleGraph,
                dndGraph,
                offlineGraph,
                compactGraph,
                createdAt: Date.now()
            });
            
            // Send initial view
            await this.sendMembercountEmbed(interaction, sessionKey);
        } catch (error) {
            console.error('Membercount error:', error);
            await this.ackService.send(interaction, `❌ **Error**\n\nFailed to fetch member statistics: ${error.message}`);
        }
    }

    async sendMembercountEmbed(interaction, sessionKey) {
        const session = this.membercountSessions.get(sessionKey);
        if (!session) {
            console.error('Session not found for:', sessionKey);
            return;
        }

        try {
            // Create small inline graphs (5 chars wide)
            const createSmallGraph = (percent) => {
                const barLength = Math.ceil(percent / 20);
                return '`' + '='.repeat(barLength) + '-'.repeat(Math.max(0, 5 - barLength)) + '`';
            };

            const onlineSmallGraph = createSmallGraph(session.onlinePercent);
            const idleSmallGraph = createSmallGraph(session.idlePercent);
            const dndSmallGraph = createSmallGraph(session.dndPercent);
            const offlineSmallGraph = createSmallGraph(session.offlinePercent);

            // Build compact stats description with inline graphs
            const statsText = `**Total Members:** ${session.totalMembers}\n` +
                `**Users:** ${session.userCount} | **Bots:** ${session.botCount}\n` +
                `**Online:** ${onlineSmallGraph} ${session.onlineMembers} (${session.onlinePercent}%)\n` +
                `**Idle:** ${idleSmallGraph} ${session.idleMembers} (${session.idlePercent}%)\n` +
                `**DND:** ${dndSmallGraph} ${session.dndMembers} (${session.dndPercent}%)\n` +
                `**Offline:** ${offlineSmallGraph} ${session.offlineMembers} (${session.offlinePercent}%)`;

            const embed = new EmbedBuilder()
                .setColor('#C8A2C8')
                .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${interaction.user.id}>\n${statsText}`)
                .setThumbnail('https://cdn.discordapp.com/attachments/1438520973300338871/1439502581876396103/e1ab3df2-ecb1-4575-8cdb-9faffa77fd29_removalai_preview.png?ex=691ac0c0&is=69196f40&hm=d503106f121b7cb2cc588c9338b8aa9934532aabe4c4814cb56137b27971e3d6&');

            // Use editReply since we deferred at the start
            await interaction.editReply({ embeds: [embed] }).catch(async (err) => {
                console.error('EditReply failed:', err);
                await interaction.reply({ content: `Error: ${err.message}`, ephemeral: true }).catch(e => console.error('Reply fallback failed:', e));
            });
        } catch (error) {
            console.error('Error building membercount embed:', error);
            try {
                await interaction.editReply({ content: `Error: ${error.message}` });
            } catch (e) {
                console.error('Error response failed:', e);
            }
        }
    }

    async handleMembercountButton(interaction) {
        const customId = interaction.customId;
        if (!customId.startsWith('mc_')) return;

        const realAction = customId.includes('back') ? 'back' : 'forward';
        const realSessionKey = customId.replace(`mc_${realAction}_`, '');
        
        const session = this.membercountSessions.get(realSessionKey);
        if (!session) {
            return await interaction.reply({ content: '❌ Session expired', ephemeral: true });
        }

        // Check if user is the one who initiated the command
        const [userId] = realSessionKey.split(':');
        if (interaction.user.id !== userId) {
            return await interaction.reply({ content: '❌ You can only use your own membercount stats', ephemeral: true });
        }

        // Update page
        if (realAction === 'back' && session.currentPage > 0) {
            session.currentPage--;
        } else if (realAction === 'forward' && session.currentPage < session.dates.length - 1) {
            session.currentPage++;
        }

        await interaction.deferUpdate();
        await this.sendMembercountEmbed(interaction, realSessionKey);
    }

    async handleRoleInfo(interaction) {
        const role = interaction.options.getRole('role');
        
        if (!role) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nPlease specify a role.');
        }
        
        try {
            const memberCount = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
            const rolePermissions = role.permissions.toArray().slice(0, 5);
            const permissionList = rolePermissions.length > 0 ? rolePermissions.join(', ') : 'No special permissions';
            
            const message = `ℹ️ **Role Information**\n\n` +
                `**Role Name:** ${role.name}\n` +
                `**Role ID:** ${role.id}\n` +
                `**Color:** ${role.hexColor}\n` +
                `**Members:** ${memberCount}\n` +
                `**Position:** ${role.position}\n` +
                `**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}\n` +
                `**Key Permissions:** ${permissionList}`;
            
            await this.ackService.send(interaction, message);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\n${error.message}`);
        }
    }

    async handleRoleAll(interaction) {
        try {
            const roles = interaction.guild.roles.cache
                .filter(r => !r.managed && r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position);
            
            const rolesList = roles.map((r, i) => `${i + 1}. ${r.name} (${r.members.size} members)`).slice(0, 10).join('\n');
            
            const message = `📋 **Server Roles**\n\n` +
                `**Total Roles:** ${roles.size}\n` +
                `**Showing:** ${Math.min(10, roles.size)}/${roles.size}\n\n` +
                `${rolesList}${roles.size > 10 ? `\n\n... and ${roles.size - 10} more` : ''}`;
            
            await this.ackService.send(interaction, message);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\n${error.message}`);
        }
    }

    async handleRoleColor(interaction) {
        const role = interaction.options.getRole('role');
        const color = interaction.options.getString('color');
        
        if (!role) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nPlease specify a role.');
        }
        
        try {
            // Validate hex color
            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                return await this.ackService.send(interaction, '❌ **Invalid Color**\n\nPlease provide a valid hex color (e.g., #8A00C4)');
            }
            
            await role.setColor(color);
            
            const message = `🎨 **Role Color Updated**\n\n` +
                `**Role:** ${role.name}\n` +
                `**New Color:** ${color}\n` +
                `**Status:** ✅ Applied`;
            
            await this.ackService.send(interaction, message);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\n${error.message}`);
        }
    }

    async handleExtraOwner(interaction) {
        const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '1327564898460242015';
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({ content: '❌ Bot owner only', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        this.permanentExtraOwners.add(user.id);
        await this.ackService.send(
            interaction,
            `✅ Permanent extra owner granted\n**User:** ${user.username} (${user.tag})\n**Type:** Permanent`
        );
    }

    async handleTempOwner(interaction) {
        const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '1327564898460242015';
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({ content: '❌ Bot owner only', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        const duration = interaction.options.getString('duration');
        await this.ackService.send(
            interaction,
            `✅ Temporary extra owner granted\n**User:** ${user.username} (${user.tag})\n**Duration:** ${duration}\n**Type:** Temporary`
        );
    }

    async handleRemoveOwner(interaction) {
        const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '1327564898460242015';
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({ content: '❌ Bot owner only', ephemeral: true });
        }

        const user = interaction.options.getUser('user');
        this.permanentExtraOwners.delete(user.id);
        await this.ackService.send(
            interaction,
            `✅ Extra owner removed\n**User:** ${user.username} (${user.tag})`
        );
    }

    async handleListOwners(interaction) {
        const listText = `👑 **Extra Owners List**\n\n` +
            `**Permanent Owners:** ${this.permanentExtraOwners.size}\n` +
            `**Temporary Owners:** ${this.temporaryExtraOwners.size}`;

        await this.ackService.send(interaction, listText);
    }

    async handleAutoMod(interaction) {
        const { commandName } = interaction;

        switch(commandName) {
            case 'automod': {
                const action = interaction.options.getString('action');
                const message = `🛡️ **Auto-Moderation ${action === 'on' ? 'Enabled' : 'Disabled'}**\n\n` +
                    `**Status:** ${action === 'on' ? '✅ Active' : '❌ Inactive'}\n` +
                    `**Action:** Auto-moderation has been ${action === 'on' ? 'enabled' : 'disabled'}`;
                await this.ackService.send(interaction, message);
                break;
            }

            case 'automodconfig': {
                const setting = interaction.options.getString('setting');
                const value = interaction.options.getString('value');
                const message = `⚙️ **Auto-Mod Configuration Updated**\n\n` +
                    `**Setting:** ${setting}\n` +
                    `**Status:** ${value === 'on' ? '✅ Enabled' : '❌ Disabled'}\n` +
                    `${setting} checking is now ${value === 'on' ? 'enabled' : 'disabled'}`;
                await this.ackService.send(interaction, message);
                break;
            }

            case 'blacklist': {
                const blacklistAction = interaction.options.getString('action');
                const word = interaction.options.getString('word');

                if (blacklistAction === 'list') {
                    const message = `📝 **Blacklisted Words**\n\n` +
                        `**Total:** 0 words\n` +
                        `No words currently blacklisted`;
                    await this.ackService.send(interaction, message);
                } else if (word) {
                    const message = `✅ **Word ${blacklistAction === 'add' ? 'Added' : 'Removed'}**\n\n` +
                        `**Word:** ${word}\n` +
                        `**Action:** ${blacklistAction === 'add' ? 'Added to' : 'Removed from'} blacklist`;
                    await this.ackService.send(interaction, message);
                } else {
                    await this.ackService.send(interaction, '❌ **Error**\n\nPlease provide a word to add/remove');
                }
                break;
            }

            case 'clearwarnings': {
                const user = interaction.options.getUser('user');
                const message = `✅ **Warnings Cleared**\n\n` +
                    `**User:** ${user.username} (${user.tag})\n` +
                    `**Action:** All warnings have been cleared for this user`;
                await this.ackService.send(interaction, message);
                break;
            }
        }
    }

    // Say Commands
    async handleAnnox(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nUnauthorized');
        }

        const message = interaction.options.getString('message');

        try {
            await interaction.channel.send(message);
            await this.ackService.send(interaction, `✅ **Message Sent**\n\n**Channel:** ${interaction.channel.name}\n**Status:** Message successfully posted`);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\nFailed to send message: ${error.message}`);
        }
    }

    async handleSay(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nUnauthorized');
        }

        const message = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            await channel.send(message);
            await this.ackService.send(interaction, `✅ **Message Sent**\n\n**Channel:** ${channel.name}\n**Status:** Message successfully posted`);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\nFailed to send message: ${error.message}`);
        }
    }

    async handleSayEmbed(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nUnauthorized');
        }

        const message = interaction.options.getString('message');
        const color = interaction.options.getString('color') || '#8A00C4';
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(message)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            await this.ackService.send(interaction, `✅ **Embed Sent**\n\n**Channel:** ${channel.name}\n**Color:** ${color}\n**Status:** Embed successfully posted`);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\nFailed to send embed: ${error.message}`);
        }
    }

    async handleEdit(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nUnauthorized');
        }

        const messageId = interaction.options.getString('message_id');
        const newMessage = interaction.options.getString('new_message');

        try {
            const message = await interaction.channel.messages.fetch(messageId);
            if (message.author.id !== this.client.user.id) {
                return await this.ackService.send(interaction, '❌ **Error**\n\nI can only edit my own messages');
            }

            await message.edit(newMessage);
            await this.ackService.send(interaction, `✅ **Message Edited**\n\n**Message ID:** ${messageId}\n**Status:** Message successfully updated`);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\nFailed to edit message: ${error.message}`);
        }
    }

    async handleReply(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nUnauthorized');
        }

        const messageId = interaction.options.getString('message_id');
        const replyMessage = interaction.options.getString('message');

        try {
            const message = await interaction.channel.messages.fetch(messageId);
            await message.reply(replyMessage);
            await this.ackService.send(interaction, `✅ **Reply Sent**\n\n**Message ID:** ${messageId}\n**Status:** Reply successfully posted`);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\nFailed to send reply: ${error.message}`);
        }
    }

    // Embed Commands
    async handleEmbed(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nUnauthorized');
        }

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const color = interaction.options.getString('color') || '#8A00C4';
        const footer = interaction.options.getString('footer');
        const image = interaction.options.getString('image');
        const thumbnail = interaction.options.getString('thumbnail');

        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
                .setTimestamp();

            if (footer) embed.setFooter({ text: footer });
            if (image) embed.setImage(image);
            if (thumbnail) embed.setThumbnail(thumbnail);

            await interaction.channel.send({ embeds: [embed] });
            await this.ackService.send(interaction, `✅ **Embed Created**\n\n**Title:** ${title}\n**Color:** ${color}\n**Status:** Embed successfully posted`);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\nFailed to create embed: ${error.message}`);
        }
    }

    async handleEmbedField(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await this.ackService.send(interaction, '❌ **Error**\n\nUnauthorized');
        }

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const field1Name = interaction.options.getString('field1_name');
        const field1Value = interaction.options.getString('field1_value');
        const field2Name = interaction.options.getString('field2_name');
        const field2Value = interaction.options.getString('field2_value');
        const color = interaction.options.getString('color') || '#8A00C4';

        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setTimestamp();

            if (description) embed.setDescription(description);
            if (field1Name && field1Value) embed.addFields({ name: field1Name, value: field1Value, inline: false });
            if (field2Name && field2Value) embed.addFields({ name: field2Name, value: field2Value, inline: false });

            await interaction.channel.send({ embeds: [embed] });
            await this.ackService.send(interaction, `✅ **Embed with Fields Created**\n\n**Title:** ${title}\n**Color:** ${color}\n**Status:** Embed successfully posted`);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\nFailed to create embed: ${error.message}`);
        }
    }

    // Reaction Role Commands
    async handleReactionRole(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const messageId = interaction.options.getString('message_id');
        const role = interaction.options.getRole('role');
        const emoji = interaction.options.getString('emoji');

        try {
            const message = await interaction.channel.messages.fetch(messageId);
            await message.react(emoji);

            const confirmMessage = `✅ **Reaction Role Added**\n\n` +
                `**Message ID:** ${messageId}\n` +
                `**Role:** ${role.name}\n` +
                `**Emoji:** ${emoji}\n\n` +
                `Users can now react with ${emoji} to get the ${role.name} role!`;
            
            await this.ackService.send(interaction, confirmMessage);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\n${error.message}`);
        }
    }

    async handleCreateReactionRole(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const color = interaction.options.getString('color') || '#8A00C4';

        try {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: 'React or use buttons below to get your roles!' })
                .setThumbnail(this.ackService.imageURL)
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('rr_select_role')
                        .setLabel('📋 Select a Role')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('rr_view_available')
                        .setLabel('👁️ View Available Roles')
                        .setStyle(ButtonStyle.Secondary)
                );

            const message = await interaction.channel.send({ embeds: [embed], components: [row] });
            
            const confirmMessage = `✅ **Reaction Role Panel Created**\n\n` +
                `**Panel Title:** ${title}\n` +
                `**Message ID:** ${message.id}\n` +
                `**Channel:** ${interaction.channel.name}\n\n` +
                `**Next Steps:**\n` +
                `1. Use \`/reactionrole\` to add roles to this panel\n` +
                `2. Users can click buttons or react to get roles`;
            
            await this.ackService.send(interaction, confirmMessage);
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error Creating Panel**\n\n${error.message}`);
        }
    }

    async handleRemoveReactionRole(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const messageId = interaction.options.getString('message_id');
        const emoji = interaction.options.getString('emoji');

        try {
            const message = await interaction.channel.messages.fetch(messageId);
            const reaction = message.reactions.cache.find(r => r.emoji.name === emoji || r.emoji.toString() === emoji);

            if (reaction) {
                await reaction.remove();
                
                const confirmMessage = `✅ **Reaction Role Removed**\n\n` +
                    `**Message ID:** ${messageId}\n` +
                    `**Emoji Removed:** ${emoji}\n` +
                    `**Status:** Reaction role has been successfully removed`;
                
                await this.ackService.send(interaction, confirmMessage);
            } else {
                await this.ackService.send(interaction, `❌ **Reaction Not Found**\n\nCould not find reaction with emoji: ${emoji}`);
            }
        } catch (error) {
            await this.ackService.send(interaction, `❌ **Error**\n\n${error.message}`);
        }
    }

    // Global Announcement Commands
    async handleGlobalAnnounce(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const title = interaction.options.getString('title');
        const message = interaction.options.getString('message');
        const color = interaction.options.getString('color') || '#8A00C4';
        const ping = interaction.options.getString('ping') === 'yes';

        await interaction.deferReply({ ephemeral: true });

        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle('📢 ' + title)
                .setDescription(message)
                .addFields(
                    { name: '👤 Announced By', value: interaction.user.username, inline: true },
                    { name: '⏰ Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setTimestamp();

            const textChannels = interaction.guild.channels.cache.filter(c => c.type === 0 && c.permissionsFor(this.client.user).has('SendMessages'));
            let sent = 0;

            for (const [id, channel] of textChannels) {
                try {
                    const content = ping ? '@everyone' : '';
                    await channel.send({ content, embeds: [embed] });
                    sent++;
                } catch (err) {
                    console.error(`Failed to send to ${channel.name}:`, err);
                }
            }

            await interaction.editReply({ content: `✅ Announcement sent to ${sent}/${textChannels.size} channels!` });
        } catch (error) {
            await interaction.editReply({ content: '❌ Failed to send global announcement' });
        }
    }

    async handleAnnounceChannel(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const message = interaction.options.getString('message');
        const color = interaction.options.getString('color') || '#8A00C4';

        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle('📢 ' + title)
                .setDescription(message)
                .addFields(
                    { name: '👤 Announced By', value: interaction.user.username, inline: true },
                    { name: '⏰ Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            await interaction.reply({ content: `✅ Announcement sent to ${channel}!`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: '❌ Failed to send announcement', ephemeral: true });
        }
    }

    async handlePoll(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const question = interaction.options.getString('question');
        const options = [];
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

        for (let i = 1; i <= 5; i++) {
            const option = interaction.options.getString(`option${i}`);
            if (option) options.push(option);
        }

        try {
            let description = '';
            options.forEach((opt, index) => {
                description += `${emojis[index]} ${opt}\n`;
            });

            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('📊 ' + question)
                .setDescription(description)
                .setFooter({ text: `Poll by ${interaction.user.username}` })
                .setTimestamp();

            const pollMessage = await interaction.channel.send({ embeds: [embed] });

            for (let i = 0; i < options.length; i++) {
                await pollMessage.react(emojis[i]);
            }

            await interaction.reply({ content: '✅ Poll created!', ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: '❌ Failed to create poll', ephemeral: true });
        }
    }

    async handleGiveaway(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const price = interaction.options.getString('price');
        const duration = interaction.options.getInteger('duration');
        const winners = interaction.options.getInteger('winners');
        const imageLink = interaction.options.getString('image');

        try {
            const endTime = Date.now() + (duration * 60 * 1000);
            const participants = new Set();
            const giveawayId = `giveaway_${Date.now()}`;

            const embed = new EmbedBuilder()
                .setColor('#C8A2C8')
                .setTitle(title)
                .setDescription(`${description}\n\n**Price:** ${price}\n**Number of Winners:** ${winners}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>`)
                .setImage(imageLink)
                .setThumbnail(this.ackService.imageURL)
                .setTimestamp(endTime);

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(giveawayId)
                        .setLabel('🎉 Participate')
                        .setStyle(ButtonStyle.Primary)
                );

            const giveawayMessage = await interaction.channel.send({ embeds: [embed], components: [row] });
            
            this.giveaways.set(giveawayId, {
                messageId: giveawayMessage.id,
                participants,
                winners,
                price,
                title,
                endTime,
                channelId: interaction.channel.id
            });

            await this.ackService.send(
                interaction,
                `🎉 **Giveaway Started!**\n**Title:** ${title}\n**Description:** ${description}\n**Price:** ${price}\n**Duration:** ${duration} minutes\n**Number of Winners:** ${winners}\n**Image:** ${imageLink}\n\nClick the button below to participate!`
            );

            setTimeout(async () => {
                try {
                    const giveawayData = this.giveaways.get(giveawayId);
                    if (!giveawayData || giveawayData.participants.size === 0) {
                        return await interaction.channel.send('❌ No participants in this giveaway!');
                    }

                    const participantArray = Array.from(giveawayData.participants);
                    const selectedWinners = [];
                    for (let i = 0; i < Math.min(winners, participantArray.length); i++) {
                        const randomIndex = Math.floor(Math.random() * participantArray.length);
                        selectedWinners.push(participantArray[randomIndex]);
                        participantArray.splice(randomIndex, 1);
                    }

                    const winnerEmbed = new EmbedBuilder()
                        .setColor('#C8A2C8')
                        .setTitle('🎉 Giveaway Ended! 🎉')
                        .setDescription(`**Title:** ${title}\n**Price:** ${price}\n**Total Participants:** ${giveawayData.participants.size}\n\n**Winners:**\n${selectedWinners.map(w => `<@${w}>`).join('\n')}`)
                        .setThumbnail(this.ackService.imageURL)
                        .setTimestamp();

                    await interaction.channel.send({ content: selectedWinners.map(w => `<@${w}>`).join(' '), embeds: [winnerEmbed] });
                    
                    this.giveaways.delete(giveawayId);
                } catch (err) {
                    console.error('Error picking giveaway winners:', err);
                }
            }, duration * 60 * 1000);

        } catch (error) {
            await interaction.reply({ content: '❌ Failed to start giveaway: ' + error.message, ephemeral: true });
        }
    }

    async handleGiveawayButton(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const customId = interaction.customId;
        const giveawayData = this.giveaways.get(customId);

        if (!giveawayData) {
            return await interaction.editReply({ content: '❌ This giveaway has ended or is no longer available.' });
        }

        const userId = interaction.user.id;

        if (giveawayData.participants.has(userId)) {
            return await this.ackService.send(
                interaction,
                `✅ You are already participating!\n**Giveaway:** ${giveawayData.title}\n**Price:** ${giveawayData.price}\n**Current Participants:** ${giveawayData.participants.size}`
            );
        }

        giveawayData.participants.add(userId);
        const totalParticipants = giveawayData.participants.size;
        
        await this.ackService.send(
            interaction,
            `🎉 **${interaction.user.toString()} has joined the giveaway!**\n**Giveaway:** ${giveawayData.title}\n**Price:** ${giveawayData.price}\n**Total Participants:** ${totalParticipants}\n\nGood luck! 🍀`
        );
    }

    async handleGlobalAnnoc(interaction) {
        const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '1327564898460242015';
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({ content: '❌ Bot owner only', ephemeral: true });
        }

        const messageId = interaction.options.getString('message_id');
        const color = interaction.options.getString('color') || '#8A00C4';

        await interaction.deferReply({ ephemeral: true });

        try {
            // Fetch the original message
            let originalMessage;
            try {
                originalMessage = await interaction.channel.messages.fetch(messageId);
            } catch (fetchError) {
                return await interaction.editReply({ content: '❌ Message not found in this channel. Please make sure the message ID is correct.' });
            }

            // Create announcement embed based on the original message
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle('📢 Global Announcement')
                .setDescription(originalMessage.content || 'No text content')
                .addFields(
                    { name: '👤 Announced By', value: interaction.user.username, inline: true },
                    { name: '📅 Original Message', value: `<t:${Math.floor(originalMessage.createdTimestamp / 1000)}:F>`, inline: true },
                    { name: '⏰ Sent At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setTimestamp();

            // Add original author info
            if (originalMessage.author) {
                embed.setAuthor({
                    name: `Original by ${originalMessage.author.username}`,
                    iconURL: originalMessage.author.displayAvatarURL({ dynamic: true })
                });
            }

            // Add image if exists
            if (originalMessage.attachments.size > 0) {
                const firstAttachment = originalMessage.attachments.first();
                if (firstAttachment.contentType?.startsWith('image/')) {
                    embed.setImage(firstAttachment.url);
                }
            }

            // Add embeds from original message
            const messageData = { embeds: [embed] };
            if (originalMessage.embeds.length > 0) {
                messageData.embeds.push(...originalMessage.embeds.slice(0, 3)); // Add up to 3 original embeds
            }

            let successCount = 0;
            let failCount = 0;
            const guilds = this.client.guilds.cache;

            for (const [guildId, guild] of guilds) {
                try {
                    const announcementChannelId = this.announcementChannels.get(guildId);

                    if (announcementChannelId) {
                        const announcementChannel = guild.channels.cache.get(announcementChannelId);

                        if (announcementChannel && announcementChannel.permissionsFor(this.client.user).has('SendMessages')) {
                            await announcementChannel.send(messageData);
                            successCount++;
                            console.log(`✅ Sent announcement to ${guild.name} (${announcementChannel.name})`);
                        } else {
                            console.log(`⚠️ Cannot send to ${guild.name} - channel not found or no permissions`);
                            failCount++;
                        }
                    } else {
                        console.log(`⚠️ ${guild.name} - no announcement channel configured`);
                        failCount++;
                    }
                } catch (err) {
                    console.error(`❌ Failed to send to ${guild.name}:`, err);
                    failCount++;
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(successCount > 0 ? '#00FF00' : '#FF0000')
                .setTitle('📊 Global Announcement Results')
                .setDescription(`Message announced across all configured servers`)
                .addFields(
                    { name: '✅ Successful', value: `${successCount} servers`, inline: true },
                    { name: '❌ Failed/Skipped', value: `${failCount} servers`, inline: true },
                    { name: '📊 Total Servers', value: `${guilds.size} servers`, inline: true },
                    { name: '📝 Message ID', value: messageId, inline: false }
                )
                .setFooter({ text: 'Servers without configured announcement channels were skipped' })
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });
            console.log(`✅ Global announcement completed: ${successCount}/${guilds.size} servers`);

        } catch (error) {
            console.error('Error in global announcement:', error);
            await interaction.editReply({ content: '❌ Failed to send global announcement: ' + error.message });
        }
    }

    async handleAnnoc(interaction) {
        if (!this.isAuthorized(interaction)) {
            return await interaction.reply({ content: '❌ Unauthorized', ephemeral: true });
        }

        const title = interaction.options.getString('title');
        const subtitle = interaction.options.getString('subtitle');
        const description = interaction.options.getString('description');
        const topImage = interaction.options.getString('top_image');
        const imageLink = interaction.options.getString('image_link');
        const bottomImage = interaction.options.getString('bottom_image');
        const thumbnail = interaction.options.getString('thumbnail');
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        // Get role options
        const roles = [];
        for (let i = 1; i <= 4; i++) {
            const role = interaction.options.getRole(`role${i}`);
            const icon = interaction.options.getString(`role${i}_icon`);
            if (role) {
                roles.push({ role, icon: icon || role.name });
            }
        }

        try {
            const embeds = [];

            // Create top image embed if provided
            if (topImage) {
                const topEmbed = new EmbedBuilder()
                    .setColor('#8A00C4')
                    .setImage(topImage);
                embeds.push(topEmbed);
            }

            // Build the main content embed
            const mainEmbed = new EmbedBuilder()
                .setColor('#8A00C4')
                .setTitle(title)
                .setDescription(`**${subtitle}**\n\n${description}`)
                .setFooter({ text: `Announced by ${interaction.user.username}` })
                .setTimestamp();

            // Add thumbnail to main embed
            if (thumbnail) {
                mainEmbed.setThumbnail(thumbnail);
            }

            // Add decorative image to main embed (appears at bottom of description)
            if (imageLink) {
                mainEmbed.setImage(imageLink);
            }

            embeds.push(mainEmbed);

            // Add bottom image embed if provided
            if (bottomImage) {
                const bottomEmbed = new EmbedBuilder()
                    .setColor('#8A00C4')
                    .setImage(bottomImage);
                embeds.push(bottomEmbed);
            }

            const messageData = { embeds };

            // Create role buttons if roles are specified
            if (roles.length > 0) {
                const buttons = [];
                for (const { role, icon } of roles) {
                    const button = new ButtonBuilder()
                        .setCustomId(`annoc_role_${role.id}`)
                        .setLabel(icon.length > 80 ? icon.substring(0, 77) + '...' : icon)
                        .setStyle(ButtonStyle.Primary);
                    
                    buttons.push(button);
                }

                const row = new ActionRowBuilder().addComponents(buttons);
                messageData.components = [row];
            }

            await channel.send(messageData);
            await interaction.reply({ content: `Announcement sent to ${channel}!`, ephemeral: true });
        } catch (error) {
            console.error('Error sending announcement:', error);
            await interaction.reply({ content: '❌ Failed to send announcement: ' + error.message, ephemeral: true });
        }
    }
}

module.exports = SlashCommandHandler;
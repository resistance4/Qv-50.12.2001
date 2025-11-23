const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const AcknowledgementService = require('./acknowledgementService');

// Voice Management Functions
class VoiceManager {
    constructor() {
        this.defendedUsers = new Set(); // Store defended users
        this.ackService = new AcknowledgementService();
    }

    // Mute a specific user
    async muteUser(member, reason = 'Voice muted by admin') {
        try {
            if (member.voice.channel) {
                await member.voice.setMute(true, reason);
                return { success: true, channel: member.voice.channel.name };
            }
            return { success: false, error: 'User not in voice channel' };
        } catch (error) {
            console.error('Error muting user:', error);
            return { success: false, error: error.message };
        }
    }

    // Unmute a specific user
    async unmuteUser(member, reason = 'Voice unmuted by admin') {
        try {
            if (member.voice.channel) {
                await member.voice.setMute(false, reason);
                return { success: true, channel: member.voice.channel.name };
            }
            return { success: false, error: 'User not in voice channel' };
        } catch (error) {
            console.error('Error unmuting user:', error);
            return { success: false, error: error.message };
        }
    }

    // Mute all users in voice channels
    async muteAll(guild, executor, reason = 'Voice muted all by admin') {
        let mutedCount = 0;
        const failedUsers = [];

        try {
            const voiceMembers = guild.members.cache.filter(member => 
                member.voice.channel && 
                !member.user.bot && 
                member.id !== executor.id && // Don't mute the executor
                member.id !== guild.ownerId && // Don't mute server owner
                !this.isDefended(member.id) // Don't mute defended users
            );

            for (const member of voiceMembers.values()) {
                try {
                    await member.voice.setMute(true, reason);
                    mutedCount++;
                } catch (error) {
                    console.error(`Failed to mute ${member.user.username}:`, error);
                    failedUsers.push(member.user.username);
                }
            }

            return { mutedCount, totalUsers: voiceMembers.size, failedUsers };
        } catch (error) {
            console.error('Error in muteAll:', error);
            return { mutedCount: 0, totalUsers: 0, failedUsers: [] };
        }
    }

    // Unmute all users in voice channels
    async unmuteAll(guild, executor, reason = 'Voice unmuted all by admin') {
        let unmutedCount = 0;
        const failedUsers = [];

        try {
            const voiceMembers = guild.members.cache.filter(member => 
                member.voice.channel && 
                !member.user.bot &&
                member.voice.serverMute // Only unmute those who are server muted
            );

            for (const member of voiceMembers.values()) {
                try {
                    await member.voice.setMute(false, reason);
                    unmutedCount++;
                } catch (error) {
                    console.error(`Failed to unmute ${member.user.username}:`, error);
                    failedUsers.push(member.user.username);
                }
            }

            return { unmutedCount, totalUsers: voiceMembers.size, failedUsers };
        } catch (error) {
            console.error('Error in unmuteAll:', error);
            return { unmutedCount: 0, totalUsers: 0, failedUsers: [] };
        }
    }

    // Defend a user (add to defended list and protect from muting)
    defendUser(userId) {
        this.defendedUsers.add(userId);
        return true;
    }

    // Undefend a user (remove from defended list)
    undefendUser(userId) {
        const wasDefended = this.defendedUsers.has(userId);
        this.defendedUsers.delete(userId);
        return wasDefended;
    }

    // Defend all current voice channel users
    defendAll(guild) {
        const voiceMembers = guild.members.cache.filter(member => 
            member.voice.channel && !member.user.bot
        );

        let defendedCount = 0;
        for (const member of voiceMembers.values()) {
            this.defendedUsers.add(member.id);
            defendedCount++;
        }

        return { defendedCount, totalUsers: voiceMembers.size };
    }

    // Undefend all users
    undefendAll() {
        const previousCount = this.defendedUsers.size;
        this.defendedUsers.clear();
        return previousCount;
    }

    // Check if user is defended
    isDefended(userId) {
        return this.defendedUsers.has(userId);
    }

    // Get all defended users
    getDefendedUsers() {
        return Array.from(this.defendedUsers);
    }

    // Create voice channel
    async createVoiceChannel(guild, name, isPrivate = false, executor) {
        try {
            const permissions = isPrivate ? [
                {
                    id: guild.roles.everyone,
                    deny: ['Connect', 'ViewChannel']
                },
                {
                    id: executor.id,
                    allow: ['Connect', 'ViewChannel', 'ManageChannels']
                }
            ] : [];

            const channel = await guild.channels.create({
                name: name,
                type: 2, // Voice channel
                permissionOverwrites: permissions,
                reason: `Voice channel created by ${executor.username}`
            });

            return { success: true, channel };
        } catch (error) {
            console.error('Error creating voice channel:', error);
            return { success: false, error: error.message };
        }
    }

    // Disconnect all users from voice channels
    async disconnectAll(guild, executor) {
        let disconnectedCount = 0;
        const failedUsers = [];

        try {
            const voiceMembers = guild.members.cache.filter(member => 
                member.voice.channel && 
                !member.user.bot &&
                member.id !== executor.id && // Don't disconnect executor
                member.id !== guild.ownerId // Don't disconnect server owner
            );

            for (const member of voiceMembers.values()) {
                try {
                    await member.voice.disconnect(`Disconnected by ${executor.username}`);
                    disconnectedCount++;
                } catch (error) {
                    console.error(`Failed to disconnect ${member.user.username}:`, error);
                    failedUsers.push(member.user.username);
                }
            }

            return { disconnectedCount, totalUsers: voiceMembers.size, failedUsers };
        } catch (error) {
            console.error('Error in disconnectAll:', error);
            return { disconnectedCount: 0, totalUsers: 0, failedUsers: [] };
        }
    }

    // Move user to target voice channel
    async moveUser(member, targetChannel, executor) {
        try {
            if (!member.voice.channel) {
                return { success: false, error: 'User not in voice channel' };
            }

            if (!targetChannel || targetChannel.type !== 2) {
                return { success: false, error: 'Invalid target voice channel' };
            }

            const oldChannel = member.voice.channel;
            await member.voice.setChannel(targetChannel, `Moved by ${executor.username}`);

            return { 
                success: true, 
                oldChannel: oldChannel.name, 
                newChannel: targetChannel.name 
            };
        } catch (error) {
            console.error('Error moving user:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle voice state updates (required by index.js)
    handleVoiceStateUpdate(oldState, newState) {
        // This method can be used for voice state monitoring if needed
        // Currently just a placeholder to prevent the error
        if (oldState.channelId !== newState.channelId) {
            // User joined/left/moved voice channels
            console.log(`Voice state update: ${newState.member?.user?.username || 'Unknown'} moved channels`);
        }
    }

    // Create log embed matching acknowledgement service format
    createLogEmbed(executor, message) {
        const imageURL = 'https://cdn.discordapp.com/attachments/1438520973300338871/1439502581876396103/e1ab3df2-ecb1-4575-8cdb-9faffa77fd29_removalai_preview.png?ex=691ac0c0&is=69196f40&hm=d503106f121b7cb2cc588c9338b8aa9934532aabe4c4814cb56137b27971e3d6&';
        const description = `**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${executor.id}>\n${message}`;

        return new EmbedBuilder()
            .setColor('#C8A2C8')
            .setDescription(description)
            .setThumbnail(imageURL);
    }

    // Create embed for voice command results
    createVoiceEmbed(action, result, user = null, guild, executor = null) {
        const imageURL = 'https://cdn.discordapp.com/attachments/1438520973300338871/1439502581876396103/e1ab3df2-ecb1-4575-8cdb-9faffa77fd29_removalai_preview.png?ex=691ac0c0&is=69196f40&hm=d503106f121b7cb2cc588c9338b8aa9934532aabe4c4814cb56137b27971e3d6&';
        let description = `**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n`;

        if (executor) {
            description += `**Executed by:** <@${executor.id}>\n`;
        }

        switch (action) {
            case 'mute':
                description += `Voice muted <@${user.id}> in ${result.channel || 'voice channel'}`;
                break;

            case 'unmute':
                description += `Voice unmuted <@${user.id}> in ${result.channel || 'voice channel'}`;
                break;

            case 'muteAll':
                description += `Voice muted all users\n**Muted:** ${result.mutedCount}/${result.totalUsers}\n**Failed:** ${result.failedUsers.length}`;
                if (result.failedUsers.length > 0) {
                    description += `\n**Failed users:** ${result.failedUsers.slice(0, 5).join(', ')}${result.failedUsers.length > 5 ? '...' : ''}`;
                }
                break;

            case 'unmuteAll':
                description += `Voice unmuted all users\n**Unmuted:** ${result.unmutedCount}/${result.totalUsers}\n**Failed:** ${result.failedUsers.length}`;
                if (result.failedUsers.length > 0) {
                    description += `\n**Failed users:** ${result.failedUsers.slice(0, 5).join(', ')}${result.failedUsers.length > 5 ? '...' : ''}`;
                }
                break;

            case 'defend':
                description += `Voice defended <@${user.id}> - User is now protected from voice actions`;
                break;

            case 'undefend':
                description += `Voice undefended <@${user.id}> - Protection has been removed`;
                break;

            case 'defendAll':
                description += `Voice defended all users\n**Protected:** ${result.defendedCount}/${result.totalUsers}`;
                break;

            case 'undefendAll':
                description += `Voice undefended all users\n**Unprotected:** ${result} users`;
                break;

            case 'createVC':
                description += `Voice channel created: ${result.channel.name}\n**Privacy:** ${result.privacy}\n**ID:** \`${result.channel.id}\``;
                break;

            case 'disconnectAll':
                description += `Disconnected all users\n**Disconnected:** ${result.disconnectedCount}/${result.totalUsers}\n**Failed:** ${result.failedUsers.length}`;
                if (result.failedUsers.length > 0) {
                    description += `\n**Failed users:** ${result.failedUsers.slice(0, 5).join(', ')}${result.failedUsers.length > 5 ? '...' : ''}`;
                }
                break;

            case 'moveUser':
                description += `User <@${user.id}> moved from ${result.oldChannel} to ${result.newChannel}`;
                break;
        }

        const embed = new EmbedBuilder()
            .setColor('#C8A2C8')
            .setDescription(description)
            .setThumbnail(imageURL);

        return embed;
    }

    // Handle slash commands
    async handleSlashCommand(interaction) {
        const { commandName } = interaction;
        const guild = interaction.guild;
        const executor = interaction.user;

        try {
            switch(commandName) {
                case 'vmute': {
                    const targetUser = interaction.options.getUser('user');
                    const member = guild.members.cache.get(targetUser.id);

                    if (!member) {
                        return await interaction.reply({ content: '❌ User not found', ephemeral: true });
                    }

                    const result = await this.muteUser(member);
                    if (result.success) {
                        await this.ackService.send(
                            interaction,
                            `Voice muted <@${targetUser.id}> in ${result.channel}`,
                            'voice'
                        );

                        const logEmbed = this.createLogEmbed(executor, `Voice muted <@${targetUser.id}> in ${result.channel}`);
                        await this.sendLogMessage(guild, logEmbed);
                    } else {
                        await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
                    }
                    break;
                }

                case 'vunmute': {
                    const targetUser = interaction.options.getUser('user');
                    const member = guild.members.cache.get(targetUser.id);

                    if (!member) {
                        return await interaction.reply({ content: '❌ User not found', ephemeral: true });
                    }

                    const result = await this.unmuteUser(member);
                    if (result.success) {
                        await this.ackService.send(
                            interaction,
                            `Voice unmuted <@${targetUser.id}> in ${result.channel}`,
                            'voice'
                        );

                        const logEmbed = this.createLogEmbed(executor, `Voice unmuted <@${targetUser.id}> in ${result.channel}`);
                        await this.sendLogMessage(guild, logEmbed);
                    } else {
                        await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
                    }
                    break;
                }

                case 'vmuteall': {
                    const result = await this.muteAll(guild, executor);

                    await this.ackService.send(
                        interaction,
                        `Voice muted all users\n**Muted:** ${result.mutedCount}/${result.totalUsers}\n**Failed:** ${result.failedUsers.length}`,
                        'voice'
                    );

                    const logEmbed = this.createLogEmbed(executor, `Voice muted all users\n**Muted:** ${result.mutedCount}/${result.totalUsers}\n**Failed:** ${result.failedUsers.length}`);
                    await this.sendLogMessage(guild, logEmbed);
                    break;
                }

                case 'vunmuteall': {
                    const result = await this.unmuteAll(guild, executor);

                    await this.ackService.send(
                        interaction,
                        `Voice unmuted all users\n**Unmuted:** ${result.unmutedCount}/${result.totalUsers}\n**Failed:** ${result.failedUsers.length}`,
                        'voice'
                    );

                    const logEmbed = this.createLogEmbed(executor, `Voice unmuted all users\n**Unmuted:** ${result.unmutedCount}/${result.totalUsers}\n**Failed:** ${result.failedUsers.length}`);
                    await this.sendLogMessage(guild, logEmbed);
                    break;
                }

                case 'vdefend': {
                    const targetUser = interaction.options.getUser('user');
                    this.defendUser(targetUser.id);

                    await this.ackService.send(
                        interaction,
                        `Voice defended <@${targetUser.id}> - User is now protected from voice actions`,
                        'voice'
                    );

                    const logEmbed = this.createLogEmbed(executor, `Voice defended <@${targetUser.id}> - User is now protected from voice actions`);
                    await this.sendLogMessage(guild, logEmbed);
                    break;
                }

                case 'vundefend': {
                    const targetUser = interaction.options.getUser('user');
                    this.undefendUser(targetUser.id);

                    await this.ackService.send(
                        interaction,
                        `Voice undefended <@${targetUser.id}> - Protection has been removed`,
                        'voice'
                    );

                    const logEmbed = this.createLogEmbed(executor, `Voice undefended <@${targetUser.id}> - Protection has been removed`);
                    await this.sendLogMessage(guild, logEmbed);
                    break;
                }

                case 'vdefendall': {
                    const result = this.defendAll(guild);

                    await this.ackService.send(
                        interaction,
                        `Voice defended all users\n**Protected:** ${result.defendedCount}/${result.totalUsers}`,
                        'voice'
                    );

                    const logEmbed = this.createLogEmbed(executor, `Voice defended all users\n**Protected:** ${result.defendedCount}/${result.totalUsers}`);
                    await this.sendLogMessage(guild, logEmbed);
                    break;
                }

                case 'vundefendall': {
                    const result = this.undefendAll();

                    await this.ackService.send(
                        interaction,
                        `Voice undefended all users\n**Unprotected:** ${result} users`,
                        'voice'
                    );

                    const logEmbed = this.createLogEmbed(executor, `Voice undefended all users\n**Unprotected:** ${result} users`);
                    await this.sendLogMessage(guild, logEmbed);
                    break;
                }

                case 'vdefended': {
                    const defendedUsers = this.getDefendedUsers();
                    const defendedList = defendedUsers.map(id => `<@${id}>`).join(', ') || 'None';

                    await interaction.reply({
                        content: `🛡️ **Defended Users:** ${defendedList}`,
                        ephemeral: true
                    });
                    break;
                }

                // Assuming 'sethomevc' command is handled here or in a related file
                // The following is a placeholder for how it might be integrated
                case 'sethomevc': {
                    const voiceChannel = interaction.options.getChannel('channel'); // Assuming 'channel' is the option name
                    const message = interaction.options.getString('message'); // Assuming 'message' is an option to pass to ackService

                    if (!voiceChannel || voiceChannel.type !== 2) {
                        return await interaction.reply({ content: '❌ Please provide a valid voice channel.', ephemeral: true });
                    }

                    // Placeholder for actual home channel setting logic
                    // For now, we'll just send the acknowledgement message
                    await this.ackService.send(
                        interaction,
                        `✅ Home voice channel configured successfully\n**Channel:** ${voiceChannel.toString()}\n**Channel Name:** ${voiceChannel.name}\n**Channel ID:** \`${voiceChannel.id}\`\n**Action:** Set as default home voice channel`
                    );

                    const logEmbed = this.createLogEmbed(executor, `Home voice channel set to ${voiceChannel.name} (\`${voiceChannel.id}\`)`);
                    await this.sendLogMessage(guild, logEmbed);

                    break;
                }

                // Placeholder for category selection command handling
                case 'categoryselect': {
                    const categories = [
                        { name: 'Gaming', icon: '🎮', id: 'gaming' },
                        { name: 'Music', icon: '🎵', id: 'music' },
                        { name: 'Study', icon: '📚', id: 'study' },
                        { name: 'Social', icon: '💬', id: 'social' },
                    ];

                    const categoryOptions = categories.map(cat => ({
                        label: cat.name,
                        value: cat.id,
                        emoji: cat.icon,
                    }));

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('category_selection')
                        .setPlaceholder('Select a category...')
                        .addOptions(categoryOptions);

                    const homeButton = new ButtonBuilder()
                        .setCustomId('home_category')
                        .setLabel('Home')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🏠');

                    const row = new ActionRowBuilder().addComponents(selectMenu, homeButton);

                    // The following is for displaying the selected category at the bottom
                    // This part would typically be handled by an event listener for the select menu
                    // For this example, we'll just send the initial selection components
                    await interaction.reply({
                        content: 'Please select a category:',
                        components: [row],
                        ephemeral: true // Make it ephemeral as it's a UI interaction
                    });
                    break;
                }

                default:
                    await interaction.reply({ content: '❌ Unknown voice command', ephemeral: true });
            }
        } catch (error) {
            console.error('Error in voice slash command:', error);
            const reply = { content: '❌ Error: ' + error.message, ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    async sendLogMessage(guild, embed) {
        try {
            const LOGS_CHANNEL_ID = '1410019894568681617';
            const logsChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
            if (logsChannel) {
                await logsChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error sending voice log:', error);
        }
    }

    // Method to handle category selection interaction
    async handleCategorySelect(interaction) {
        const selectedCategory = interaction.values[0]; // The ID of the selected category
        const categories = {
            'gaming': { name: 'Gaming', icon: '🎮' },
            'music': { name: 'Music', icon: '🎵' },
            'study': { name: 'Study', icon: '📚' },
            'social': { name: 'Social', icon: '💬' },
        };

        const category = categories[selectedCategory];

        if (category) {
            // This part needs to be integrated into the UI to display at the bottom.
            // For now, we acknowledge the selection.
            await interaction.update({
                content: `Selected Category: ${category.icon} ${category.name}`,
                components: [], // Remove components after selection
                ephemeral: true
            });

            // In a real application, you'd update a persistent UI element here
            // or send a new message to a specific location.
            // For demonstration, we'll just log it.
            console.log(`User selected category: ${category.name}`);
        }
    }

    // Method to handle home button click for category selection
    async handleHomeCategoryClick(interaction) {
        // This would likely reset the category selection UI or go back to a main menu
        await interaction.update({
            content: 'Returning to category selection.',
            components: [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('category_selection')
                        .setPlaceholder('Select a category...')
                        .addOptions([
                            { label: 'Gaming', value: 'gaming', emoji: '🎮' },
                            { label: 'Music', value: 'music', emoji: '🎵' },
                            { label: 'Study', value: 'study', emoji: '📚' },
                            { label: 'Social', value: 'social', emoji: '💬' },
                        ])
                ),
                new ButtonBuilder()
                    .setCustomId('home_category')
                    .setLabel('Home')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏠')
            ],
            ephemeral: true
        });
    }
}

module.exports = VoiceManager;
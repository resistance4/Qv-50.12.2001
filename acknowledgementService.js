const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');

class AcknowledgementService {
    constructor() {
        // CDN image URL for all acknowledgement messages
        this.imageURL = 'https://cdn.discordapp.com/attachments/1438520973300338871/1448547405271142481/Gemini_Generated_Image_ws15xkws15xkws15.png? ex=693ba866&is=693a56e6&hm=9af2ef7bc5c8a2fc72f1b83920a7fccaae3c70d384b5a9faa50ac9c1fc6a6c6e&';
        // Unban acknowledgement channel ID - Logs channel
        this. UNBAN_ACK_CHANNEL = '1378464794499092581';
    }

    /**
     * Create acknowledgement embed with Components v2 UI
     * @param {string} text - The acknowledgement message text
     * @param {Object} executor - User object who executed the command
     * @returns {EmbedBuilder} - Formatted embed
     */
    createAcknowledgementEmbed(text, executor) {
        const embed = new EmbedBuilder()
            .setColor('#C8A2C8') // Lilac color
            .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}: T>\n**Executed by:** <@${executor.id}>\n${text}`)
            .setThumbnail(this.imageURL);

        return embed;
    }

    /**
     * Create action row with acknowledgement buttons (Components v2)
     * @returns {ActionRowBuilder} - Action row with buttons
     */
    createAcknowledgementButtons() {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    . setCustomId('ack_confirm')
                    .setLabel('✓ Confirmed')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('ack_info')
                    .setLabel('ℹ️ Info')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('ℹ️'),
                new ButtonBuilder()
                    .setCustomId('ack_dismiss')
                    .setLabel('✕ Dismiss')
                    .setStyle(ButtonStyle. Danger)
                    .setEmoji('❌')
            );

        return row;
    }

    /**
     * Send acknowledgement with Components v2 UI
     * @param {MessageOrInteraction} messageOrInteraction - Message or interaction object
     * @param {string} text - Acknowledgement text
     * @param {string} imageType - Optional image type
     */
    async send(messageOrInteraction, text, imageType = null) {
        // Get the user who executed the command
        const executor = messageOrInteraction.author || messageOrInteraction.user;
        
        // Create embed
        const embed = this.createAcknowledgementEmbed(text, executor);

        // Create Components v2 buttons
        const row = this.createAcknowledgementButtons();

        const options = { 
            embeds: [embed],
            components: [row]  // Add Components v2 action row
        };

        try {
            // For slash command interactions with editReply capability
            if (messageOrInteraction.editReply) {
                return await messageOrInteraction.editReply(options);
            } 
            // For slash command interactions with regular reply
            else if (messageOrInteraction.reply && messageOrInteraction.user) {
                return await messageOrInteraction.reply(options);
            }
            // For text messages - use channel.send
            else if (messageOrInteraction.channel) {
                return await messageOrInteraction.channel.send(options);
            }
        } catch (error) {
            console.error('Error in acknowledgement service send:', error);
            // Fallback to channel send
            try {
                if (messageOrInteraction.channel) {
                    return await messageOrInteraction.channel.send(options);
                }
            } catch (fallbackError) {
                console.error('Fallback acknowledgement send failed:', fallbackError);
            }
        }
    }

    /**
     * Send unban acknowledgement with Components v2 UI
     * @param {Guild} guild - Discord guild
     * @param {User} user - User being unbanned
     * @param {User} executor - User executing the unban
     * @param {string} reason - Unban reason
     */
    async sendUnbanAcknowledgement(guild, user, executor, reason = 'No reason provided') {
        try {
            const unbanChannel = guild.channels.cache.get(this.UNBAN_ACK_CHANNEL);
            if (!unbanChannel) {
                console.error('Unban acknowledgement channel not found');
                return;
            }

            // Create embed for unban acknowledgement
            const embed = new EmbedBuilder()
                .setColor('#C8A2C8')
                .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${executor.id}>\nUser <@${user.id}> (${user.tag}) has been unbanned\n**Reason:** ${reason}`)
                .setThumbnail(this.imageURL);

            // Create Components v2 action row for unban action
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('unban_view_user')
                        .setLabel('👤 View User')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👤'),
                    new ButtonBuilder()
                        .setCustomId('unban_view_executor')
                        .setLabel('👮 View Executor')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👮'),
                    new ButtonBuilder()
                        .setCustomId('unban_logs')
                        .setLabel('📋 View Logs')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📋')
                );

            await unbanChannel.send({ 
                embeds: [embed],
                components: [row]  // Add Components v2 action row for unban
            });
        } catch (error) {
            console.error('Error sending unban acknowledgement:', error);
        }
    }

    /**
     * Create a custom acknowledgement with specific buttons
     * @param {MessageOrInteraction} messageOrInteraction - Message or interaction object
     * @param {string} text - Acknowledgement text
     * @param {Array} customButtons - Array of button configurations
     */
    async sendWithCustomButtons(messageOrInteraction, text, customButtons = []) {
        const executor = messageOrInteraction.author || messageOrInteraction.user;
        const embed = this.createAcknowledgementEmbed(text, executor);

        let row = new ActionRowBuilder();

        if (customButtons && customButtons.length > 0) {
            customButtons.forEach(btnConfig => {
                row. addComponents(
                    new ButtonBuilder()
                        .setCustomId(btnConfig.customId)
                        .setLabel(btnConfig.label)
                        . setStyle(btnConfig.style || ButtonStyle.Primary)
                        .setEmoji(btnConfig. emoji || null)
                );
            });
        } else {
            row = this.createAcknowledgementButtons();
        }

        const options = { 
            embeds: [embed],
            components:  [row]
        };

        try {
            if (messageOrInteraction.editReply) {
                return await messageOrInteraction.editReply(options);
            } 
            else if (messageOrInteraction.reply && messageOrInteraction.user) {
                return await messageOrInteraction.reply(options);
            }
            else if (messageOrInteraction.channel) {
                return await messageOrInteraction.channel.send(options);
            }
        } catch (error) {
            console.error('Error in acknowledgement service sendWithCustomButtons:', error);
            try {
                if (messageOrInteraction.channel) {
                    return await messageOrInteraction.channel.send(options);
                }
            } catch (fallbackError) {
                console.error('Fallback acknowledgement send failed:', fallbackError);
            }
        }
    }

    /**
     * Create interactive acknowledgement with confirmation buttons
     * @param {MessageOrInteraction} messageOrInteraction - Message or interaction object
     * @param {string} title - Confirmation title
     * @param {string} text - Confirmation text
     * @param {Function} onConfirm - Callback when confirmed
     * @param {Function} onCancel - Callback when cancelled
     * @param {number} timeout - Timeout in milliseconds (default: 30000ms)
     */
    async sendConfirmation(messageOrInteraction, title, text, onConfirm, onCancel, timeout = 30000) {
        const executor = messageOrInteraction.author || messageOrInteraction.user;
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700') // Gold color for confirmation
            .setTitle(`🔔 ${title}`)
            .setDescription(`**Are you sure? **\n\n${text}\n\n**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Requested by:** <@${executor.id}>`)
            .setThumbnail(this.imageURL);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_yes')
                    .setLabel('Yes, Confirm')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('confirm_no')
                    .setLabel('No, Cancel')
                    .setStyle(ButtonStyle. Danger)
                    .setEmoji('❌')
            );

        const options = { 
            embeds: [embed],
            components: [row]
        };

        try {
            let message;

            if (messageOrInteraction. editReply) {
                message = await messageOrInteraction.editReply(options);
            } 
            else if (messageOrInteraction.reply && messageOrInteraction.user) {
                message = await messageOrInteraction.reply(options);
            }
            else if (messageOrInteraction.channel) {
                message = await messageOrInteraction.channel.send(options);
            }

            // Create button interaction collector
            const collector = message.createMessageComponentCollector({
                componentType: 'Button',
                time: timeout
            });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.customId === 'confirm_yes') {
                        await interaction.deferUpdate();
                        if (onConfirm) await onConfirm(interaction);
                    } else if (interaction.customId === 'confirm_no') {
                        await interaction.deferUpdate();
                        if (onCancel) await onCancel(interaction);
                    }

                    // Disable buttons after interaction
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('confirm_yes')
                                .setLabel('Yes, Confirm')
                                .setStyle(ButtonStyle. Success)
                                .setEmoji('✅')
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('confirm_no')
                                .setLabel('No, Cancel')
                                .setStyle(ButtonStyle. Danger)
                                .setEmoji('❌')
                                .setDisabled(true)
                        );

                    await message.edit({ components: [disabledRow] });
                    collector.stop();
                } catch (error) {
                    console. error('Error handling confirmation interaction:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const expiredRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                . setCustomId('confirm_yes')
                                .setLabel('Yes, Confirm')
                                . setStyle(ButtonStyle.Success)
                                .setEmoji('✅')
                                .setDisabled(true),
                            new ButtonBuilder()
                                . setCustomId('confirm_no')
                                .setLabel('No, Cancel')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('❌')
                                .setDisabled(true)
                        );

                    try {
                        await message.edit({ 
                            embeds: [embed. setColor('#FF0000').setTitle('❌ Confirmation Expired')],
                            components: [expiredRow]
                        });
                    } catch (error) {
                        console.error('Error updating expired confirmation:', error);
                    }
                }
            });

            return message;
        } catch (error) {
            console.error('Error in confirmation send:', error);
        }
    }
}

module.exports = AcknowledgementService;

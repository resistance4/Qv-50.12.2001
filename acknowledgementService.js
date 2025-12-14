const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

class AcknowledgementService {
    constructor() {
        // CDN image URL for all acknowledgement messages
        this.imageURL = 'https://cdn.discordapp.com/attachments/1438520973300338871/1448547405271142481/Gemini_Generated_Image_ws15xkws15xkws15.png?ex=693ba866&is=693a56e6&hm=9af2ef7bc5c8a2fc72f1b83920a7fccaae3c70d384b5a9faa50ac9c1fc6a6c6e&';
        // Unban acknowledgement channel ID - Logs channel
        this.UNBAN_ACK_CHANNEL = '1378464794499092581';
    }

    /**
     * TEXT DISPLAY BUILDER - Minimal text format with small white line separators
     */
    buildTextDisplay(executor, text) {
        const whiteSeparator = this.buildSeparator('white');
        return `**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${executor.id}>\n${whiteSeparator}\n${text}`;
    }

    /**
     * ACTION ROW BUILDER - Minimal buttons
     */
    buildActionRow(hasReason = false, customId = null) {
        const row = new ActionRowBuilder();
        
        if (hasReason) {
            const reasonButton = new ButtonBuilder()
                .setCustomId(`reason_${customId || Date.now()}`)
                .setLabel('Reason Details')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📝');
            
            row.addComponents(reasonButton);
        }

        return row.components.length > 0 ? row : null;
    }

    /**
     * SEPARATOR BUILDER - Creates small white line separators
     */
    buildSeparator(type = 'white') {
        const separators = {
            'white': '────────────────────────────────',
            'extra-thin': '╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌',
            'dots': '‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧',
            'mini-dash': '﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣﹣',
            'small': '────────────────',
            'tiny': '────────',
            'none': ''
        };
        
        return separators[type] || separators.white;
    }

    /**
     * Create minimal acknowledgement embed with small white separator
     */
    createMinimalAcknowledgement(executor, text, hasReason = false, customId = null) {
        const embed = new EmbedBuilder()
            .setColor('#000000') // Black background
            .setDescription(this.buildTextDisplay(executor, text))
            .setThumbnail(this.imageURL)
            .setTimestamp();

        const components = [];
        const actionRow = this.buildActionRow(hasReason, customId);
        if (actionRow) {
            components.push(actionRow);
        }

        return {
            embeds: [embed],
            components: components
        };
    }

    /**
     * Create reason modal
     */
    createReasonModal(customId, existingReason = '') {
        const modal = new ModalBuilder()
            .setCustomId(`reason_modal_${customId}`)
            .setTitle('Reason Details');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason_input')
            .setLabel('Enter or modify the reason')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Provide reason here...')
            .setValue(existingReason)
            .setMaxLength(1000)
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        return modal;
    }

    /**
     * Send acknowledgement - NO DUPLICATION
     */
    async send(messageOrInteraction, text, options = {}) {
        const {
            ephemeral = false,
            hasReason = false,
            customId = null,
            followUp = false,
            separatorType = 'white'
        } = options;

        const executor = messageOrInteraction.author || messageOrInteraction.user;
        
        // Build custom text with specified separator
        const separator = this.buildSeparator(separatorType);
        const customText = `**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${executor.id}>\n${separator}\n${text}`;
        
        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setDescription(customText)
            .setThumbnail(this.imageURL)
            .setTimestamp();

        const messageData = { embeds: [embed] };

        if (ephemeral) {
            messageData.ephemeral = true;
        }

        // Add buttons if needed
        if (hasReason) {
            const row = new ActionRowBuilder();
            const reasonButton = new ButtonBuilder()
                .setCustomId(`reason_${customId || Date.now()}`)
                .setLabel('Reason Details')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📝');
            
            row.addComponents(reasonButton);
            messageData.components = [row];
        }

        try {
            if (messageOrInteraction.isCommand?.() || messageOrInteraction.isContextMenu?.()) {
                if (followUp) {
                    return await messageOrInteraction.followUp(messageData);
                }
                if (messageOrInteraction.replied || messageOrInteraction.deferred) {
                    return await messageOrInteraction.editReply(messageData);
                }
                return await messageOrInteraction.reply(messageData);
            }
            
            if (messageOrInteraction.isMessageComponent?.() || messageOrInteraction.isModalSubmit?.()) {
                if (messageOrInteraction.replied || messageOrInteraction.deferred) {
                    return await messageOrInteraction.editReply(messageData);
                }
                return await messageOrInteraction.reply(messageData);
            }

            if (messageOrInteraction.author && messageOrInteraction.channel) {
                return await messageOrInteraction.channel.send(messageData);
            }

        } catch (error) {
            console.error('Error in acknowledgement service send:', error.message);
        }
    }

    /**
     * Send unban acknowledgement with small white separator
     */
    async sendUnbanAcknowledgement(guild, user, executor, reason = 'No reason provided') {
        try {
            const unbanChannel = guild.channels.cache.get(this.UNBAN_ACK_CHANNEL);
            if (!unbanChannel) {
                console.error('Unban acknowledgement channel not found');
                return null;
            }

            const whiteSeparator = this.buildSeparator('white');
            const text = `User <@${user.id}> (${user.tag}) has been unbanned\n${whiteSeparator}\n**Reason:** ${reason}`;
            
            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${executor.id}>\n${text}`)
                .setThumbnail(this.imageURL)
                .setTimestamp();

            // Add reason button for unban
            const row = new ActionRowBuilder();
            const reasonButton = new ButtonBuilder()
                .setCustomId(`reason_unban_${user.id}_${Date.now()}`)
                .setLabel('Edit Reason')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📝');

            const profileButton = new ButtonBuilder()
                .setURL(`https://discord.com/users/${user.id}`)
                .setLabel('View Profile')
                .setStyle(ButtonStyle.Link)
                .setEmoji('👤');

            row.addComponents(reasonButton, profileButton);

            return await unbanChannel.send({ 
                embeds: [embed],
                components: [row] 
            });

        } catch (error) {
            console.error('Error sending unban acknowledgement:', error.message);
            return null;
        }
    }

    /**
     * Update reason in existing acknowledgement
     */
    async updateReason(interaction, reason) {
        try {
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            const currentDescription = embed.data.description;
            
            const lines = currentDescription.split('\n');
            const reasonIndex = lines.findIndex(line => line.startsWith('**Reason:**'));
            
            if (reasonIndex !== -1) {
                lines[reasonIndex] = `**Reason:** ${reason}`;
            } else {
                const actionIndex = lines.findIndex(line => line.includes('has been'));
                if (actionIndex !== -1) {
                    // Add white separator before reason
                    const separator = this.buildSeparator('white');
                    lines.splice(actionIndex + 1, 0, separator, `**Reason:** ${reason}`);
                } else {
                    lines.push(`**Reason:** ${reason}`);
                }
            }
            
            embed.setDescription(lines.join('\n'));
            
            await interaction.message.edit({ 
                embeds: [embed],
                components: interaction.message.components
            });
            
            return true;
        } catch (error) {
            console.error('Error updating reason:', error);
            return false;
        }
    }

    /**
     * Send with custom separator type
     */
    async sendWithCustomSeparator(messageOrInteraction, text, separatorType = 'white', options = {}) {
        return this.send(messageOrInteraction, text, {
            ...options,
            separatorType: separatorType
        });
    }

    /**
     * Handle interactions
     */
    async handleInteraction(interaction) {
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;

        const customId = interaction.customId;
        
        // Handle reason button
        if (customId.startsWith('reason_') && !customId.startsWith('reason_modal_')) {
            const originalMessage = interaction.message;
            const embed = originalMessage.embeds[0];
            let existingReason = 'No reason provided';
            
            if (embed && embed.description) {
                const reasonMatch = embed.description.match(/\*\*Reason:\*\*\s*(.+)/);
                if (reasonMatch) {
                    existingReason = reasonMatch[1];
                }
            }
            
            const modal = this.createReasonModal(customId.replace('reason_', ''), existingReason);
            await interaction.showModal(modal);
        }
        
        // Handle modal submission
        else if (customId.startsWith('reason_modal_')) {
            const reason = interaction.fields.getTextInputValue('reason_input');
            
            const success = await this.updateReason(interaction, reason);
            
            if (success) {
                await interaction.reply({
                    content: '✅ Reason updated!',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to update reason.',
                    ephemeral: true
                });
            }
        }
    }
}

module.exports = AcknowledgementService;
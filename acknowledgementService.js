

const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');

class AcknowledgementService {
    constructor() {
        // CDN image URL for all acknowledgement messages
        this.imageURL = 'https://cdn.discordapp.com/attachments/1438520973300338871/1439502581876396103/e1ab3df2-ecb1-4575-8cdb-9faffa77fd29_removalai_preview.png?ex=691ac0c0&is=69196f40&hm=d503106f121b7cb2cc588c9338b8aa9934532aabe4c4814cb56137b27971e3d6&';
        // Unban acknowledgement channel ID - Logs channel
        this.UNBAN_ACK_CHANNEL = '1378464794499092581';
    }

    async send(messageOrInteraction, text, imageType = null) {
        // Get the user who executed the command
        const executor = messageOrInteraction.author || messageOrInteraction.user;
        
        const embed = new EmbedBuilder()
            .setColor('#C8A2C8') // Lilac color
            .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${executor.id}>\n${text}`)
            .setThumbnail(this.imageURL);

        const options = { embeds: [embed] };

        try {
            // For slash command interactions with editReply capability
            if (messageOrInteraction.editReply) {
                return await messageOrInteraction.editReply(options);
            } 
            // For slash command interactions with regular reply
            else if (messageOrInteraction.reply && messageOrInteraction.user) {
                return await messageOrInteraction.reply(options);
            }
            // For text messages - use channel.send instead of reply to avoid message reference issues
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

    async sendUnbanAcknowledgement(guild, user, executor, reason = 'No reason provided') {
        try {
            const unbanChannel = guild.channels.cache.get(this.UNBAN_ACK_CHANNEL);
            if (!unbanChannel) {
                console.error('Unban acknowledgement channel not found');
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#C8A2C8')
                .setDescription(`**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**Executed by:** <@${executor.id}>\nUser <@${user.id}> (${user.tag}) has been unbanned\n**Reason:** ${reason}`)
                .setThumbnail(this.imageURL);

            await unbanChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error sending unban acknowledgement:', error);
        }
    }
}

module.exports = AcknowledgementService;


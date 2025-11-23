# Quarantianizo Discord Bot
## Comprehensive Server Management Bot for discord.gg/scriptspace

### Project Overview
Quarantianizo is a full-featured Discord server management bot featuring 99 slash commands with moderation tools, music streaming, security features, role/channel management, voice controls, and a custom purple theme (#8A00C4 for main, #C8A2C8 for acknowledgements).

### Architecture
- **Platform**: Discord.js with Replit hosting
- **Design Pattern**: All slash commands use ackService.send() for consistent UI (purple theme #C8A2C8)
- **Command Structure**: 99 global commands organized by category (Moderation, Music, Utility, Security, Roles, Channels, Voice, Media, Tickets)
- **Constraint**: No auto-defer to prevent interaction conflicts

### Key Systems

#### 1. Ban Appeal System
- **Category**: "🎫 Ban Appeals" in server 1377670752832192582
- **Channels**: Per-user channels created with appealer's username
- **Flow**: 
  1. User banned → receives DM with appeal options
  2. User clicks "Request Unban" → private channel created
  3. Channel has two buttons: "✅ Unban" and "❌ Ignore"
  4. Unban button → sends server link to user
  5. Ignore button → sends rejection message "Your ban appeal has been rejected by server owner or bot owner"
- **Status Tracking**: pending, processed, ignored
- **Appeal Data Structure**: { userId, guildId, reason, timestamp, status, channelId }

#### 2. NP Role System
- **Purpose**: Enable limited command access for specific roles
- **Commands**: !np, !np status, !np @role, !np remove
- **Restrictions**: NP role users cannot access:
  - Eval mode
  - Server management (roles/channels/media)
  - Moderation (ban/kick/mute/warn)
  - Ticket management
- **Accessibility**: Utility and music commands available to NP roles

#### 3. Acknowledgement Service
- **Color Theme**: #C8A2C8 (acknowledgement), #8A00C4 (main)
- **Format**: Compact, consistent UI for all command responses
- **Usage**: ackService.send() for all command confirmations

#### 4. Security System
- **Commands**: enable, disable, status (compact responses)
- **Features**: Enable all, disable all, view status
- **Display**: Shows enabled/disabled status, punishment type, max violations

#### 5. Ticket System
- **Format**: !ticketopen "title | message | image_url [top/bottom]"
- **Image Positioning**: 
  - top → setThumbnail()
  - bottom → setImage()
- **Channel**: Dedicated channel for ticket management

#### 6. Time Command
- **Format**: !time
- **Timezone**: India Standard Time (IST = UTC+5:30)
- **Display**: 12-hour format, centered time, smaller date/timezone info

### Recent Implementation (Nov 23, 2025)
- Enhanced ban appeal system with dedicated category and per-user channels
- Added "Unban" and "Ignore" buttons in appeal channels
- Unban button sends server invite link to appealer
- Ignore button sends rejection notification
- Appeal channels created in category "🎫 Ban Appeals" (server 1377670752832192582)

### Bot Configuration
- **Owner ID**: 1327564898460242015
- **Appeal Server**: 1377670752832192582
- **Appeal Channel**: 1378464794499092581 (legacy)
- **Target Guild**: discord.gg/scriptspace
- **Status**: Watching scriptspace Made by script.agi

### Platform Constraints
- Replit blocks UDP connections (prevents canvas/image generation)
- No system libraries for advanced graphics
- Memory limits affect large data operations
- Stability priority over feature complexity

### File Structure
```
index.js                      Main bot file (14k+ lines)
acknowledgementService.js     Purple theme UI service
slashCommandHandler.js        Slash command registration
ticketManagement.js          Ticket system
securityManager.js           Security commands
channelManagement.js         Channel operations
commands.js                  Command definitions
```

### Active Commands (99 total)
- Role Management: 15 commands
- Channel Management: 12 commands
- Media & Threads: 10 commands
- Utility: 18 commands
- Security: 8 commands
- Tickets: 6 commands
- Moderation: 20+ commands
- Music: Various
- Voice: Various
- Others: NP mode, help, stats, etc.

### Next Steps for Future Development
- Add web dashboard for appeal management
- Implement persistent appeal tracking
- Add appeal expiration dates
- Create appeal statistics/metrics
- Multi-language support

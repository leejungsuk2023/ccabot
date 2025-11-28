// Documentation only. No exports.

/**
 * Firestore collections (new + legacy)
 *
 * 1) sessions (docId = userId)
 * {
 *   userId: string,
 *   userChatId: string,
 *   mode: 'AI_MODE' | 'HUMAN_MODE',
 *   intentState: string, // Intent State Machine current state, default 'IDLE'
 *   bookingState: {
 *     step: 'awaiting_time' | 'awaiting_info' | 'confirmed',
 *     proposedTime?: string, // ISO 8601
 *     selectedTime?: string, // ISO 8601
 *     customerName?: string
 *   },
 *   lastUpdatedAt: timestamp,
 *   conversationSummary?: string
 * }
 *
 * 2) outboundMessages (legacy anti-echo)
 * 3) pendingBookings (legacy) – left intact for backward compatibility
 * 4) sessionModes (legacy) – replaced by sessions.mode in new flows
 * 5) conversations – chat logs
 * 6) knowledge_base – unchanged
 */



import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

/** One field event for the office (`InboxItem` in tkt-core). */
export interface InboxItem {
  id: string
  /** `message.reply` (a technician answered), `job.declined` or `job.extra` (an extra was added in the field). */
  type: 'message.reply' | 'job.declined' | 'job.extra' | string
  summary: string
  /** ISO instant. */
  created: string
  /** Who did it: for a reply, the technician whose conversation it is. */
  userId: string
  userName?: string | null
  /** Null for a reply, and once the work order has been deleted. */
  workOrderId?: string | null
  workOrderNum?: string | null
  propertyName?: string | null
  unit?: string | null
  /** Newer than the last time this user opened the inbox. */
  unread: boolean
}

class InboxService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  /** The latest events, newest first (`GET /inbox`). Admin, Super Admin or Dispatcher. */
  async items(limit = 30): Promise<InboxItem[]> {
    const payload = await this.data<InboxItem[] | null>(await this.get(`/inbox?limit=${limit}`), 'Couldn’t load the inbox.')
    return Array.isArray(payload) ? payload : []
  }

  /** How many events are unread for the signed-in user, for the badge. */
  async unread(): Promise<number> {
    const payload = await this.data<{ unread?: number } | null>(await this.get('/inbox/unread'), 'Couldn’t load the inbox.')
    return payload?.unread ?? 0
  }

  /** Marks everything as read for the signed-in user. */
  async markRead(): Promise<void> {
    const response = await this.post('/inbox/read')
    if (!response.ok) throw new Error(await this.errorMessage(response, 'Couldn’t mark the inbox as read.'))
  }
}

export { InboxService }
export const inboxService = new InboxService(auth)

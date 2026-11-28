import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

/** A person on a message (only the fields the client reads). */
export interface MessageAuthor {
  id: string
  firstName?: string | null
  lastName?: string | null
}

export interface MessageAttachment {
  id: string
  /** The stored file's URL. */
  data: string
  created?: number | string | null
}

/** One message of the conversation with a user (`Message` in tkt-core). */
export interface Message {
  id: string
  /** The user the conversation is with. */
  userId: string
  author: MessageAuthor | null
  /** Set when the message is about a job; tkt-core then also copies it into that job's notes and attachments. */
  jobId?: string | null
  jobNum?: string | null
  data: string
  /** Epoch milliseconds. */
  created: number | string
  attachments: MessageAttachment[]
}

/** How many messages of a conversation are loaded at a time. */
export const PAGE_SIZE = 30

/** An open job a message can be about. */
export interface JobChoice {
  id: string
  num: string | null
  propertyName: string | null
  unit: string | null
  status: string | null
}

class MessageService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  /**
   * A page of the conversation with a user, oldest first (`GET /users/{id}/messages`): the latest messages, or with
   * `before` (a message id) the ones older than it. Admin, Super Admin or Dispatcher.
   */
  async thread(userId: string, before?: string): Promise<Message[]> {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (before) query.set('before', before)
    const payload = await this.data<Message[] | null>(await this.get(`/users/${userId}/messages?${query}`), 'Couldn’t load the messages.')
    return Array.isArray(payload) ? payload : []
  }

  /** The user's open jobs, for choosing what a message is about. */
  async jobs(userId: string): Promise<JobChoice[]> {
    const payload = await this.data<JobChoice[] | null>(await this.get(`/users/${userId}/messages/jobs`), 'Couldn’t load the user’s jobs.')
    return Array.isArray(payload) ? payload : []
  }

  /** Writes to a user, then sends the images one by one. A message about a job also lands in the job's notes and attachments. */
  async send(userId: string, text: string, jobId: string | null, images: File[]): Promise<Message> {
    let message = await this.data<Message>(
      await this.post(`/users/${userId}/messages`, { data: text.trim(), jobId: jobId || undefined }),
      'Couldn’t send the message.',
    )
    for (const image of images) {
      const form = new FormData()
      form.append('file', image)
      try {
        message = await this.data<Message>(await this.post(`/users/${userId}/messages/${message.id}/attachments`, form), 'Couldn’t send a photo.')
      } catch (reason) {
        const detail = reason instanceof Error ? reason.message : 'Couldn’t send a photo.'
        throw new Error(`Your message was sent, but a photo could not be: ${detail}`)
      }
    }
    return message
  }
}

export { MessageService }
export const messageService = new MessageService(auth)

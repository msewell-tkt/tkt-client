import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

export interface Session {
  id: string,
  email: string,
  tid: string,
  tenantName: string,
  firstName: string,
  lastName: string,
  roles: string[],
  activeProperties: number,
  activePropertiesThisMonth: number,
  openJobs: number,
  completedJobsThisWeek: number,
}

export interface Property {
  id: string | null,
  name: string,
  description: string,
  address1: string,
  address2: string,
  city: string,
  state: string,
  postalCode: string,
  phone: string,
  requiresApproval: boolean,
  securityCode: string,
  image: string,
  archived: boolean,
}

export interface ServiceItem {
  id: string
  name: string
  detail: string
  enabled: boolean
}

export interface Contact {
  id: string
  name: string
  email: string
  phone: string
  primary: boolean
}

export interface Image {
  id: string
  name: string
  url: string
  primary: boolean
}

export interface PropertyView {
  properties: Property[],
  activeProperties: number,
  propertyContacts: number
}

class SessionService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  getDashboard(): Promise<Response> {
    return this.get('/api/dashboard')
  }

  getProperties(): Promise<Response> {
    return this.get('/api/properties')
  }

  updateProperty(property: Property) {
    return this.post(`/api/properties`, property);
  }
}

export { SessionService }
export const sessionService = new SessionService(auth)

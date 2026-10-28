import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

/** A property contact. The API stores contacts as users (`User` in tkt-core). */
export interface Contact {
  id: string | null
  email: string
  firstName: string
  lastName: string
  phone: string
}

export interface ServiceItem {
  id: string | null
  name: string
  cost: number | null
  list: number | null
  extra: boolean
  /** True when the item is available to every property of the tenant rather than one property. */
  global?: boolean
}

/** A property resource; today the client uses these as image URLs. */
export interface PropertyResource {
  id: string | null
  resource: string
}

export interface Property {
  id: string | null
  name: string
  description: string
  address1: string
  address2: string
  city: string
  state: string
  postalCode: string
  phone: string
  requiresApproval: boolean
  securityCode: string
  primaryContact: Contact | null
  image: string
  archived: boolean
}

export interface PropertyView {
  properties: Property[]
  activeProperties: number
  propertyContacts: number
}

class PropertyService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  async list(): Promise<PropertyView> {
    const payload = await this.data<Partial<PropertyView> | null>(
      await this.get('/api/properties'),
      'Couldn’t load properties.',
    )
    return {
      properties: Array.isArray(payload?.properties) ? payload.properties : [],
      activeProperties: payload?.activeProperties ?? 0,
      propertyContacts: payload?.propertyContacts ?? 0,
    }
  }

  /** Creates the property when `id` is null, otherwise updates it. */
  async save(property: Property): Promise<Property> {
    return this.data<Property>(await this.post('/api/properties', property), 'Unable to save the property.')
  }

  async contacts(propertyId: string): Promise<Contact[]> {
    return this.fetchList(`/api/properties/${propertyId}/contacts`, 'Couldn’t load contacts.')
  }

  async saveContact(propertyId: string, contact: Contact): Promise<Contact> {
    return this.data<Contact>(
      await this.post(`/api/properties/${propertyId}/contacts`, contact),
      'Unable to save the contact.',
    )
  }

  async serviceItems(propertyId: string): Promise<ServiceItem[]> {
    return this.fetchList(`/api/properties/${propertyId}/service-items`, 'Couldn’t load service items.')
  }

  /** The property's own service items plus the tenant's global ones: what a job at the property can use. */
  async availableServiceItems(propertyId: string): Promise<ServiceItem[]> {
    return this.fetchList(`/api/properties/${propertyId}/available-service-items`, 'Couldn’t load service items.')
  }

  /** Service items available to every property of the tenant. */
  async globalServiceItems(): Promise<ServiceItem[]> {
    return this.fetchList('/api/service-items', 'Couldn’t load global service items.')
  }

  async saveGlobalServiceItem(item: ServiceItem): Promise<ServiceItem> {
    return this.data<ServiceItem>(await this.post('/api/service-items', item), 'Unable to save the service item.')
  }

  async saveServiceItem(propertyId: string, item: ServiceItem): Promise<ServiceItem> {
    return this.data<ServiceItem>(
      await this.post(`/api/properties/${propertyId}/service-items`, item),
      'Unable to save the service item.',
    )
  }

  async resources(propertyId: string): Promise<PropertyResource[]> {
    return this.fetchList(`/api/properties/${propertyId}/resources`, 'Couldn’t load images.')
  }

  async saveResource(propertyId: string, resource: PropertyResource): Promise<PropertyResource> {
    return this.data<PropertyResource>(
      await this.post(`/api/properties/${propertyId}/resources`, resource),
      'Unable to save the image.',
    )
  }

  private async fetchList<T>(path: string, fallback: string): Promise<T[]> {
    const payload = await this.data<T[] | null>(await this.get(path), fallback)
    return Array.isArray(payload) ? payload : []
  }
}

export { PropertyService }
export const propertyService = new PropertyService(auth)

import { ref } from 'vue'

export type UserStatus = 'Active' | 'Invited' | 'Inactive'
export type UserRole = 'Admin' | 'Property' | 'QA' | 'Technician' | 'Dispatcher'

export interface UserActivity {
  id: number
  icon: string
  title: string
  detail: string
  timestamp: string
}

export interface UserRecord {
  id: number
  name: string
  email: string
  phone: string
  role: UserRole
  status: UserStatus
  title: string
  initials: string
  color: string
  lastActive: string
  joined: string
  properties: string[]
  permissions: string[]
  activity: UserActivity[]
}

const defaultPermissions: Record<UserRole, string[]> = {
  Admin: ['Manage users', 'Manage properties', 'Manage work orders', 'View financials'],
  QA: ['Manage properties', 'Manage work orders', 'View financials'],
  Property: ['Manage work orders', 'Manage properties'],
  Technician: ['Update assigned work', 'Upload attachments'],
  Dispatcher: ['Manage work orders', 'Manage work orders'],
}

function activity(id: number, name: string): UserActivity[] {
  return [
    { id: id * 10 + 1, icon: 'pi pi-check-circle', title: 'Completed a work order', detail: `${name} marked a service visit complete.`, timestamp: 'Today, 10:42 AM' },
    { id: id * 10 + 2, icon: 'pi pi-calendar', title: 'Updated the schedule', detail: 'Changed an assignment for Ansley Forest.', timestamp: 'Yesterday, 3:18 PM' },
    { id: id * 10 + 3, icon: 'pi pi-sign-in', title: 'Signed in', detail: 'Signed in from Atlanta, Georgia.', timestamp: 'Oct 6, 8:04 AM' },
  ]
}

function user(id: number, name: string, email: string, phone: string, role: UserRole, status: UserStatus, title: string, color: string, lastActive: string, properties: string[]): UserRecord {
  return {
    id, name, email, phone, role, status, title, color, lastActive, properties,
    initials: name.split(' ').map((part) => part[0]).slice(0, 2).join(''),
    joined: `202${id % 4 + 2}-0${id % 8 + 1}-${String(id + 8).padStart(2, '0')}`,
    permissions: [...defaultPermissions[role]],
    activity: activity(id, name),
  }
}

export const users = ref<UserRecord[]>([
  user(1, 'Barbara Smrecak', 'barbara@turnkeytracker.com', '(404) 555-0102', 'Admin', 'Active', 'Operations Director', '#5962d8', 'Just now', ['All properties']),
  user(2, 'Reyna Cardenas', 'reyna@turnkeytracker.com', '(470) 555-0147', 'Admin', 'Active', 'Regional Manager', '#0f9279', '12 min ago', ['Ansley Forest', 'Auden Apartments', 'Avonlea Westside']),
  user(3, 'Marcus Hill', 'marcus@turnkeytracker.com', '(678) 555-0163', 'Technician', 'Active', 'Lead Technician', '#b87417', '1 hr ago', ['Ansley Forest', 'Emmi Midtown']),
  user(4, 'Tanya Brooks', 'tanya@turnkeytracker.com', '(770) 555-0119', 'QA', 'Active', 'Service Coordinator', '#a04f80', '3 hrs ago', ['Dagney Apartments', 'District at Parkview']),
  user(5, 'Devon Price', 'devon@turnkeytracker.com', '(404) 555-0188', 'Technician', 'Active', 'Paint Technician', '#34789b', 'Yesterday', ['Avonlea Westside', 'Gentry Buckhead']),
  user(6, 'Avery Johnson', 'avery@turnkeytracker.com', '(470) 555-0125', 'Admin', 'Invited', 'Scheduling Coordinator', '#7656a8', 'Invite pending', ['Link Apartments Canvas']),
  user(7, 'Nina Patel', 'nina@turnkeytracker.com', '(678) 555-0194', 'Admin', 'Inactive', 'Former Area Manager', '#687386', 'Sep 18', ['Local Sugar Hill']),
])

export const userRoles: UserRole[] = ['Admin', 'QA', 'Dispatcher', 'Technician']
export const userStatuses: UserStatus[] = ['Active', 'Invited', 'Inactive']
export const permissionOptions = ['Manage users', 'Manage properties', 'Manage work orders', 'View financials', 'Update assigned work', 'Upload attachments']
export const propertyOptions = ['All properties', 'Ansley Forest', 'Auden Apartments', 'Avonlea Westside', 'Dagney Apartments', 'District at Parkview', 'Emmi Midtown', 'Gentry Buckhead', 'Link Apartments Canvas', 'Local Sugar Hill']

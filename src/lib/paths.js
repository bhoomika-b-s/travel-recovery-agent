// Where each role lands after login.
export function homePathFor(profile) {
  return profile?.role === 'staff' ? '/staff' : '/passenger'
}
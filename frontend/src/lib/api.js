const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/v1'

function getInviteCode() {
  return localStorage.getItem('inviteCode') || ''
}

export function setInviteCode(code) {
  localStorage.setItem('inviteCode', code)
}

export function getStoredGroupId() {
  return localStorage.getItem('groupId') || null
}

export function setStoredGroupId(id) {
  localStorage.setItem('groupId', id)
}

export function getStoredMemberId() {
  return localStorage.getItem('memberId') || null
}

export function setStoredMemberId(id) {
  localStorage.setItem('memberId', id)
}

export function clearSession() {
  localStorage.removeItem('inviteCode')
  localStorage.removeItem('groupId')
  localStorage.removeItem('memberId')
  localStorage.removeItem('memberName')
}

async function request(path, options = {}, retries = 2) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  const inviteCode = getInviteCode()
  if (inviteCode) {
    headers['X-Invite-Code'] = inviteCode
  }

  const config = {
    ...options,
    headers
  }

  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, config)

      if (response.status === 429) {
        // Rate limited — wait and retry
        await sleep(1000 * (attempt + 1))
        continue
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const err = new Error(errorBody?.error?.message || `Error ${response.status}`)
        err.status = response.status
        err.code = errorBody?.error?.code || 'UNKNOWN'
        throw err
      }

      return response.status === 204 ? null : await response.json()
    } catch (err) {
      lastError = err
      // Don't retry client errors (4xx) except 429
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err
      }
      // Network error or 5xx — retry
      if (attempt < retries) {
        await sleep(500 * (attempt + 1))
      }
    }
  }
  throw lastError
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- API Methods ---

export async function createGroup({ name, goalAmount, targetDate, creatorName }) {
  return request('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, goalAmount, targetDate, creatorName })
  })
}

export async function getProgress(groupId) {
  return request(`/groups/${groupId}/progress`)
}

export async function addMember(groupId, name) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ name }),
    headers
  })
}

/** Get the manager/creator token for a group (checks both new and legacy keys) */
export function getManagerToken(groupId) {
  return localStorage.getItem(`manager_token_${groupId}`) || localStorage.getItem(`creator_token_${groupId}`) || null
}

/** Store manager token for a group */
export function setManagerToken(groupId, token) {
  localStorage.setItem(`manager_token_${groupId}`, token)
}

// Legacy aliases for backward compat
export function getCreatorToken(groupId) {
  return getManagerToken(groupId)
}

export function setCreatorToken(groupId, token) {
  setManagerToken(groupId, token)
}

export async function listMembers(groupId) {
  return request(`/groups/${groupId}/members`)
}

export async function registerContribution(groupId, { memberId, amount, date, idempotencyKey, receiptImageUrl }) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/contributions`, {
    method: 'POST',
    body: JSON.stringify({ memberId, amount, date, idempotencyKey, receiptImageUrl }),
    headers
  })
}

export async function listContributions(groupId, limit = 50, lastKey = null) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (lastKey) params.set('lastKey', lastKey)
  return request(`/groups/${groupId}/contributions?${params}`)
}

export function generateIdempotencyKey() {
  return crypto.randomUUID()
}

export async function lookupGroupByCode(code) {
  // Temporarily set the invite code for this request
  const prev = localStorage.getItem('inviteCode')
  localStorage.setItem('inviteCode', code)
  try {
    const result = await request('/groups/lookup')
    return result.groupId
  } finally {
    if (prev) localStorage.setItem('inviteCode', prev)
    else localStorage.removeItem('inviteCode')
  }
}

// --- Loan API Methods ---

export async function listLoans(groupId) {
  return request(`/groups/${groupId}/loans`)
}

export async function createLoan(groupId, { memberId, amount, dateIssued, notes }) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/loans`, {
    method: 'POST',
    body: JSON.stringify({ memberId, amount, dateIssued, notes }),
    headers
  })
}

export async function registerRepayment(groupId, loanId, { amount, date }) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/loans/${loanId}/repayments`, {
    method: 'POST',
    body: JSON.stringify({ amount, date }),
    headers
  })
}

// --- Manager API Methods ---

export async function createManagerInvite(groupId) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/managers/invite`, {
    method: 'POST',
    headers
  })
}

export async function acceptManagerInvite(groupId, inviteToken, name) {
  return request(`/groups/${groupId}/managers/accept`, {
    method: 'POST',
    body: JSON.stringify({ inviteToken, name })
  })
}

export async function removeMember(groupId, memberId) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/members/${memberId}`, {
    method: 'DELETE',
    headers
  })
}

export async function deleteContribution(groupId, contributionId) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/contributions/${contributionId}`, {
    method: 'DELETE',
    headers
  })
}

export async function updateContribution(groupId, contributionId, { amount, date, receiptImageUrl }) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/contributions/${contributionId}`, {
    method: 'PUT',
    body: JSON.stringify({ amount, date, receiptImageUrl }),
    headers
  })
}

export async function updateMember(groupId, memberId, name) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/members/${memberId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
    headers
  })
}

export async function removeMemberWithOptions(groupId, memberId, deleteContributions = false) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/members/${memberId}?deleteContributions=${deleteContributions}`, {
    method: 'DELETE',
    headers
  })
}

export async function getPresignedUrl(groupId, contentType) {
  const headers = { 'X-Group-Id': groupId }
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request('/uploads/presigned-url', {
    method: 'POST',
    body: JSON.stringify({ contentType }),
    headers
  })
}

export async function verifyManager(groupId) {
  const headers = {}
  const token = getManagerToken(groupId)
  if (token) {
    headers['X-Manager-Token'] = token
  }
  return request(`/groups/${groupId}/managers/verify`, {
    method: 'GET',
    headers
  })
}

// --- Recent Groups (localStorage persistence) ---

const RECENT_GROUPS_KEY = 'recent_groups'

export function getRecentGroups() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_GROUPS_KEY) || '[]')
  } catch { return [] }
}

export function addRecentGroup(groupId, groupName, role) {
  const inviteCode = localStorage.getItem('inviteCode') || ''
  const groups = getRecentGroups().filter(g => g.groupId !== groupId)
  groups.unshift({ groupId, groupName, role, inviteCode, updatedAt: Date.now() })
  localStorage.setItem(RECENT_GROUPS_KEY, JSON.stringify(groups.slice(0, 10)))
}

export function removeRecentGroup(groupId) {
  const groups = getRecentGroups().filter(g => g.groupId !== groupId)
  localStorage.setItem(RECENT_GROUPS_KEY, JSON.stringify(groups))
}

export function logoutGroup(groupId) {
  // Soft logout: only clear the active groupId context, NOT the token.
  // Token persists so "Retomar tu grupo" can restore full manager access.
  localStorage.removeItem('groupId')
}

export function forgetGroup(groupId) {
  // Hard logout: removes ALL local data for this group.
  // User will need the downloaded token file to recover access.
  localStorage.removeItem(`manager_token_${groupId}`)
  localStorage.removeItem(`creator_token_${groupId}`)
  localStorage.removeItem('groupId')
  removeRecentGroup(groupId)
}

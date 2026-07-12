const FILE_NAME = "video-notes-backup.json"
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

async function getToken(interactive = false): Promise<string | null> {
  try {
    const result = await chrome.identity.getAuthToken({ interactive })
    return result.token || null
  } catch {
    return null
  }
}

async function getUserEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.email || null
  } catch {
    return null
  }
}

async function findExistingFile(
  token: string
): Promise<{ id: string; modifiedTime: string } | null> {
  const url = `${DRIVE_FILES_URL}?q=name='${FILE_NAME}'&fields=files(id,modifiedTime)`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.files?.[0] || null
}

export async function uploadBackup(
  jsonData: string
): Promise<{ success: boolean; error?: string }> {
  console.log("[DriveSync] uploadBackup start, data length:", jsonData.length)
  const token = await getToken(true)
  if (!token) {
    console.log("[DriveSync] uploadBackup: no token")
    return { success: false, error: "Auth failed" }
  }

  try {
    const existing = await findExistingFile(token)
    console.log("[DriveSync] existing file:", existing?.id || "none")

    if (existing) {
      const res = await fetch(
        `${DRIVE_UPLOAD_URL}/${existing.id}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: jsonData
        }
      )
      console.log("[DriveSync] PATCH result:", res.status)
      return { success: res.ok }
    }

    const metadata = {
      name: FILE_NAME
    }
    const form = new FormData()
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    )
    form.append("file", new Blob([jsonData], { type: "application/json" }))
    const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form
    })
    console.log("[DriveSync] create result:", res.status)
    return { success: res.ok }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function downloadBackup(): Promise<{
  data: string | null
  modifiedTime?: string
  error?: string
}> {
  const token = await getToken(true)
  if (!token) return { data: null, error: "Auth failed" }

  try {
    const existing = await findExistingFile(token)
    console.log("[DriveSync] downloadBackup: found file?", !!existing)
    if (!existing) return { data: null }

    const res = await fetch(`${DRIVE_FILES_URL}/${existing.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    console.log("[DriveSync] download result:", res.status)
    if (!res.ok) return { data: null, error: `Download failed: ${res.status}` }

    const data = await res.text()
    console.log("[DriveSync] downloaded data length:", data.length)
    return { data, modifiedTime: existing.modifiedTime }
  } catch (e: any) {
    return { data: null, error: e.message }
  }
}

export async function getSyncStatus(): Promise<{
  lastModified?: string
  email?: string
  error?: string
}> {
  const token = await getToken(true)
  if (!token) return { error: "Not authenticated" }

  try {
    const [existing, email] = await Promise.all([
      findExistingFile(token),
      getUserEmail(token)
    ])
    return {
      lastModified: existing?.modifiedTime,
      email: email || undefined
    }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function signOut(): Promise<void> {
  try {
    const token = await getToken(false)
    if (token) {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
    }
  } catch {
    // ignore
  }
  try {
    await chrome.identity.clearAllCachedAuthTokens()
  } catch {
    // ignore
  }
}

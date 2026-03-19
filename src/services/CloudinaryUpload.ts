// ── Cloudinary upload helper ─────────────────────────────────────────────────
// Uploads a File object to the backend /api/upload endpoint (which proxies to
// Cloudinary). Returns the secure CDN URL on success, or throws on failure.

const API = process.env.REACT_APP_API_URL || "https://adaptable-patience-production-45da.up.railway.app";

export async function uploadToCloudinary(
  file: File,
  folder = "roswalt/attachments",
  onProgress?: (pct: number) => void
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/upload`);

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success && data.url) resolve(data.url);
          else reject(new Error(data.message || "Upload failed"));
        } catch { reject(new Error("Invalid response from upload server")); }
      } else {
        reject(new Error(`Upload failed (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

// Upload multiple files, returns array of CDN URLs
export async function uploadFilesToCloudinary(
  files: File[],
  folder = "roswalt/attachments",
  onEachProgress?: (index: number, pct: number) => void
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadToCloudinary(
      files[i],
      folder,
      onEachProgress ? (pct) => onEachProgress(i, pct) : undefined
    );
    urls.push(url);
  }
  return urls;
}

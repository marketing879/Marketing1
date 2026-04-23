import React, { useState, useEffect } from "react";
import { Upload, X, Download, File, AlertCircle } from "lucide-react";

interface Attachment {
  fileName: string;
  originalName: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  path: string;
}

interface AttachmentUploadProps {
  taskId: string;
  onUploadSuccess?: (attachment: Attachment) => void;
  readOnly?: boolean;
}

const BACKEND_API = process.env.REACT_APP_API_URL || "https://api.roswaltsmartcue.com";

const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
  taskId,
  onUploadSuccess,
  readOnly = false
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load attachments
  useEffect(() => {
    if (taskId && taskId !== "new") {
      loadAttachments();
    } else {
      setLoading(false);
    }
  }, [taskId]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadAttachments = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${BACKEND_API}/api/tasks/${taskId}/attachments`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setAttachments(Array.isArray(data) ? data : []);
      } else {
        const rawText = await response.text();
        console.error("Failed to load attachments:", response.status, rawText);
        setError(`Failed to load attachments (${response.status})`);
      }
    } catch (err) {
      console.error("Failed to load attachments:", err);
      setError("Failed to load attachments");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !taskId) return;

    const fileArray = Array.from(files);

    for (const file of fileArray) {
      // Validate file size (2GB limit - Cloudflare Premium)
      if (file.size > 2048 * 1024 * 1024) {
        setError(`File "${file.name}" is too large (max 2GB)`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      setUploading(true);
      setError(null);

      try {
        const response = await fetch(
          `${BACKEND_API}/api/tasks/${taskId}/attachments`,
          {
            method: "POST",
            body: formData,
            headers: {
              // NOTE: Do NOT set Content-Type — browser sets it automatically
              // with the correct multipart boundary for FormData.
              ...getAuthHeaders(),
            },
          }
        );

        if (!response.ok) {
          // Capture raw text first so we never lose the real error message,
          // even if the server returns HTML instead of JSON.
          const rawText = await response.text();
          let errorMsg = `Upload failed (${response.status} ${response.statusText})`;
          try {
            const errorData = JSON.parse(rawText);
            errorMsg = errorData.error || errorData.message || errorMsg;
          } catch {
            // Server returned HTML or plain text — log for debugging
            console.error("Server error response:", rawText);
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const newAttachment = data.attachment;

        // FIX: Use functional updater to avoid stale closure when uploading
        // multiple files in a single batch — each update sees the latest state.
        setAttachments(prev => [...prev, newAttachment]);
        onUploadSuccess?.(newAttachment);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Upload failed";
        setError(`Failed to upload ${file.name}: ${errorMsg}`);
        console.error(err);
      } finally {
        setUploading(false);
      }
    }

    // Reset input so the same file can be re-uploaded if needed
    event.target.value = "";
  };

  const handleDelete = async (fileName: string) => {
    if (!window.confirm("Delete this attachment?")) return;

    try {
      const response = await fetch(
        `${BACKEND_API}/api/tasks/${taskId}/attachments/${fileName}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const rawText = await response.text();
        let errorMsg = `Delete failed (${response.status})`;
        try {
          const errorData = JSON.parse(rawText);
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch {
          console.error("Server error response:", rawText);
        }
        throw new Error(errorMsg);
      }

      setAttachments(prev => prev.filter(a => a.fileName !== fileName));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete attachment";
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement("a");
    link.href = `${BACKEND_API}${attachment.path}`;
    link.download = attachment.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading) {
    return (
      <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Loading attachments...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, borderTop: "1px solid #e2e8f0" }}>
      {/* Upload Section */}
      {!readOnly && taskId && taskId !== "new" && (
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              background: "#0ea5e9",
              color: "#fff",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              transition: "all 0.3s ease",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLLabelElement;
              el.style.background = "#0284c7";
              el.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLLabelElement;
              el.style.background = "#0ea5e9";
              el.style.transform = "translateY(0)";
            }}
          >
            <Upload size={16} />
            {uploading ? "Uploading..." : "Upload File"}
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: "none" }}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />
          </label>
          {uploading && (
            <span style={{ marginLeft: 12, color: "#64748b", fontSize: 12, fontWeight: 600 }}>
              Uploading...
            </span>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: 12,
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            marginBottom: 16,
            color: "#dc2626",
            fontSize: 12,
            alignItems: "flex-start",
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              color: "#dc2626",
              cursor: "pointer",
              padding: 0,
              marginLeft: "auto",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 ? (
        <div>
          <h4
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1e293b",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 12px 0",
            }}
          >
            Attachments ({attachments.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {attachments.map((att) => (
              <div
                key={att.fileName}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = "#f1f5f9";
                  el.style.borderColor = "#cbd5e1";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = "#fff";
                  el.style.borderColor = "#e2e8f0";
                }}
              >
                <File size={16} color="#0ea5e9" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#1e293b",
                      margin: "0 0 4px 0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {att.originalName}
                  </p>
                  <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>
                    {formatFileSize(att.size)} • {new Date(att.uploadedAt).toLocaleDateString()} •{" "}
                    {att.uploadedBy}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(att);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0ea5e9",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.color = "#0284c7";
                    el.style.transform = "scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.color = "#0ea5e9";
                    el.style.transform = "scale(1)";
                  }}
                  title="Download"
                >
                  <Download size={16} />
                </button>
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(att.fileName);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      transition: "all 0.2s",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.color = "#94a3b8";
                    }}
                    title="Delete"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", margin: 0 }}>
          {taskId === "new" ? "Create task first to add attachments" : "No attachments yet"}
        </p>
      )}
    </div>
  );
};

export default AttachmentUpload;
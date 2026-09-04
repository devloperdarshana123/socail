// client/src/lib/services/cloudinaryUpload.js
//
// Signed Cloudinary uploads — replaces the old unsigned `upload_preset` flow.
// The signature is minted server-side (per request, short-lived) so an
// attacker reading the network tab can't reuse it to upload arbitrary files
// against our account/quota the way an unsigned preset name could be.
import api from "./api";

export async function getUploadSignature(folder) {
  const { data } = await api.get("/uploads/signature", { params: { folder } });
  return data; // { signature, timestamp, folder, apiKey, cloudName }
}

/**
 * @param {File} file
 * @param {object} opts
 * @param {string} opts.folder        - must be one of the server's ALLOWED_FOLDERS
 * @param {string} [opts.resourceType] - "auto" | "image" | "video"
 * @param {(pct:number)=>void} [opts.onProgress]
 */
export function uploadToCloudinarySigned(file, { folder, resourceType = "auto", onProgress } = {}) {
  return new Promise((resolve, reject) => {
    getUploadSignature(folder)
      .then((sig) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("api_key", sig.apiKey);
        fd.append("timestamp", sig.timestamp);
        fd.append("signature", sig.signature);
        fd.append("folder", sig.folder);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));

        xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`);
        xhr.send(fd);
      })
      .catch(reject);
  });
}

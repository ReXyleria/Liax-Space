export type UploadProgressState = {
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  filename: string;
  message: string;
};

export type UploadResponse = {
  ok: boolean;
  message?: string;
  asset?: {
    url: string;
  };
};

export function emptyUploadProgress(): UploadProgressState {
  return {
    status: "idle",
    progress: 0,
    filename: "",
    message: ""
  };
}

export function uploadImageFile(
  file: File,
  onProgress: (state: UploadProgressState) => void
): Promise<UploadResponse> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    onProgress({
      status: "uploading",
      progress: 0,
      filename: file.name,
      message: "Preparing upload..."
    });

    xhr.upload.onprogress = (event) => {
      const progress = event.lengthComputable && event.total > 0
        ? Math.min(99, Math.round((event.loaded / event.total) * 100))
        : 0;

      onProgress({
        status: "uploading",
        progress,
        filename: file.name,
        message: progress ? `Uploading ${progress}%` : "Uploading..."
      });
    };

    xhr.onload = () => {
      let result: UploadResponse = { ok: false, message: "Upload failed." };
      try {
        result = JSON.parse(xhr.responseText || "{}") as UploadResponse;
      } catch {
        result = { ok: false, message: "The server returned an invalid upload response." };
      }

      if (xhr.status >= 200 && xhr.status < 300 && result.ok && result.asset?.url) {
        onProgress({
          status: "success",
          progress: 100,
          filename: file.name,
          message: "Upload complete."
        });
        resolve(result);
        return;
      }

      onProgress({
        status: "error",
        progress: 100,
        filename: file.name,
        message: result.message || "Upload failed."
      });
      resolve({ ...result, ok: false, message: result.message || "Upload failed." });
    };

    xhr.onerror = () => {
      const result = { ok: false, message: "Network error while uploading." };
      onProgress({
        status: "error",
        progress: 100,
        filename: file.name,
        message: result.message
      });
      resolve(result);
    };

    xhr.onabort = () => {
      const result = { ok: false, message: "Upload cancelled." };
      onProgress({
        status: "error",
        progress: 100,
        filename: file.name,
        message: result.message
      });
      resolve(result);
    };

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}

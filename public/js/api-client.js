// API Configuration
// Detect backend URL based on frontend location
// Development: frontend on 3000, backend on 3002
// Production/Integrated: backend serves from same origin
let API_URL;
if (window.location.port === "3000") {
  // If frontend is served on 3000, backend API is expected on same host at 3002.
  API_URL = `${window.location.protocol}//${window.location.hostname}:3002/api`;
} else {
  // For same-origin serving (frontend and backend from same server)
  API_URL = "/api";
}

// ============================================
// ACTIVITIES API
// ============================================

async function getActivities() {
  try {
    const response = await fetch(`${API_URL}/activities`);
    if (!response.ok) throw new Error("Failed to fetch activities");
    return await response.json();
  } catch (error) {
    console.error("Error fetching activities:", error);
    return [];
  }
}

async function getActivityById(id) {
  try {
    const response = await fetch(`${API_URL}/activities/${id}`);
    if (!response.ok) throw new Error("Activity not found");
    return await response.json();
  } catch (error) {
    console.error("Error fetching activity:", error);
    return null;
  }
}

async function createActivity(name, venue, date) {
  try {
    const response = await fetch(`${API_URL}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, venue, date, created_by: "current_user" }),
    });
    if (!response.ok) throw new Error("Failed to create activity");
    return await response.json();
  } catch (error) {
    console.error("Error creating activity:", error);
    return null;
  }
}

async function updateActivity(id, name, venue, date) {
  try {
    const response = await fetch(`${API_URL}/activities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, venue, date }),
    });
    if (!response.ok) throw new Error("Failed to update activity");
    return await response.json();
  } catch (error) {
    console.error("Error updating activity:", error);
    return null;
  }
}

async function deleteActivity(id) {
  try {
    const response = await fetch(`${API_URL}/activities/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete activity");
    return await response.json();
  } catch (error) {
    console.error("Error deleting activity:", error);
    return null;
  }
}

// ============================================
// ATTENDANCE API
// ============================================

async function getAttendanceRecords(activityId) {
  try {
    const response = await fetch(`${API_URL}/attendance/${activityId}`);
    if (!response.ok) throw new Error("Failed to fetch attendance records");
    return await response.json();
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return [];
  }
}

async function getAttendanceSummary() {
  try {
    const response = await fetch(`${API_URL}/attendance/summary`);
    if (!response.ok) throw new Error("Failed to fetch attendance summary");
    return await response.json();
  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    return [];
  }
}

async function createAttendanceRecord(
  activityId,
  rowNumber,
  name,
  sex,
  office,
  position,
  contact,
  signature,
) {
  try {
    const response = await fetch(`${API_URL}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity_id: activityId,
        row_number: rowNumber,
        name,
        sex,
        office,
        position,
        contact,
        signature,
      }),
    });
    if (!response.ok) throw new Error("Failed to create attendance record");
    return await response.json();
  } catch (error) {
    console.error("Error creating attendance record:", error);
    return null;
  }
}

async function updateAttendanceRecord(
  id,
  name,
  sex,
  office,
  position,
  contact,
  signature,
) {
  try {
    const response = await fetch(`${API_URL}/attendance/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sex, office, position, contact, signature }),
    });
    if (!response.ok) throw new Error("Failed to update attendance record");
    return await response.json();
  } catch (error) {
    console.error("Error updating attendance record:", error);
    return null;
  }
}

async function batchSaveAttendance(
  activityId,
  records,
  uploadedBy = "current_user",
) {
  try {
    console.log("[API] Sending batch attendance:", {
      activityId,
      recordCount: records?.length,
      records,
    });
    const response = await fetch(`${API_URL}/attendance/batch/${activityId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records, uploaded_by: uploadedBy }),
    });
    if (!response.ok) throw new Error("Failed to save attendance batch");
    return await response.json();
  } catch (error) {
    console.error("Error saving attendance batch:", error);
    return null;
  }
}

// ============================================
// FILES API
// ============================================

async function getFiles() {
  try {
    console.log(`[API] Fetching all files from ${API_URL}/files`);
    const response = await fetch(`${API_URL}/files`);
    if (!response.ok) {
      console.error(
        `[API] Failed to fetch files: ${response.status} ${response.statusText}`,
      );
      throw new Error(`Failed to fetch files: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`[API] Success: Retrieved ${data.length} files`);
    return data;
  } catch (error) {
    console.error("[API] Error fetching files:", error);
    return [];
  }
}

async function getFilesByActivity(activityId) {
  try {
    console.log(`[API] Fetching files for activity: ${activityId}`);
    const response = await fetch(`${API_URL}/files/activity/${activityId}`);
    if (!response.ok) {
      console.error(
        `[API] Failed to fetch files for activity: ${response.status}`,
      );
      throw new Error("Failed to fetch files for activity");
    }
    const data = await response.json();
    console.log(
      `[API] Success: Retrieved ${data.length} files for activity ${activityId}`,
    );
    return data;
  } catch (error) {
    console.error("[API] Error fetching files by activity:", error);
    return [];
  }
}

async function uploadFile(activityId, file, uploadedBy, participantId = null) {
  try {
    const formData = new FormData();
    formData.append("activity_id", activityId);
    formData.append("uploaded_by", uploadedBy);
    if (participantId) {
      formData.append("participant_id", participantId);
    }
    formData.append("file", file);

    console.log(
      `[API] Uploading file: ${file.name} for activity: ${activityId}`,
    );
    const response = await fetch(`${API_URL}/files/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`[API] Upload failed: ${error.error}`);
      throw new Error(error.error || "Failed to upload file");
    }

    const data = await response.json();
    console.log(`[API] File uploaded successfully:`, data);
    return data;
  } catch (error) {
    console.error("[API] Error uploading file:", error);
    return null;
  }
}

async function deleteFile(fileId) {
  try {
    const response = await fetch(`${API_URL}/files/${fileId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to delete file");
    }
    return await response.json();
  } catch (error) {
    console.error("[API] Error deleting file:", error);
    return null;
  }
}

// ============================================
// HEALTH CHECK
// ============================================

async function checkBackendHealth() {
  try {
    console.log(`[HEALTH] Checking backend at: ${API_URL}`);
    const response = await fetch(`${API_URL}/activities`);
    if (response.ok) {
      console.log("[HEALTH] ✓ Backend is running and responding");
      return true;
    } else {
      console.warn(`[HEALTH] ⚠ Backend returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`[HEALTH] ✗ Backend connection failed: ${error.message}`);
    console.error("[HEALTH] API_URL:", API_URL);
    console.error("[HEALTH] Make sure backend is running on port 3002");
    return false;
  }
}

// Auto-check backend on load
checkBackendHealth();

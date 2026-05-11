// files.js — Complete file management for files.html
// Fetches files from database and manages uploads
// Includes error logging and debugging output

let filesList = [];
let uploadedById = "current_user"; // Default uploader

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function initializeFilesPage() {
  console.log("\n" + "=".repeat(80));
  console.log("[INIT] ========== files.html Page Initialization ==========");
  console.log("[INIT] Timestamp:", new Date().toLocaleString());
  console.log("[INIT] API_URL:", API_URL);
  console.log("[INIT] Route detected: Hash-based navigation (#files)");
  console.log("=".repeat(80) + "\n");

  try {
    // 1. Check backend health
    console.log("[INIT] Step 1: Checking backend health...");
    await checkBackendHealth();
    console.log("[INIT] ✓ Backend is healthy\n");

    // 2. Load activities for dropdown
    console.log("[INIT] Step 2: Loading activities...");
    savedActivities = await getActivities();
    console.log(`[INIT] ✓ Loaded ${savedActivities.length} activities`);
    console.log(
      "[INIT] Activities:",
      savedActivities.map((a) => `${a.name} (${a.id})`).join(", "),
    );
    populateActivityDropdown();
    console.log("[INIT] ✓ Activity dropdown populated\n");

    // 3. Load files from database
    console.log("[INIT] Step 3: Loading files from database...");
    await refreshFilesList();
    console.log("[INIT] ✓ Files loaded\n");

    // 4. Set up event listeners
    console.log("[INIT] Step 4: Setting up event listeners...");
    setupEventListeners();
    console.log("[INIT] ✓ Event listeners configured\n");

    console.log("[INIT] ========== Initialization Complete ✓ ==========\n");
  } catch (error) {
    console.error("[INIT] ✗ CRITICAL ERROR:", error);
    showErrorMessage(
      "Failed to initialize page. Please refresh or check console.",
    );
  }
}

// Listen for hash changes (single-page app routing)
window.addEventListener("hashchange", () => {
  const hash = window.location.hash.slice(1); // Remove '#' prefix
  console.log("[ROUTE] Hash changed to:", hash);

  if (hash === "files") {
    console.log("[ROUTE] Navigating to files page...");
    initializeFilesPage();
  }
});

// Initialize on page load if user is already on #files route
window.addEventListener("DOMContentLoaded", () => {
  const hash = window.location.hash.slice(1);
  console.log("[ROUTE] Page loaded, current hash:", hash);

  if (hash === "files") {
    console.log("[ROUTE] Files route detected on load, initializing...");
    initializeFilesPage();
  }
});

// ─── Populate Activity Dropdown ───────────────────────────────────────────────

function populateActivityDropdown() {
  const select = document.getElementById("fileActivitySelect");
  if (!select) return;

  select.innerHTML = '<option value="">Select Activity</option>';
  savedActivities.forEach((activity) => {
    const option = document.createElement("option");
    option.value = activity.id;
    option.textContent = `${activity.name} (${activity.venue})`;
    select.appendChild(option);
  });
}

// ─── Refresh Files List ───────────────────────────────────────────────────────

async function refreshFilesList() {
  console.log("\n[FILES] ========== Fetching Files from Database ==========");
  console.log("[FILES] API Call: GET ${API_URL}/files");

  try {
    console.log("[FILES] Calling getFiles() function...");
    filesList = await getFiles();

    console.log(`[FILES] ✓ API Response received`);
    console.log(`[FILES] Total files returned: ${filesList.length}`);

    if (filesList.length === 0) {
      console.warn("[FILES] ⚠ WARNING: No files returned from API");
    } else {
      console.log("[FILES] Files retrieved:");
      filesList.forEach((file, index) => {
        console.log(
          `  [${index + 1}] ${file.file_name} (Activity: ${file.activity_name}, Path: ${file.file_path})`,
        );
      });
      console.log(
        "[FILES] Sample file object:",
        JSON.stringify(filesList[0], null, 2),
      );
    }

    console.log("[FILES] Rendering files in table...");
    renderSubmittedList();
    console.log("[FILES] ✓ Files rendered successfully\n");
  } catch (error) {
    console.error("[FILES] ✗ ERROR fetching files:", error);
    console.error("[FILES] Error details:", error.message);
    showErrorMessage("Failed to load files. Please try again.");
  }
}

// ─── Render Files Table ───────────────────────────────────────────────────────

function renderFilesList() {
  console.log("\n[RENDER] ========== Rendering Files Table ==========");

  const container = document.getElementById("submittedAttendanceList");

  if (!container) {
    console.error("[RENDER] ✗ CRITICAL: Table container not found!");
    console.error(
      "[RENDER] Looking for element with id='submittedAttendanceList'",
    );
    console.error(
      "[RENDER] Available table elements:",
      document.querySelectorAll("table").length,
    );
    return;
  }

  console.log("[RENDER] ✓ Found table container: #submittedAttendanceList");
  console.log(`[RENDER] Processing ${filesList.length} files for rendering`);

  if (!filesList || filesList.length === 0) {
    console.log("[RENDER] No files to display - showing empty state");
    container.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-4 text-center text-gray-500">
          No files uploaded yet. Submit attendance to create files.
        </td>
      </tr>`;
    console.log("[RENDER] ✓ Empty state rendered\n");
    return;
  }

  console.log("[RENDER] Rendering table rows...");

  container.innerHTML = filesList
    .map((file, index) => {
      const uploadDate = file.upload_date
        ? new Date(file.upload_date).toLocaleString()
        : "—";
      const activityName = file.activity_name || "Unknown Activity";
      const fileName = file.file_name || "Unnamed File";
      const filePath = file.file_path || "#";

      console.log(
        `[RENDER] Row ${index + 1}: ${fileName} | Activity: ${activityName} | Path: ${filePath}`,
      );

      return `
        <tr data-file-id="${file.id}">
          <td class="px-4 py-3">
            <p class="font-semibold text-gray-800">${fileName}</p>
          </td>
          <td class="px-4 py-3 text-gray-600">${activityName}</td>
          <td class="px-4 py-3 text-gray-600">${uploadDate}</td>
          <td class="px-4 py-3 text-right space-x-2">
            <button data-file-path="${filePath}" data-action="view"
              class="action-btn inline-flex items-center rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700">
              View
            </button>
            <button data-file-path="${filePath}" data-action="edit"
              class="action-btn inline-flex items-center rounded bg-yellow-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-600">
              Edit
            </button>
            <button data-file-path="${filePath}" data-action="print"
              class="action-btn inline-flex items-center rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700">
              Print
            </button>
            <button data-file-path="${filePath}" data-action="download"
              class="action-btn inline-flex items-center rounded bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-700">
              PDF
            </button>
            <button data-file-path="${filePath}" data-action="csv"
              class="action-btn inline-flex items-center rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700">
              CSV
            </button>
          </td>
        </tr>`;
    })
    .join("");

  // The click handler is attached once via event delegation in setupEventListeners().

  console.log(`[RENDER] ✓ Table rendered with ${filesList.length} rows\n`);
}

// ─── Handle File Actions ─────────────────────────────────────────────────────

async function handleFileAction(event) {
  const btn = event.target.closest(".action-btn");
  const action = btn.dataset.action;
  const filePath = btn.dataset.filePath;
  const fileId = btn.dataset.fileId;

  console.log(`\n[ACTION] File action triggered: ${action}`);
  console.log(`[ACTION] File ID: ${fileId}`);
  console.log(`[ACTION] File Path: ${filePath}`);

  if (action === "view") {
    viewFile(filePath);
  } else if (action === "download") {
    downloadFile(filePath);
  } else if (action === "edit") {
    editFile(filePath);
  } else if (action === "print") {
    printFile(filePath);
  } else if (action === "csv") {
    downloadFileCsv(filePath);
  } else if (action === "delete") {
    if (confirm("Are you sure you want to delete this file?")) {
      console.log(`[ACTION] ✓ User confirmed deletion of file: ${fileId}`);
      // Delete functionality can be implemented here
      alert("Delete functionality not yet implemented");
    } else {
      console.log(`[ACTION] User cancelled deletion`);
    }
  }
}

// ─── View File ────────────────────────────────────────────────────────────────

function viewFile(filePath) {
  console.log(`\n[VIEW] View file requested for: ${filePath}`);

  if (!filePath || filePath === "#") {
    console.error("[VIEW] ✗ ERROR: No valid file path provided");
    console.error("[VIEW] File path value:", filePath);
    alert("File path not available");
    return;
  }

  const fileExtension = filePath.split(".").pop().toLowerCase();
  console.log(`[VIEW] File extension detected: ${fileExtension}`);

  try {
    // For PDFs and images, open directly in browser
    if (["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension)) {
      console.log(
        `[VIEW] Opening ${fileExtension.toUpperCase()} in new tab...`,
      );
      window.open(filePath, "_blank");
      console.log(`[VIEW] ✓ File opened in new tab\n`);
    }
    // For CSV, JSON, and text files, open as text
    else if (["csv", "json", "txt"].includes(fileExtension)) {
      console.log(
        `[VIEW] Opening ${fileExtension.toUpperCase()} in new tab as text...`,
      );
      window.open(filePath, "_blank");
      console.log(`[VIEW] ✓ File opened in new tab\n`);
    }
    // For other file types, try opening in new tab
    else {
      console.log(`[VIEW] Opening file type '${fileExtension}' in new tab...`);
      window.open(filePath, "_blank");
      console.log(
        `[VIEW] ✓ File opened in new tab (browser will handle type)\n`,
      );
    }
  } catch (error) {
    console.error("[VIEW] ✗ ERROR opening file:", error);
    alert("Could not open file. Please try downloading instead.");
  }
}

// ─── Download File ────────────────────────────────────────────────────────────

function downloadFile(filePath) {
  console.log(`\n[DOWNLOAD] Download requested for: ${filePath}`);

  if (!filePath || filePath === "#") {
    console.error("[DOWNLOAD] ✗ ERROR: No valid file path provided");
    console.error("[DOWNLOAD] File path value:", filePath);
    alert("File path not available");
    return;
  }

  console.log(`[DOWNLOAD] Creating download link...`);

  const link = document.createElement("a");
  link.href = filePath;
  link.download = filePath.split("/").pop() || "download";

  console.log(`[DOWNLOAD] Link href: ${link.href}`);
  console.log(`[DOWNLOAD] Download filename: ${link.download}`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log(`[DOWNLOAD] ✓ Download initiated\n`);
}

function editFile(filePath) {
  console.log(`\n[EDIT] Edit requested for: ${filePath}`);
  // Open file in new window for editing or download for editing
  window.open(filePath, "_blank");
}

function printFile(filePath) {
  console.log(`\n[PRINT] Print requested for: ${filePath}`);
  // Fetch file content and print
  fetch(filePath)
    .then((response) => response.text())
    .then((content) => {
      const printWindow = window.open("", "_blank");
      printWindow.document.write("<pre>" + content + "</pre>");
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    })
    .catch((err) => {
      console.error("[PRINT] Error:", err);
      alert("Could not print file");
    });
}

function downloadFileCsv(filePath) {
  console.log(`\n[CSV] CSV download requested for: ${filePath}`);
  // Same as download - link is already CSV
  downloadFile(filePath);
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function setupEventListeners() {
  if (window.__filesPageListenersAttached) {
    console.log("[LISTENERS] Files page listeners already attached, skipping");
    return;
  }

  window.__filesPageListenersAttached = true;

  const container = document.getElementById("submittedAttendanceList");
  if (container && !window.__filesTableListenerAttached) {
    window.__filesTableListenerAttached = true;
    container.addEventListener("click", handleFileAction);
    console.log("[LISTENERS] Files table click delegation configured");
  }

  const uploadBtn = document.getElementById("uploadFileBtn");
  const refreshBtn = document.getElementById("refreshFileListBtn");
  const exportBtn = document.getElementById("exportAllAttendanceCsv");

  if (uploadBtn) {
    uploadBtn.addEventListener("click", handleFileUpload);
    console.log("[LISTENERS] Upload button configured");
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      console.log("[LISTENERS] Refresh clicked");
      await refreshFilesList();
      showSuccessMessage("Files refreshed");
    });
    console.log("[LISTENERS] Refresh button configured");
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", exportAllFiles);
    console.log("[LISTENERS] Export button configured");
  }
}

// ─── Upload File ──────────────────────────────────────────────────────────────

async function handleFileUpload() {
  const fileInput = document.getElementById("fileInput");
  const activitySelect = document.getElementById("fileActivitySelect");
  const uploaderIdInput = document.getElementById("fileUploaderId");
  const participantIdInput = document.getElementById("fileParticipantId");

  const file = fileInput ? fileInput.files[0] : null;
  const activityId = activitySelect ? activitySelect.value : null;
  const uploaderId = uploaderIdInput ? uploaderIdInput.value : "current_user";
  const participantId = participantIdInput ? participantIdInput.value : null;

  console.log("[UPLOAD] File upload initiated:", {
    fileName: file?.name,
    activityId,
    uploaderId,
    participantId,
  });

  // Validation
  if (!file) {
    showErrorMessage("Please select a file to upload");
    console.warn("[UPLOAD] No file selected");
    return;
  }

  if (!activityId) {
    showErrorMessage("Please select an activity");
    console.warn("[UPLOAD] No activity selected");
    return;
  }

  if (!uploaderId) {
    showErrorMessage("Please enter uploader ID");
    console.warn("[UPLOAD] No uploader ID");
    return;
  }

  try {
    console.log("[UPLOAD] Uploading file to backend...");
    const result = await uploadFile(
      activityId,
      file,
      uploaderId,
      participantId || null,
    );

    if (result) {
      console.log("[UPLOAD] Upload successful:", result);
      showSuccessMessage(`File "${file.name}" uploaded successfully!`);

      // Clear form
      fileInput.value = "";
      participantIdInput.value = "";

      // Refresh file list
      await refreshFilesList();
    } else {
      console.error("[UPLOAD] Upload returned null");
      showErrorMessage("Upload failed. Please try again.");
    }
  } catch (error) {
    console.error("[UPLOAD] Upload error:", error);
    showErrorMessage(`Upload failed: ${error.message}`);
  }
}

// ─── Export All Files ─────────────────────────────────────────────────────────

async function exportAllFiles() {
  console.log("[EXPORT] Exporting all files as CSV...");

  if (!filesList || filesList.length === 0) {
    alert("No files to export");
    return;
  }

  const header = [
    "File Name",
    "Activity Name",
    "Upload Date",
    "File Path",
    "Uploaded By",
  ];

  const rows = filesList.map((file) => [
    file.file_name || "",
    file.activity_name || "",
    file.upload_date || "",
    file.file_path || "",
    file.uploaded_by || "",
  ]);

  const csvContent = [
    header.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Files_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log("[EXPORT] CSV export complete");
}

// ─── UI Feedback Functions ───────────────────────────────────────────────────

function showSuccessMessage(message) {
  console.log("[SUCCESS]", message);
  const alert = document.createElement("div");
  alert.className =
    "fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded shadow-lg";
  alert.textContent = message;
  document.body.appendChild(alert);
  setTimeout(() => {
    alert.remove();
  }, 3000);
}

function showErrorMessage(message) {
  console.error("[ERROR]", message);
  const alert = document.createElement("div");
  alert.className =
    "fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded shadow-lg";
  alert.textContent = message;
  document.body.appendChild(alert);
  setTimeout(() => {
    alert.remove();
  }, 3000);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActivityName(activity) {
  return activity.name || activity.activity || "Untitled Activity";
}

function getActivityVenue(activity) {
  return activity.venue || "—";
}

function getActivityDate(activity) {
  return activity.date || activity.link_of_encoded_names || "—";
}

/** Convert records array → flat row arrays matching the attendance table columns */
function recordsToRows(records) {
  return records.map((r) => [
    r.row_number || "",
    r.name || "",
    r.sex || "",
    r.office || "",
    r.position || "",
    r.contact || "",
    r.signature || "",
  ]);
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function buildCsvContent(activityName, venue, date, rows) {
  const header = [
    "Activity Name",
    "Venue",
    "Date",
    "No",
    "Name",
    "Sex",
    "Office / Municipality / School",
    "Position / Course",
    "Contact Number",
    "Signature",
  ];

  const lines = [header.join(",")];

  rows.forEach((row) => {
    const values = [activityName, venue, date, ...row];
    const escaped = values.map(
      (cell) => `"${String(cell || "").replace(/"/g, '""')}"`,
    );
    lines.push(escaped.join(","));
  });

  return lines.join("\n");
}

function triggerCsvDownload(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportActivityCsv(activity, records) {
  const name = getActivityName(activity);
  const venue = getActivityVenue(activity);
  const date = getActivityDate(activity);
  const rows = recordsToRows(records);
  const csv = buildCsvContent(name, venue, date, rows);
  const filename = `Attendance_${name.replace(/\s+/g, "_")}_${Date.now()}.csv`;
  triggerCsvDownload(csv, filename);
}

async function exportAllSubmittedAttendanceCsv() {
  const submitted = attendanceSummary.filter(
    (it) => Number(it.record_count) > 0,
  );
  if (!submitted.length) {
    alert("No submitted attendance records to export.");
    return;
  }

  const header = [
    "Activity Name",
    "Venue",
    "Date",
    "No",
    "Name",
    "Sex",
    "Office / Municipality / School",
    "Position / Course",
    "Contact Number",
    "Signature",
  ];

  const lines = [header.join(",")];

  for (const item of submitted) {
    const records = await getAttendanceRecords(item.activity_id);
    records.forEach((r) => {
      const values = [
        item.name || "",
        item.venue || "",
        item.date || "",
        r.row_number || "",
        r.name || "",
        r.sex || "",
        r.office || "",
        r.position || "",
        r.contact || "",
        r.signature || "",
      ];
      const escaped = values.map(
        (cell) => `"${String(cell || "").replace(/"/g, '""')}"`,
      );
      lines.push(escaped.join(","));
    });
  }

  const filename = `Attendance_All_Submitted_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  triggerCsvDownload(lines.join("\n"), filename);
}

// ─── Print ────────────────────────────────────────────────────────────────────

function buildTableHtml(rows) {
  const headers = [
    "NO",
    "NAME",
    "SEX",
    "OFFICE / MUNICIPALITY / SCHOOL",
    "POSITION / COURSE",
    "CONTACT NUMBER",
    "SIGNATURE",
  ];

  const ths = headers
    .map((h) => `<th style="border:1px solid #000;padding:6px 8px;">${h}</th>`)
    .join("");

  const trs = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="border:1px solid #000;padding:6px 8px;">${cell || ""}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead><tr style="background:#e0e0e0;">${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function printSheet(activity, records) {
  const name = getActivityName(activity);
  const venue = getActivityVenue(activity);
  const date = getActivityDate(activity);
  const rows = recordsToRows(records);
  const tableHtml = buildTableHtml(rows);

  const win = window.open("", "", "height=600,width=900");
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ATTENDANCE SHEET - ${name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header-wrap { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .header-wrap img { max-height: 70px; width: auto; }
        .header-text { text-align: center; width: 70%; }
        .header-text h1 { margin: 0; font-size: 20px; font-family: 'Times New Roman', serif; }
        .header-text h2 { margin: 0; font-size: 16px; }
        .header-text p  { margin: 3px 0; font-size: 9px; }
        .info p { margin: 3px 0; font-weight: bold; font-size: 11px; }
        .consent { font-size: 9px; font-style: italic; margin: 10px 0; }
        .footer { margin-top: 20px; font-size: 8px; text-align: center; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="header-wrap">
        <img src="./images/dmw-right.png.jpg" alt="" />
        <div class="header-text">
          <h1>Republic of the Philippines</h1>
          <h2>Department of Migrant Workers</h2>
          <p>Regional Office – XIII (Caraga)</p>
          <p>3rd floor, Esquina Dos Building J.C. Aquino Avenue, Doongan Road, Butuan City, Agusan del Norte, 8600</p>
        </div>
        <img src="./images/dmw-logo.png.jpg" alt="" />
      </div>
      <hr/>
      <div class="info">
        <p>ACTIVITY: ${name}</p>
        <p>VENUE: ${venue}</p>
        <p>DATE: ${date}</p>
      </div>
      <div class="consent">
        By completing this form, you hereby freely and voluntarily give your consent to the collection,
        processing, and sharing of your personal information as described in the DMW Data Privacy Notice.
      </div>
      ${tableHtml}
      <div class="footer">
        Website: www.dmw.gov.ph | Email: butuan@dmw.gov.ph | Landline: (085)815-1708<br/>
        Finance &amp; Administrative Division: 0921-846 5934<br/>
        Migrant Workers Processing Division: 0993-279 8082<br/>
        Migrant Workers Protection Division: 0907-694 3525<br/>
        Welfare &amp; Reintegration Services Division: 0948-475 6812 / 0950-305 7533
      </div>
    </body>
    </html>`);
  win.document.close();
  win.print();
}

// ─── PDF download ─────────────────────────────────────────────────────────────

function loadImageAsDataURL(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function downloadPdf(activity, records) {
  const name = getActivityName(activity);
  const venue = getActivityVenue(activity);
  const date = getActivityDate(activity);
  const rows = recordsToRows(records);
  const filename = `Attendance_${name.replace(/\s+/g, "_")}_${Date.now()}`;

  const leftLogo = await loadImageAsDataURL("./images/dmw-right.png.jpg");
  const rightLogo = await loadImageAsDataURL("./images/dmw-logo.png.jpg");

  if (window.jspdf && window.jspdf.jsPDF) {
    const { jsPDF } = window.jspdf;
    const rowsPerPage = 30;
    const footerLines = [
      "Website: www.dmw.gov.ph | Email: butuan@dmw.gov.ph | Landline: (085)815-1708",
      "Finance & Administrative Division: 0921-846 5934",
      "Migrant Workers Processing Division: 0993-279 8082",
      "Migrant Workers Protection Division: 0907-694 3525",
      "Welfare & Reintegration Services Division: 0948-475 6812 / 0950-305 7533",
    ];
    // Long Bond paper: 8.5 × 13 inches
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [215.9, 330.2],
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const header = [
      "NO",
      "NAME",
      "SEX",
      "OFFICE/MUNICIPALITY/SCHOOL",
      "POSITION/COURSE",
      "CONTACT NUMBER",
      "SIGNATURE",
    ];

    const drawFooter = () => {
      const footerHeight = footerLines.length * 4.5 + 10;
      const footerTop = pageHeight - footerHeight - 4;

      doc.setFillColor(245, 245, 245);
      doc.rect(8, footerTop - 2, pageWidth - 16, footerHeight + 6, "F");
      doc.setDrawColor(120);
      doc.setLineWidth(0.5);
      doc.line(10, footerTop - 0.5, pageWidth - 10, footerTop - 0.5);

      doc.setFontSize(6);
      doc.setFont(undefined, "normal");
      let lineY = footerTop + 4;
      footerLines.forEach((line) => {
        doc.text(line, pageWidth / 2, lineY, {
          maxWidth: pageWidth - 24,
          align: "center",
        });
        lineY += 4.5;
      });
    };

    const drawPageHeader = () => {
      let y = 10;

      if (leftLogo) doc.addImage(leftLogo, "PNG", 10, y - 2, 24, 24);
      if (rightLogo)
        doc.addImage(rightLogo, "PNG", pageWidth - 34, y - 2, 24, 24);

      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text("Republic of the Philippines", pageWidth / 2, y, {
        align: "center",
      });
      y += 6;

      doc.setFontSize(14);
      doc.text("Department of Migrant Workers", pageWidth / 2, y, {
        align: "center",
      });
      y += 6;

      doc.setFontSize(11);
      doc.text("Regional Office – XIII (Caraga)", pageWidth / 2, y, {
        align: "center",
      });
      y += 5;

      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.text(
        "3rd floor, Esquina Dos Building J.C. Aquino Avenue, Doongan Road, Butuan City, Agusan del Norte, 8600",
        pageWidth / 2,
        y,
        { align: "center" },
      );
      y += 8;

      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.text("ATTENDANCE SHEET", pageWidth / 2, y, { align: "center" });
      y += 10;

      doc.setFontSize(10);
      [
        ["ACTIVITY", name],
        ["VENUE", venue],
        ["DATE", date],
      ].forEach(([label, val]) => {
        doc.setFont(undefined, "bold");
        doc.text(label, 15, y);
        doc.setFont(undefined, "normal");
        doc.text(":", 35, y);
        doc.text(val, 40, y);
        y += 6;
      });
      y += 2;

      doc.setFontSize(9);
      doc.setFont(undefined, "italic");
      doc.text(
        "By completing this form, you hereby freely and voluntarily give your consent to the collection, processing, and sharing of your personal information as described in the DMW Data Privacy Notice.",
        15,
        y,
        { maxWidth: pageWidth - 30 },
      );
      y += 12;

      return y;
    };

    const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      if (pageIndex > 0) doc.addPage();

      const startY = drawPageHeader();
      const pageRows = rows.slice(
        pageIndex * rowsPerPage,
        (pageIndex + 1) * rowsPerPage,
      );

      if (typeof doc.autoTable === "function") {
        doc.autoTable({
          startY,
          head: [header],
          body: pageRows,
          styles: {
            fontSize: 8.5,
            cellPadding: 1.4,
            overflow: "ellipsize",
            halign: "center",
            valign: "middle",
          },
          headStyles: {
            fillColor: [30, 119, 190],
            textColor: 255,
            halign: "center",
          },
          margin: { left: 10, right: 10, bottom: 36 },
          pageBreak: "avoid",
          didDrawPage: drawFooter,
        });
      } else {
        drawFooter();
      }
    }

    doc.save(`${filename}.pdf`);
    return;
  }

  // Fallback: HTML file (user can print-to-PDF manually)
  const tableHtml = buildTableHtml(rows);
  const html = `<!DOCTYPE html><html><head><title>ATTENDANCE SHEET</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;}h1,h2,h3{text-align:center;margin:4px 0;}p{margin:3px 0;}
    .info p{font-weight:bold;font-size:11px;}.consent{font-size:9px;font-style:italic;margin:10px 0;}
    .footer{margin-top:20px;font-size:8px;text-align:center;line-height:1.6;}</style></head>
    <body>
      <h1>Republic of the Philippines</h1>
      <h2>Department of Migrant Workers</h2>
      <h3>Regional Office – XIII (Caraga)</h3>
      <p style="text-align:center;font-size:9px;">3rd floor, Esquina Dos Building J.C. Aquino Avenue, Doongan Road, Butuan City, Agusan del Norte, 8600</p>
      <h2 style="margin-top:12px;">ATTENDANCE SHEET</h2>
      <div class="info"><p>ACTIVITY: ${name}</p><p>VENUE: ${venue}</p><p>DATE: ${date}</p></div>
      <div class="consent">By completing this form, you hereby freely and voluntarily give your consent to the collection, processing, and sharing of your personal information as described in the DMW Data Privacy Notice.</div>
      ${tableHtml}
      <div class="footer">
        Website: www.dmw.gov.ph | Email: butuan@dmw.gov.ph | Landline: (085)815-1708<br/>
        Finance &amp; Administrative Division: 0921-846 5934<br/>
        Migrant Workers Processing Division: 0993-279 8082<br/>
        Migrant Workers Protection Division: 0907-694 3525<br/>
        Welfare &amp; Reintegration Services Division: 0948-475 6812 / 0950-305 7533
      </div>
    </body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

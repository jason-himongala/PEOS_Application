let savedActivities = [];
let allEvents = [];
let attendanceSummary = [];
let currentSelectedOption = "";

async function refreshActivities() {
  savedActivities = await getActivities();
}

async function loadAttendanceSummary() {
  attendanceSummary = await getAttendanceSummary();
  renderSubmittedList();
}

function renderSubmittedList() {
  const list = document.getElementById("submittedAttendanceList");
  const items = attendanceSummary.filter((it) => Number(it.record_count) > 0);

  if (!items.length) {
    if (attendanceSummary.length > 0) {
      list.innerHTML = `
        <tr>
          <td colspan="5" class="px-4 py-4 text-center text-gray-500">
            Activities exist, but no attendance records found yet. Please submit attendance for a saved activity.
          </td>
        </tr>`;
    } else {
      list.innerHTML = `
        <tr>
          <td colspan="5" class="px-4 py-4 text-center text-gray-500">
            No submitted files yet.
          </td>
        </tr>`;
    }
    return;
  }
}

function setupSubmittedListListener() {
  const list = document.getElementById("submittedAttendanceList");
  if (!list || window.__participantSubmittedListListenerAttached) return;

  window.__participantSubmittedListListenerAttached = true;
  list.addEventListener("click", async (event) => {
    const btn = event.target.closest(".action-file");
    if (!btn || !list.contains(btn)) return;

    const activityId = btn.getAttribute("data-activity-id");
    const action = btn.getAttribute("data-action");
    const optionValue = `activity_${activityId}`;
    const select = document.getElementById("attendanceEventFilter");
    if (select) {
      select.value = optionValue;
    }
    currentSelectedOption = optionValue;

    if (action === "csv") {
      await exportActivityAttendanceCsv(activityId);
      return;
    }

    if (!select) {
      alert(
        "Please open the Participant page to view or edit attendance records.",
      );
      return;
    }

    if (action === "view") {
      await renderAttendanceSheet(optionValue, true);
    } else if (action === "edit") {
      await renderAttendanceSheet(optionValue, false);
    } else if (action === "print") {
      const printWindow = window.open("", "", "height=600,width=800");
      if (!printWindow) {
        alert("Print preview was blocked. Please allow pop-ups and try again.");
        return;
      }
      await renderAttendanceSheet(optionValue, true);
      await printAttendanceSheet(printWindow);
    } else if (action === "download") {
      await renderAttendanceSheet(optionValue, true);
      downloadAttendanceSheet();
    }
  });
}

function getActivityFromOption(optionValue) {
  if (!optionValue) return null;
  if (optionValue.startsWith("activity_")) {
    const id = optionValue.replace("activity_", "");
    return savedActivities.find((a) => a.id === id) || null;
  }
  return null;
}

function setAttendanceLocked(locked) {
  const inputs = document.querySelectorAll("#attendanceTableBody input");
  inputs.forEach((inp) => (inp.disabled = locked));
  document.getElementById("addAttendanceRow").disabled = locked;
  document.getElementById("submitAttendance").disabled = locked;
  document
    .getElementById("addAttendanceRow")
    .classList.toggle("opacity-50", locked);
  document
    .getElementById("submitAttendance")
    .classList.toggle("opacity-50", locked);
}

async function renderAttendanceSheet(optionValue = null, lock = true) {
  const sheetContainer = document.getElementById("attendanceSheetContainer");
  const placeholder = document.getElementById("attendancePlaceholder");
  const tbody = document.getElementById("attendanceTableBody");

  if (!sheetContainer || !placeholder || !tbody) {
    return;
  }

  if (!optionValue) {
    placeholder.classList.remove("hidden");
    sheetContainer.classList.add("hidden");
    const activityEl = document.getElementById("attendanceActivity");
    const venueEl = document.getElementById("attendanceVenue");
    const dateEl = document.getElementById("attendanceDate");
    if (activityEl) activityEl.textContent = "—";
    if (venueEl) venueEl.textContent = "—";
    if (dateEl) dateEl.textContent = "—";
    tbody.innerHTML = "";
    return;
  }

  placeholder.classList.add("hidden");
  sheetContainer.classList.remove("hidden");
  currentSelectedOption = optionValue;
  const activity = getActivityFromOption(optionValue);
  if (!activity) return;

  document.getElementById("attendanceActivity").textContent =
    activity.name || activity.activity || "—";
  document.getElementById("attendanceVenue").textContent =
    activity.venue || "—";
  document.getElementById("attendanceDate").textContent =
    activity.date || activity.link_of_encoded_names || "—";

  let savedRows = [];
  if (optionValue.startsWith("activity_")) {
    const activityId = optionValue.replace("activity_", "");
    savedRows = await getAttendanceRecords(activityId);
  }

  const maxSavedRowNumber = savedRows.reduce((max, row) => {
    const rowNumber = Number(row.row_number) || 0;
    return Math.max(max, rowNumber);
  }, 0);
  const totalRowsToRender = Math.max(30, maxSavedRowNumber);

  tbody.innerHTML = "";
  for (let i = 1; i <= totalRowsToRender; i++) {
    const rowData = savedRows.find((row) => Number(row.row_number) === i) || {};
    tbody.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td class="border border-gray-300 px-2 py-1 text-center font-semibold">${i}</td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" value="${rowData.name || ""}"/></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" maxlength="1" value="${rowData.sex || ""}"/></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" value="${rowData.office || ""}"/></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" value="${rowData.position || ""}"/></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" value="${rowData.contact || ""}"/></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" value="${rowData.signature || ""}"/></td>
      </tr>
    `,
    );
  }

  const shouldLock = lock && savedRows.length > 0;
  setAttendanceLocked(shouldLock);
}

function getAttendanceTableData() {
  const rows = [];
  const trs = document.querySelectorAll("#attendanceTableBody tr");

  trs.forEach((tr) => {
    const no = tr.querySelector("td:first-child")?.textContent.trim() || "";
    const inputs = Array.from(tr.querySelectorAll("input"));
    const rowValues = [
      no,
      inputs[0]?.value.trim() || "",
      inputs[1]?.value.trim() || "",
      inputs[2]?.value.trim() || "",
      inputs[3]?.value.trim() || "",
      inputs[4]?.value.trim() || "",
      inputs[5]?.value.trim() || "",
    ];

    // Keep all rows to preserve the full form, including blank rows.
    rows.push(rowValues);
  });

  return rows;
}

async function getLatestAttendanceRows() {
  const optionValue =
    currentSelectedOption ||
    document.getElementById("attendanceEventFilter")?.value ||
    "";

  if (optionValue.startsWith("activity_")) {
    const activityId = optionValue.replace("activity_", "");
    const savedRows = await getAttendanceRecords(activityId);
    if (Array.isArray(savedRows) && savedRows.length > 0) {
      return savedRows
        .slice()
        .sort((a, b) => Number(a.row_number) - Number(b.row_number))
        .map((row) => [
          row.row_number || "",
          row.name || "",
          row.sex || "",
          row.office || "",
          row.position || "",
          row.contact || "",
          row.signature || "",
        ]);
    }
  }

  return getAttendanceTableData();
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function buildAttendanceCsv(activity, venue, date, rows) {
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

  const lines = [];
  lines.push(header.join(","));

  rows.forEach((row) => {
    const values = [
      activity,
      venue,
      date,
      row[0] || "",
      row[1] || "",
      row[2] || "",
      row[3] || "",
      row[4] || "",
      row[5] || "",
      row[6] || "",
    ];

    const escapedValues = values.map((cell) => {
      const clean = String(cell || "").replace(/"/g, '""');
      return `"${clean}"`;
    });

    lines.push(escapedValues.join(","));
  });

  return lines.join("\n");
}

async function exportActivityAttendanceCsv(activityId) {
  const activity = savedActivities.find((a) => a.id === activityId);
  if (!activity) {
    alert("Activity not found for CSV export");
    return;
  }

  const records = await getAttendanceRecords(activityId);
  if (!records || !records.length) {
    alert("No attendance records for this activity.");
    return;
  }

  const rows = records.map((r) => [
    r.row_number || "",
    r.name || "",
    r.sex || "",
    r.office || "",
    r.position || "",
    r.contact || "",
    r.signature || "",
  ]);

  const csvContent = buildAttendanceCsv(
    activity.name || "Untitled Activity",
    activity.venue || "",
    activity.date || "",
    rows,
  );

  const filename = `Attendance_${(activity.name || "activity").replace(/\s+/g, "_")}_${new Date().getTime()}.csv`;
  downloadCsv(csvContent, filename);
}

async function exportAllSubmittedAttendanceCsv() {
  const submitted = attendanceSummary.filter(
    (it) => Number(it.record_count) > 0,
  );
  if (!submitted.length) {
    alert("No submitted attendance records to export.");
    return;
  }

  const allLines = [];
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
  allLines.push(header.join(","));

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
      allLines.push(escaped.join(","));
    });
  }

  const filename = `Attendance_All_Submitted_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(allLines.join("\n"), filename);
}

function loadImageAsDataURL(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function buildAttendanceTableHtml(rows) {
  const headers = [
    "NO",
    "NAME",
    "SEX",
    "OFFICE / MUNICIPALITY / SCHOOL",
    "POSITION / COURSE",
    "CONTACT NUMBER",
    "SIGNATURE",
  ];

  const headerHtml = headers
    .map(
      (label) =>
        `<th class="border px-2 py-1 text-left font-bold">${label}</th>`,
    )
    .join("");

  const bodyHtml = rows
    .map(
      (row) => `
      <tr>
        <td class="border px-2 py-1">${row[0] || ""}</td>
        <td class="border px-2 py-1">${row[1] || ""}</td>
        <td class="border px-2 py-1">${row[2] || ""}</td>
        <td class="border px-2 py-1">${row[3] || ""}</td>
        <td class="border px-2 py-1">${row[4] || ""}</td>
        <td class="border px-2 py-1">${row[5] || ""}</td>
        <td class="border px-2 py-1">${row[6] || ""}</td>
      </tr>`,
    )
    .join("");

  return `
    <div class="overflow-auto">
      <table style="width:100%;border-collapse:collapse;" >
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

async function printAttendanceSheet(existingPrintWindow = null) {
  const printWindow =
    existingPrintWindow || window.open("", "", "height=600,width=800");
  if (!printWindow) {
    alert("Print preview was blocked. Please allow pop-ups and try again.");
    return;
  }

  printWindow.document.write(
    "<!DOCTYPE html><html><head><title>Preparing Print...</title></head><body style='font-family:Arial,sans-serif;padding:20px;'>Preparing print preview...</body></html>",
  );
  printWindow.document.close();

  const activity = document.getElementById("attendanceActivity").textContent;
  const venue = document.getElementById("attendanceVenue").textContent;
  const date = document.getElementById("attendanceDate").textContent;
  const rows = await getLatestAttendanceRows();

  const rowChunks = [];
  for (let i = 0; i < rows.length; i += 30) {
    rowChunks.push(rows.slice(i, i + 30));
  }

  const pagesHtml = rowChunks
    .map((chunk, index) => {
      const bodyRows = chunk
        .map(
          (row) => `
            <tr>
              <td>${row[0] || ""}</td>
              <td>${row[1] || ""}</td>
              <td>${row[2] || ""}</td>
              <td>${row[3] || ""}</td>
              <td>${row[4] || ""}</td>
              <td>${row[5] || ""}</td>
              <td>${row[6] || ""}</td>
            </tr>`,
        )
        .join("");

      return `
        <section class="page ${index > 0 ? "page-break" : ""}">
          <div class="page-header">
            <img src="./images/dmw-right.png.jpg" alt="Left logo" class="logo-left" />
            <div class="header-copy">
              <div class="ph">Republic of the Philippines</div>
              <div class="dmw">Department of Migrant Workers</div>
              <div class="ro">Regional Office XIII (Caraga)</div>
              <div class="addr">3rd floor, Esquina Dos Building J.C. Aquino Avenue, Doongan Road, Butuan City, Agusan del Norte, 8600</div>
              <div class="title">ATTENDANCE SHEET</div>
            </div>
            <img src="./images/dmw-logo.png.jpg" alt="Right logo" class="logo-right" />
          </div>
          <div class="sheet-body">
            <div class="meta"><div><strong>ACTIVITY</strong> : ${activity}</div><div><strong>VENUE</strong> : ${venue}</div><div><strong>DATE</strong> : ${date}</div></div>
            <div class="consent">By completing this form, you hereby freely and voluntarily give your consent to the collection, processing, and sharing of your personal information as described in the DMW Data Privacy Notice.</div>
            <div class="consent-extra">1. Serve as contact person of the Secretariat of the specified agenda; and</div>
            <div class="consent-extra">2. Serve as attachment for the reimbursement/liquidation report of expenses incurred during the abovementioned activity</div>
            <table class="sheet-table"><thead><tr><th>NO</th><th>NAME</th><th>SEX</th><th>OFFICE/MUNICIPALITY/SCHOOL</th><th>POSITION/COURSE</th><th>CONTACT NUMBER</th><th>SIGNATURE</th></tr></thead><tbody>${bodyRows}</tbody></table>
          </div>
          <div class="footer"><div>Website: www.dmw.gov.ph | Email: butuan@dmw.gov.ph | Landline: (085)815-1708</div><div>Finance &amp; Administrative Division: 0921-846 5934</div><div>Migrant Workers Processing Division: 0993-279 8082</div><div>Migrant Workers Protection Division: 0907-694 3525</div><div>Welfare &amp; Reintegration Services Division: 0948-475 6812 / 0950-305 7533</div></div>
        </section>`;
    })
    .join("");

  printWindow.document.open();
  printWindow.document.write(
    `<!DOCTYPE html><html><head><title>ATTENDANCE SHEET - ${activity}</title><style>@page{size:215.9mm 330.2mm;margin:0;}body{font-family:Arial,sans-serif;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{position:relative;display:flex;flex-direction:column;width:215.9mm;height:330.2mm;box-sizing:border-box;padding:10mm 10mm 18mm;page-break-inside:avoid;}.page-break{page-break-before:always;}.page-header{display:flex;align-items:center;justify-content:center;gap:8px;}.logo-left,.logo-right{width:32mm;height:32mm;object-fit:contain;flex-shrink:0;}.header-copy{text-align:center;flex:1;}.ph{font-size:10.5px;font-weight:700;}.dmw{font-size:16px;font-weight:700;margin-top:1mm;}.ro{font-size:12px;font-weight:700;margin-top:1mm;}.addr{font-size:9px;margin-top:1.5mm;}.title{font-size:16px;font-weight:700;margin-top:3mm;}.sheet-body{flex:1;display:flex;flex-direction:column;min-height:0;}.meta{margin-top:3mm;font-size:10px;line-height:1.45;}.consent{margin-top:2.5mm;font-size:10px;font-style:italic;line-height:1.35;}.consent-extra{font-size:10px;font-style:italic;line-height:1.35;}.sheet-table{width:100%;flex:1;min-height:0;border-collapse:collapse;margin-top:3mm;table-layout:fixed;}.sheet-table thead,.sheet-table tbody{display:table;width:100%;table-layout:fixed;}.sheet-table tbody tr{height:auto;min-height:8mm;}.sheet-table th,.sheet-table td{border:1px solid #000;padding:1mm 0.7mm;text-align:center;font-size:8px;line-height:1.2;font-weight:600;vertical-align:middle;word-wrap:break-word;white-space:normal;overflow:visible;}.sheet-table th{background:#ffffff !important;color:#000000 !important;border:1.2px solid #000 !important;font-weight:800 !important;opacity:1 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.sheet-table td:first-child,.sheet-table th:first-child{width:5%;}.sheet-table td:nth-child(2),.sheet-table th:nth-child(2){width:15%;}.sheet-table td:nth-child(3),.sheet-table th:nth-child(3){width:5%;}.sheet-table td:nth-child(4),.sheet-table th:nth-child(4){width:22%;}.sheet-table td:nth-child(5),.sheet-table th:nth-child(5){width:18%;}.sheet-table td:nth-child(6),.sheet-table th:nth-child(6){width:15%;}.sheet-table td:nth-child(7),.sheet-table th:nth-child(7){width:20%;}.footer{position:absolute;left:10mm;right:10mm;bottom:5mm;padding-top:1.8mm;border-top:1px solid #777;text-align:center;font-size:9px;line-height:1.35;background:#f5f5f5;}</style></head><body>${pagesHtml}</body></html>`,
  );
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

async function downloadAttendanceSheet() {
  const activity = document.getElementById("attendanceActivity").textContent;
  const venue = document.getElementById("attendanceVenue").textContent;
  const date = document.getElementById("attendanceDate").textContent;
  const rows = await getLatestAttendanceRows();

  const fileName = `Attendance_${activity.replace(/\s/g, "_")}_${new Date().getTime()}`;
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
    // Long Bond paper: 8.5 x 13 inches = 215.9 x 330.2 mm
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [215.9, 330.2],
    });
    // FIX #2: Declare pageWidth once here; remove the duplicate declaration below.
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Table
    const header = [
      "NO",
      "NAME",
      "SEX",
      "OFFICE/MUNICIPALITY/SCHOOL",
      "POSITION/COURSE",
      "CONTACT NUMBER",
      "SIGNATURE",
    ];

    const getFooterLayout = () => {
      const footerHeight = 22 + footerLines.length * 4.4;
      const footerTop = pageHeight - footerHeight - 1;
      return { footerHeight, footerTop };
    };

    const drawFooter = () => {
      const { footerHeight, footerTop } = getFooterLayout();

      // Fill footer area for strong bottom alignment and no blank gaping space
      doc.setFillColor(245, 245, 245);
      doc.rect(8, footerTop - 2, pageWidth - 16, footerHeight + 6, "F");

      // Divider line above footer block
      doc.setDrawColor(120);
      doc.setLineWidth(0.5);
      doc.line(10, footerTop - 0.5, pageWidth - 10, footerTop - 0.5);

      doc.setFontSize(8);
      doc.setFont(undefined, "normal");

      let lineY = footerTop + 3.2;
      footerLines.forEach((line) => {
        doc.text(line, pageWidth / 2, lineY, {
          maxWidth: pageWidth - 24,
          align: "center",
        });
        lineY += 4.4;
      });
    };

    const drawPageHeader = () => {
      let yPos = 10;

      // Keep header text color consistent
      doc.setTextColor(0, 0, 0);

      // Logos
      if (leftLogo) {
        doc.addImage(leftLogo, "PNG", 10, yPos - 2, 28, 28);
      }
      if (rightLogo) {
        doc.addImage(rightLogo, "PNG", pageWidth - 38, yPos - 2, 28, 28);
      }

      // Header
      doc.setFontSize(10.5);
      doc.setFont(undefined, "bold");
      doc.text("Republic of the Philippines", pageWidth / 2, yPos, {
        align: "center",
      });
      yPos += 7;

      doc.setFontSize(16);
      doc.text("Department of Migrant Workers", pageWidth / 2, yPos, {
        align: "center",
      });
      yPos += 7;

      doc.setFontSize(12);
      doc.text("Regional Office – XIII (Caraga)", pageWidth / 2, yPos, {
        align: "center",
      });
      yPos += 6;

      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.text(
        "3rd floor, Esquina Dos Building J.C. Aquino Avenue, Doongan Road, Butuan City, Agusan del Norte, 8600",
        pageWidth / 2,
        yPos,
        { align: "center" },
      );
      yPos += 9;

      // Title
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text("ATTENDANCE SHEET", pageWidth / 2, yPos, { align: "center" });
      yPos += 11;

      // Activity, Venue, Date fields - aligned with table (left margin 10mm)
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text("ACTIVITY", 10, yPos);
      doc.setFont(undefined, "normal");
      doc.text(":", 32, yPos);
      doc.text(activity, 37, yPos);
      yPos += 6;

      doc.setFont(undefined, "bold");
      doc.text("VENUE", 10, yPos);
      doc.setFont(undefined, "normal");
      doc.text(":", 32, yPos);
      doc.text(venue, 37, yPos);
      yPos += 6;

      doc.setFont(undefined, "bold");
      doc.text("DATE", 10, yPos);
      doc.setFont(undefined, "normal");
      doc.text(":", 32, yPos);
      doc.text(date, 37, yPos);
      yPos += 8;

      // Consent statement and additional use-cases - aligned with table
      doc.setFontSize(11);
      doc.setFont(undefined, "italic");
      const consentLines = [
        "By completing this form, you hereby freely and voluntarily give your consent to the collection, processing, and sharing of your personal information as described in the DMW Data Privacy Notice.",
        "1. Serve as contact person of the Secretariat of the specified agenda; and",
        "2. Serve as attachment for the reimbursement/liquidation report of expenses incurred during the abovementioned activity",
      ];
      consentLines.forEach((line, idx) => {
        if (idx === 1) yPos += 2;
        const wrapped = doc.splitTextToSize(line, pageWidth - 20);
        doc.text(wrapped, 10, yPos, { align: "left" });
        yPos += wrapped.length * 4.2;
      });
      yPos += 2;

      // FIX #4: Return yPos so callers always get the correct starting position.
      return yPos;
    };

    const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      if (pageIndex > 0) doc.addPage();

      const startY = drawPageHeader();
      const pageRows = rows.slice(
        pageIndex * rowsPerPage,
        (pageIndex + 1) * rowsPerPage,
      );

      // Draw table manually to match print layout
      const colWidths = [11.5, 35, 11.5, 39, 31, 27.4, 39];
      // FIX #2: Use the already-declared pageWidth from the outer scope (no re-declaration).
      const marginLeft = 10;
      const marginRight = 10;
      const tableWidth = pageWidth - marginLeft - marginRight;

      // Calculate actual column widths based on proportions
      const totalProportion = colWidths.reduce((a, b) => a + b, 0);
      const actualColWidths = colWidths.map(
        (w) => (w / totalProportion) * tableWidth,
      );

      let yPos = startY;
      const { footerTop } = getFooterLayout();
      const availableTableHeight = Math.max(40, footerTop - startY - 2);
      const cellHeight = availableTableHeight / (rowsPerPage + 1);
      const cellPadding = 0.5;

      // Draw header row (no fill, white background from page)
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "bold");

      let xPos = marginLeft;

      header.forEach((title, idx) => {
        const cellWidth = actualColWidths[idx];
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.rect(xPos, yPos, cellWidth, cellHeight, "S");

        // Reduce font size for long column headers
        doc.setFontSize(idx === 3 ? 5.5 : 6);

        // Use black text in table header
        doc.setTextColor(0, 0, 0);
        doc.text(title, xPos + cellWidth / 2, yPos + cellHeight / 2 + 1, {
          align: "center",
          maxWidth: cellWidth - 1,
        });
        xPos += cellWidth;
      });

      yPos += cellHeight;

      // Draw data rows with BLACK text
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "normal");
      doc.setFontSize(7);
      pageRows.forEach((row) => {
        let xPos = marginLeft;
        row.forEach((cell, idx) => {
          const cellWidth = actualColWidths[idx];
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.4);
          doc.rect(xPos, yPos, cellWidth, cellHeight);

          doc.setTextColor(0, 0, 0);
          const text = String(cell || "");
          doc.text(text, xPos + cellWidth / 2, yPos + cellHeight / 2 + 1, {
            align: "center",
            maxWidth: cellWidth - 1,
          });
          xPos += cellWidth;
        });
        yPos += cellHeight;
      });

      drawFooter();
    }

    // FIX #1: doc.save() and return are now correctly INSIDE the if (window.jspdf) block.
    doc.save(`${fileName}.pdf`);
    return;
  }

  // Fallback: export HTML file containing values (safe for printing to PDF manually)
  const tableHtml = buildAttendanceTableHtml(rows);
  const htmlContent = `<!DOCTYPE html><html><head><title>ATTENDANCE SHEET</title><style>body{font-family:Arial,sans-serif;margin:40px;}.header{text-align:center;margin-bottom:20px;}.header h1{margin:0;font-size:18px;font-weight:bold;}.header h2{margin:5px 0;font-size:16px;font-weight:bold;}.header h3{margin:5px 0;font-size:12px;}.header p{margin:5px 0;font-size:9px;}.title{text-align:center;font-size:14px;font-weight:bold;margin:15px 0;}.info{margin:15px 0;}.info p{margin:5px 0;font-weight:bold;font-size:10px;}.consent{margin:15px 0;font-size:9px;font-style:italic;}table{width:100%;border-collapse:collapse;margin:15px 0;}th,td{border:1px solid #000;padding:8px;text-align:left;font-size:9px;}th{background-color:#d3d3d3;font-weight:bold;}.footer{margin-top:20px;font-size:8px;text-align:center;line-height:1.4;}</style></head><body><div class="header"><h1>Republic of the Philippines</h1><h2>Department of Migrant Workers</h2><h3>Regional Office – XIII (Caraga)</h3><p>3rd floor, Esquina Dos Building J.C. Aquino Avenue, Doongan Road, Butuan City, Agusan del Norte, 8600</p></div><div class="title">ATTENDANCE SHEET</div><div class="info"><p>ACTIVITY : ${activity}</p><p>VENUE : ${venue}</p><p>DATE : ${date}</p></div><div class="consent">By completing this form, you hereby freely and voluntarily give your consent to the collection, processing, and sharing of your personal information as described in the DMW Data Privacy Notice.</div>${tableHtml}<div class="footer"><p>Website: www.dmw.gov.ph | Email: butuan@dmw.gov.ph | Landline: (085)815-1708<br>Finance & Administrative Division: 0921-846 5934<br>Migrant Workers Processing Division: 0993-279 8082<br>Migrant Workers Protection Division: 0907-694 3525<br>Welfare & Reintegration Services Division:0948-475 6812 / 0950-305 7533</p></div></body></html>`;

  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function populateEventDropdown() {
  const select = document.getElementById("attendanceEventFilter");
  if (!select) {
    return;
  }

  while (select.options.length > 1) select.remove(1);

  const submittedActivities = new Set(
    attendanceSummary
      .filter((it) => Number(it.record_count) > 0)
      .map((it) => it.activity_id),
  );

  // Only show saved activities - no static data
  savedActivities
    .filter((activity) => !submittedActivities.has(activity.id))
    .forEach((activity) => {
      const option = document.createElement("option");
      option.value = `activity_${activity.id}`;
      option.textContent = `${activity.name || "Activity"} - ${activity.venue || "Venue"}`;
      select.appendChild(option);
    });
}

async function loadData() {
  try {
    const response = await fetch("/data/peos-monitoring.json", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Failed to fetch data");
    const data = await response.json();
    allEvents = data.events || [];
  } catch (error) {
    console.error("Error loading local data", error);
    allEvents = [];
  }
}

// ── GLOBAL STATE FOR SUBMISSION PROTECTION ────────────────────────────────────
let isSubmitting = false;
let eventListenersInitialized = false;

window.addEventListener("DOMContentLoaded", async () => {
  // Dashboard has its own inline bootstrap; skip duplicate bootstrap from this file.
  if (window.__dashboardInlineBootstrap) {
    return;
  }

  // Skip if listeners already initialized to prevent duplicate submissions
  if (eventListenersInitialized) {
    console.log(
      "[INIT] Event listeners already initialized, skipping attachment",
    );
    return;
  }
  eventListenersInitialized = true;
  await loadData();
  await refreshActivities();
  await loadAttendanceSummary();

  const attendanceFilter = document.getElementById("attendanceEventFilter");
  const attendanceSheetContainer = document.getElementById(
    "attendanceSheetContainer",
  );
  const submittedList = document.getElementById("submittedAttendanceList");
  const exportAllBtn = document.getElementById("exportAllAttendanceCsv");

  // FIX #3: exportAllBtn listener attached only once, here at the top level.
  if (exportAllBtn) {
    exportAllBtn.addEventListener("click", async () => {
      await exportAllSubmittedAttendanceCsv();
    });
  }

  if (submittedList) {
    setupSubmittedListListener();
  }

  if (attendanceFilter && attendanceSheetContainer) {
    populateEventDropdown();
    await renderAttendanceSheet();

    attendanceFilter.addEventListener("change", async (e) => {
      const eventValue = e.target.value;
      currentSelectedOption = eventValue;

      let activity = getActivityFromOption(eventValue);
      if (!activity && eventValue.startsWith("activity_")) {
        // Fetch from API if not in local data
        const id = eventValue.replace("activity_", "");
        activity = await getActivityById(id);
      }

      if (activity) {
        // Update display
        document.getElementById("attendanceActivity").textContent =
          activity.name || activity.activity || "—";
        document.getElementById("attendanceVenue").textContent =
          activity.venue || "—";
        document.getElementById("attendanceDate").textContent =
          activity.date || "—";
      }

      await renderAttendanceSheet(eventValue, false);
    });

    document
      .getElementById("addAttendanceRow")
      .addEventListener("click", () => {
        const tbody = document.getElementById("attendanceTableBody");
        const nextRow = tbody.querySelectorAll("tr").length + 1;
        tbody.insertAdjacentHTML(
          "beforeend",
          `
      <tr>
        <td class="border border-gray-300 px-2 py-1 text-center font-semibold">${nextRow}</td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" /></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" maxlength="1" /></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" /></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" /></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" /></td>
        <td class="border border-gray-300 px-2 py-1"><input type="text" class="w-full border-0 px-1 py-1 text-xs" /></td>
      </tr>
    `,
        );
      });

    document
      .getElementById("printAttendance")
      .addEventListener("click", async () => {
        const printWindow = window.open("", "", "height=600,width=800");
        if (!printWindow) {
          alert(
            "Print preview was blocked. Please allow pop-ups and try again.",
          );
          return;
        }

        const activityValue = document.getElementById(
          "attendanceEventFilter",
        ).value;
        if (activityValue) await renderAttendanceSheet(activityValue, true);
        await printAttendanceSheet(printWindow);
      });

    document
      .getElementById("downloadAttendance")
      .addEventListener("click", async () => {
        const activityValue = document.getElementById(
          "attendanceEventFilter",
        ).value;
        if (activityValue) await renderAttendanceSheet(activityValue, true);
        await downloadAttendanceSheet();
      });

    // Clone and replace submit button to remove any stale listeners from previous page loads
    const oldSubmitBtn = document.getElementById("submitAttendance");
    const newSubmitBtn = oldSubmitBtn.cloneNode(true);
    oldSubmitBtn.parentNode.replaceChild(newSubmitBtn, oldSubmitBtn);

    document
      .getElementById("submitAttendance")
      .addEventListener("click", async () => {
        // Prevent double submission
        if (isSubmitting) {
          console.warn("[SUBMIT] Already submitting, ignoring duplicate click");
          return;
        }

        const eventValue = document.getElementById(
          "attendanceEventFilter",
        ).value;
        if (!eventValue) {
          alert("Please select an activity first.");
          return;
        }

        let activityId;
        if (eventValue.startsWith("activity_")) {
          activityId = eventValue.replace("activity_", "");
        } else {
          alert("Attendance can only be submitted for saved activities.");
          return;
        }

        const rows = document
          .getElementById("attendanceTableBody")
          .querySelectorAll("tr");

        console.log("[SUBMIT] Raw HTML rows count:", rows.length);
        console.log("[SUBMIT] Checking actual DOM structure...");

        // Build record map by row_number to prevent duplicates
        const recordMap = new Map();

        Array.from(rows).forEach((row) => {
          const rowNumTd = row.querySelector("td:first-child");
          const rowNumber = parseInt(rowNumTd?.textContent.trim() || "0");

          if (rowNumber < 1) {
            console.log("[SUBMIT] Skipping invalid row number:", rowNumber);
            return;
          }

          const inputs = row.querySelectorAll("input");
          if (inputs.length < 6) {
            console.log(
              "[SUBMIT] Row",
              rowNumber,
              "has only",
              inputs.length,
              "inputs, skipping",
            );
            return;
          }

          const record = {
            row_number: rowNumber,
            name: (inputs[0]?.value || "").trim(),
            sex: (inputs[1]?.value || "").trim(),
            office: (inputs[2]?.value || "").trim(),
            position: (inputs[3]?.value || "").trim(),
            contact: (inputs[4]?.value || "").trim(),
            signature: (inputs[5]?.value || "").trim(),
          };

          // If row_number already exists in map, log warning
          if (recordMap.has(rowNumber)) {
            console.warn(
              "[SUBMIT] DUPLICATE ROW DETECTED - row_number",
              rowNumber,
              "already in map!",
            );
            console.warn("[SUBMIT] Old:", recordMap.get(rowNumber));
            console.warn("[SUBMIT] New:", record);
          }

          recordMap.set(rowNumber, record);
        });

        // Convert map to array and filter out empty rows
        let filteredRecords = Array.from(recordMap.values()).filter((r) => {
          return !!(
            r.name ||
            r.sex ||
            r.office ||
            r.position ||
            r.contact ||
            r.signature
          );
        });

        console.log(
          "[SUBMIT] Final records to submit:",
          filteredRecords.length,
          filteredRecords,
        );
        console.log(
          "[SUBMIT] Records with sex=M:",
          filteredRecords.filter((r) => (r.sex || "").toUpperCase() === "M"),
        );
        console.log(
          "[SUBMIT] Records with sex=F:",
          filteredRecords.filter((r) => (r.sex || "").toUpperCase() === "F"),
        );

        if (filteredRecords.length === 0) {
          alert("No participant data to submit. Please add at least one row.");
          return;
        }

        // Prevent double submissions
        isSubmitting = true;
        const submitBtn = document.getElementById("submitAttendance");
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
          // You can replace this with a real user id from auth context
          const uploadedBy = "current_user";

          const result = await batchSaveAttendance(
            activityId,
            filteredRecords,
            uploadedBy,
          );
          if (!result) {
            alert("Failed to submit attendance. Please try again.");
            return;
          }

          setAttendanceLocked(true);
          document
            .getElementById("attendanceSheetContainer")
            .classList.add("hidden");
          document
            .getElementById("attendancePlaceholder")
            .classList.remove("hidden");
          document.getElementById("attendanceEventFilter").value = "";
          currentSelectedOption = "";

          console.log("Attendance submit result:", result);
          await refreshActivities();
          await loadAttendanceSummary();
          populateEventDropdown();

          alert("✓ Attendance data submitted successfully!");

          // Use an absolute in-app route to avoid accidental navigation to /files directory listing
          window.location.href = "dashboard.html#files";
        } catch (err) {
          console.error("[SUBMIT] Error during submission:", err);
          alert("An error occurred during submission: " + err.message);
        } finally {
          // Re-enable submit button if still on page
          isSubmitting = false;
          const btn = document.getElementById("submitAttendance");
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Submit Attendance";
          }
        }
      });
  }
});

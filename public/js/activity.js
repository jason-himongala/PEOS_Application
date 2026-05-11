let savedActivities = [];

async function refreshActivities() {
  savedActivities = await getActivities();
  renderActivities();
}

function renderActivities(filter = "") {
  const list = document.getElementById("activityList");
  const normalizedFilter = (filter || "").trim().toLowerCase();

  const filteredActivities = normalizedFilter
    ? savedActivities.filter((a) =>
        `${a.name} ${a.venue} ${a.date}`
          .toLowerCase()
          .includes(normalizedFilter),
      )
    : savedActivities;

  if (filteredActivities.length === 0) {
    list.innerHTML = '<p class="text-gray-500">No activities found.</p>';
    return;
  }

  list.innerHTML = filteredActivities
    .map(
      (a) => `
      <div class="bg-gray-100 rounded p-4 shadow-sm">
        <div class="grid grid-cols-12 gap-2 text-sm text-gray-800">
          <div class="col-span-3 font-semibold">ACTIVITY  :</div>
          <div class="col-span-9">${a.name}</div>
          <div class="col-span-3 font-semibold">VENUE  :</div>
          <div class="col-span-9">${a.venue}</div>
          <div class="col-span-3 font-semibold">DATE  :</div>
          <div class="col-span-9">${a.date}</div>
        </div>
        <div class="mt-3 flex justify-end">
          <button data-id="${a.id}" class="text-red-600 hover:text-red-800 text-xs font-semibold">Remove</button>
        </div>
      </div>
    `,
    )
    .join("");
}

function setupActivityListListener() {
  const list = document.getElementById("activityList");
  if (!list || window.__activityListListenerAttached) return;

  window.__activityListListenerAttached = true;
  list.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-id]");
    if (!btn || !list.contains(btn)) return;

    const id = btn.getAttribute("data-id");
    await deleteActivity(id);
    await refreshActivities();
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  setupActivityListListener();
  await refreshActivities();

  document.getElementById("activitySearch").addEventListener("input", (e) => {
    renderActivities(e.target.value);
  });

  document
    .getElementById("activityForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("activityName").value.trim();
      const venue = document.getElementById("activityVenue").value.trim();
      const date = document.getElementById("activityDate").value;

      if (!name || !venue || !date) return;

      const created = await createActivity(name, venue, date);
      if (!created) {
        alert("Failed to create activity.");
        return;
      }

      await refreshActivities();
      document.getElementById("activityForm").reset();
      const status = document.getElementById("activityStatus");
      status.classList.remove("hidden");
      setTimeout(() => status.classList.add("hidden"), 1800);
    });
});

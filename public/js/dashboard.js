let basePeos = 0;
let genderChartInstance = null;
let peosChartInstance = null;

async function loadDashboardData() {
  try {
    const res = await fetch("/data/peos-monitoring.json", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch data");
    const data = await res.json();

    document.getElementById("totalParticipants").textContent =
      data.totals?.total_participants ?? "—";
    basePeos = data.totals?.total_peos_conducted ?? (data.events || []).length;

    const events = data.events || [];
    const totalMale = events.reduce((sum, e) => sum + (e.male || 0), 0);
    const totalFemale = events.reduce((sum, e) => sum + (e.female || 0), 0);
    document.getElementById("totalMale").textContent = totalMale;

    const genderCtx = document.getElementById("genderChart").getContext("2d");
    if (genderChartInstance) {
      genderChartInstance.destroy();
    }
    genderChartInstance = new Chart(genderCtx, {
      type: "pie",
      data: {
        labels: ["Male", "Female"],
        datasets: [
          {
            data: [totalMale, totalFemale],
            backgroundColor: ["#3B82F6", "#EC4899"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    });

    const peosCtx = document.getElementById("peosChart").getContext("2d");
    if (peosChartInstance) {
      peosChartInstance.destroy();
    }
    peosChartInstance = new Chart(peosCtx, {
      type: "bar",
      data: {
        labels: ["From Data", "Saved"],
        datasets: [
          {
            label: "PEOS Conducted",
            data: [basePeos, 0],
            backgroundColor: ["#3B82F6", "#10B981"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    });

    const eventsList = document.getElementById("eventsList");
    if (!events.length) {
      eventsList.innerHTML = '<p class="text-gray-500">No events found.</p>';
    } else {
      eventsList.innerHTML = events
        .map(
          (evt) => `
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded">
          <div>
            <p class="font-medium text-gray-900">${evt.activity || "—"}</p>
            <p class="text-sm text-gray-600">${evt.venue || "—"}</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-600">Male: ${evt.male || 0}</p>
            <p class="text-sm text-gray-600">Female: ${evt.female || 0}</p>
          </div>
        </div>
      `,
        )
        .join("");
    }
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    document.getElementById("eventsList").innerHTML =
      '<p class="text-red-500">Failed to load data.</p>';
  }
}

window.addEventListener("DOMContentLoaded", loadDashboardData);

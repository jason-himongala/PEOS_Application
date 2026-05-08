const os = require("os");

const ips = [];
for (const interfaces of Object.values(os.networkInterfaces())) {
  for (const item of interfaces || []) {
    if (
      item &&
      item.family === "IPv4" &&
      !item.internal &&
      !item.address.startsWith("169.254.")
    ) {
      ips.push(item.address);
    }
  }
}

process.stdout.write([...new Set(ips)].join(" "));

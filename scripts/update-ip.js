const os = require("os");
const fs = require("fs");
const path = require("path");

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }

  console.log("Available network interfaces:");
  candidates.forEach((c) => console.log(`  ${c.name}: ${c.address}`));

  // 1. 优先选名字是 "Wi-Fi" 的网卡
  const wifi = candidates.find((c) => c.name === "Wi-Fi");
  if (wifi) return wifi.address;

  // 2. 其次选名字含 "wi" 或 "wl" 的（Linux/Mac 的 Wi-Fi 命名）
  const wifiAlt = candidates.find(
    (c) =>
      c.name.toLowerCase().includes("wi") ||
      c.name.toLowerCase().startsWith("wl"),
  );
  if (wifiAlt) return wifiAlt.address;

  // 3. 其次选 192.168.x.x
  const home = candidates.find((c) => c.address.startsWith("192.168."));
  if (home) return home.address;

  // 4. 回退到第一个
  return candidates[0]?.address ?? "127.0.0.1";
}

const ip = getLocalIP();
const port = 3000;
const apiUrl = `http://${ip}:${port}`;
const envPath = path.join(__dirname, "..", "AuraSight-FrontEnd", ".env");

let envContent = "";
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf8");
}

if (envContent.includes("EXPO_PUBLIC_API_URL")) {
  envContent = envContent.replace(
    /EXPO_PUBLIC_API_URL=.*/,
    `EXPO_PUBLIC_API_URL=${apiUrl}`,
  );
} else {
  envContent += `\nEXPO_PUBLIC_API_URL=${apiUrl}`;
}

fs.writeFileSync(envPath, envContent.trim() + "\n");

console.log(`✅ IP updated: EXPO_PUBLIC_API_URL=${apiUrl}`);
console.log(`   Starting backend on ${apiUrl}...`);

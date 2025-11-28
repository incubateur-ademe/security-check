import { IOC_CSV_URL } from "./config";
import { type VulnMap } from "./types";
import { log } from "./utils/logger";

export async function loadAffectedPackages(): Promise<VulnMap> {
  log.info("🔍 Chargement de la liste d'IOC DataDog (Shai-Hulud 2.0)...");
  log.info(`🔗 ${IOC_CSV_URL}`);

  const res = await fetch(IOC_CSV_URL + `?nocache=${Date.now()}`, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "shai-hulud-ioc-checker",
      Accept: "text/csv",
    },
  });

  if (!res.ok) {
    throw new Error(`Impossible de récupérer le CSV DataDog: ${res.status} ${res.statusText}`);
  }

  const csv = await res.text();
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);

  const map: VulnMap = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === 0 && line.toLowerCase().startsWith("package_name,")) {
      continue;
    }

    const m = /^([^,]+),([^,]+),(.*)$/.exec(line);
    if (!m) continue;

    const pkgName = m[1].trim();
    const versionsField = m[2].trim();
    if (!pkgName || !versionsField) continue;

    const versionTokens = versionsField
      .split(/[|; ]+/)
      .map(v => v.trim())
      .filter(Boolean);

    if (!versionTokens.length) continue;

    const current = map.get(pkgName) ?? [];
    for (const v of versionTokens) {
      if (!current.includes(v)) current.push(v);
    }
    map.set(pkgName, current);
  }

  log.info(`➡️  ${map.size} paquets listés dans les IOC DataDog.`);
  return map;
}

import { ref, onMounted } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";

const RELEASES_API = "https://api.github.com/repos/JonasLarsson78/jobb-sok-app/releases/latest";
const RELEASES_PAGE = "https://github.com/JonasLarsson78/jobb-sok-app/releases/latest";

function semverGt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

export function useUpdateChecker() {
  const newVersion = ref<string | null>(null);

  async function check() {
    try {
      const current = await getVersion();
      const res = await fetch(RELEASES_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const latest = (data.tag_name as string)?.replace(/^v/, "");
      if (latest && semverGt(latest, current)) {
        newVersion.value = latest;
      }
    } catch {}
  }

  function openReleasePage() {
    openUrl(RELEASES_PAGE);
  }

  onMounted(check);

  return { newVersion, openReleasePage };
}

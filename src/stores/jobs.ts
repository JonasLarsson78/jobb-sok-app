import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { searchAf, type AfJob } from "../services/af_api";
import { searchLinkedIn, type LinkedInJob } from "../services/linkedin";
import { searchJobbSafari, type JobbSafariJob } from "../services/jobbsafari";
import { useSettingsStore } from "./settings";
import { useJobStatusStore } from "./jobStatus";

export type { Source, UnifiedJob } from "../types/job";
import type { UnifiedJob } from "../types/job";

function fromAf(job: AfJob): UnifiedJob {
  const addr = job.workplace_address;
  const location = [addr?.city, addr?.municipality, addr?.region].find(Boolean) ?? "Sverige";
  return {
    id: `af-${job.id}`,
    title: job.headline,
    company: job.employer?.name ?? job.employer?.workplace ?? "",
    location,
    publishedAt: job.publication_date,
    url: job.webpage_url,
    source: "af",
    logoUrl: job.logo_url ?? undefined,
    description: job.description?.text_formatted
      ?? (job.description?.text ? job.description.text.replace(/\n/g, "<br>") : undefined),
    employmentType: job.employment_type?.label ?? undefined,
  };
}

const NON_SWEDISH = [
  "danmark", "denmark", "norge", "norway", "finland", "deutschland", "germany",
  "nederland", "netherlands", "polska", "poland", "españa", "spain", "france",
  "frankrike", "united kingdom", "england", "scotland", "ireland",
];

function isSwedish(location: string): boolean {
  const loc = location.toLowerCase();
  return !NON_SWEDISH.some((country) => loc.includes(country));
}

function fromJobbSafari(job: JobbSafariJob): UnifiedJob {
  return {
    id: `js-${job.id}`,
    title: job.title,
    company: job.company,
    location: job.location,
    publishedAt: job.publishedAt,
    url: job.url,
    source: "jobbsafari",
    logoUrl: job.logoUrl,
  };
}

function fromLinkedIn(job: LinkedInJob): UnifiedJob {
  return {
    id: `li-${job.id}`,
    title: job.title,
    company: job.company,
    location: job.location,
    publishedAt: job.publishedAt,
    url: job.url,
    source: "linkedin",
    logoUrl: job.logoUrl,
  };
}

export const useJobsStore = defineStore("jobs", () => {
  const settings = useSettingsStore();
  const status = useJobStatusStore();

  const afJobs = ref<UnifiedJob[]>([]);
  const liJobs = ref<UnifiedJob[]>([]);
  const jsJobs = ref<UnifiedJob[]>([]);
  const loadingAf = ref(false);
  const loadingLi = ref(false);
  const loadingJs = ref(false);
  const errorAf = ref<string | null>(null);
  const errorLi = ref<string | null>(null);
  const errorJs = ref<string | null>(null);

  function dedupeKey(job: UnifiedJob): string {
    const title = job.title.toLowerCase().trim();
    const firstToken = job.company.toLowerCase().trim().split(/\s+/)[0] ?? "";
    return `${title}|${firstToken}`;
  }

  const allJobs = computed<UnifiedJob[]>(() => {
    const combined: UnifiedJob[] = [];
    if (settings.afEnabled) combined.push(...afJobs.value);
    if (settings.linkedinEnabled) combined.push(...liJobs.value);
    if (settings.jobbsafariEnabled) combined.push(...jsJobs.value);
    combined.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    const seen = new Set<string>();
    return combined.filter((job) => {
      const key = dedupeKey(job);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  const filteredJobs = computed<UnifiedJob[]>(() => {
    const base = allJobs.value.filter((job) => {
      if (!status.showIgnored && status.isIgnored(job.url)) return false;
      if (!status.showApplied && status.isApplied(job.url)) return false;
      const words = settings.excludeWords;
      if (!words.length) return true;
      const hay = `${job.title} ${job.company} ${job.description ?? ""}`.toLowerCase();
      return !words.some((w) => hay.includes(w));
    });

    const inBase = new Set(base.map((j) => j.url));
    const extras: UnifiedJob[] = [];

    if (status.showApplied) {
      for (const job of status.appliedJobs) {
        if (!inBase.has(job.url)) extras.push(job);
      }
    }
    if (status.showIgnored) {
      for (const job of status.ignoredJobs) {
        if (!inBase.has(job.url)) extras.push(job);
      }
    }

    if (!extras.length) return base;
    return [...base, ...extras].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  });

  const loading = computed(() => loadingAf.value || loadingLi.value || loadingJs.value);

  function publishedAfterDate(): string | undefined {
    if (!settings.maxAge) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - settings.maxAge);
    return d.toISOString();
  }

  async function loadAf() {
    if (!settings.afEnabled) return;
    loadingAf.value = true;
    errorAf.value = null;
    try {
      const cities = settings.cities.length ? settings.cities : [{ name: "", afCode: "" }];
      // Hämta alla städer parallellt
      const results = await Promise.all(
        cities.map((city) =>
          searchAf({
            q: settings.query,
            municipality: city.afCode || undefined,
            publishedAfter: publishedAfterDate(),
            offset: 0,
            limit: 20,
          })
        )
      );
      const seen = new Set<string>();
      const jobs: UnifiedJob[] = [];
      for (const res of results) {
        for (const hit of res.hits) {
          if (!seen.has(hit.webpage_url)) {
            seen.add(hit.webpage_url);
            jobs.push(fromAf(hit));
          }
        }
      }
      afJobs.value = jobs;
    } catch (e: unknown) {
      errorAf.value = e instanceof Error ? e.message : "Okänt fel (AF)";
    } finally {
      loadingAf.value = false;
    }
  }

  async function loadLinkedIn() {
    if (!settings.linkedinEnabled) return;
    loadingLi.value = true;
    errorLi.value = null;
    try {
      const cities = settings.cities.length ? settings.cities : [{ name: "", afCode: "" }];
      const results = await Promise.all(
        cities.map((city) =>
          searchLinkedIn({
            keywords: settings.query,
            location: city.name,
            geoId: city.linkedinGeoId,
            distance: settings.linkedinDistance,
            start: 0,
            maxAge: settings.maxAge || undefined,
          })
        )
      );
      const seen = new Set<string>();
      const jobs: UnifiedJob[] = [];
      for (const cityJobs of results) {
        for (const job of cityJobs) {
          const key = job.url || job.id;
          if (!seen.has(key) && isSwedish(job.location)) {
            seen.add(key);
            jobs.push(fromLinkedIn(job));
          }
        }
      }
      liJobs.value = jobs;
    } catch (e: unknown) {
      errorLi.value = e instanceof Error ? e.message : "Okänt fel (LinkedIn)";
    } finally {
      loadingLi.value = false;
    }
  }

  async function loadJobbSafari() {
    if (!settings.jobbsafariEnabled) return;
    loadingJs.value = true;
    errorJs.value = null;
    try {
      const cities = settings.cities.length ? settings.cities : [{ name: "Sverige", afCode: "" }];
      const results = await Promise.all(
        cities.map((city) =>
          searchJobbSafari({ keywords: settings.query, city: city.name })
        )
      );
      const cutoff = publishedAfterDate();
      const seen = new Set<string>();
      const jobs: UnifiedJob[] = [];
      for (const cityJobs of results) {
        for (const job of cityJobs) {
          if (seen.has(job.url)) continue;
          if (cutoff && new Date(job.publishedAt) < new Date(cutoff)) continue;
          seen.add(job.url);
          jobs.push(fromJobbSafari(job));
        }
      }
      jsJobs.value = jobs;
    } catch (e: unknown) {
      errorJs.value = e instanceof Error ? e.message : "Okänt fel (JobbSafari)";
    } finally {
      loadingJs.value = false;
    }
  }

  async function search() {
    await Promise.all([loadAf(), loadLinkedIn(), loadJobbSafari()]);
  }

  return {
    afJobs, liJobs, jsJobs, filteredJobs, allJobs,
    loading, loadingAf, loadingLi, loadingJs,
    errorAf, errorLi, errorJs,
    search,
  };
});

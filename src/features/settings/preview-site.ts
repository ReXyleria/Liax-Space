import { getSettingsMap } from "@/features/settings/service";
import { getSiteConfig } from "@/lib/site";

export async function getPreviewSiteSettings() {
  const [{ settings }, site] = await Promise.all([getSettingsMap(), getSiteConfig()]);

  return {
    title: site.title,
    subtitle: site.subtitle,
    logo: settings["site.logo"] || "",
    copyright: `© ${new Date().getFullYear()} ${site.title}. All rights reserved.`,
    icp: settings["record.icp"] || "",
    icpUrl: settings["record.icpUrl"] || "https://beian.miit.gov.cn/",
    police: settings["record.police"] || "",
    policeUrl: settings["record.policeUrl"] || "https://www.beian.gov.cn/portal/registerSystemInfo"
  };
}

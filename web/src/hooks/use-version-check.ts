import { useCallback, useEffect, useMemo, useState } from "react";
import { App } from "antd";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "@/constant/env";
import { parseChangelog, type ReleaseInfo } from "@/lib/release";

const latestVersionUrl = "https://raw.githubusercontent.com/Haitang-Hub/Canvas-Director/main/VERSION";
const latestChangelogUrl = "https://raw.githubusercontent.com/Haitang-Hub/Canvas-Director/main/CHANGELOG.md";

function readLocalReleases(): ReleaseInfo[] {
    return __APP_RELEASES__ || [];
}

function toVersionParts(version: string) {
    const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1).map(Number) : null;
}

function isNewerVersion(latestVersion: string, currentVersion: string) {
    const latest = toVersionParts(latestVersion);
    const current = toVersionParts(currentVersion);
    if (!latest || !current) return false;
    return latest.some((value, index) => value > current[index] && latest.slice(0, index).every((part, prevIndex) => part === current[prevIndex]));
}

function compareReleaseVersions(a: string, b: string) {
    if (a === b) return 0;
    if (a === "Unreleased") return -1;
    if (b === "Unreleased") return 1;
    const pa = toVersionParts(a);
    const pb = toVersionParts(b);
    if (!pa || !pb) return b.localeCompare(a);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pb[i] - pa[i];
    }
    return 0;
}

/** Merge upstream releases into the local changelog: local entries win on version conflicts, upstream-only versions are kept. */
function mergeReleases(local: ReleaseInfo[], remote: ReleaseInfo[], latestVersion: string): ReleaseInfo[] {
    const localVersions = new Set(local.map((release) => release.version));
    const remoteOnly = remote.filter((release) => {
        if (localVersions.has(release.version)) return false;
        // Upstream "Unreleased" content is already covered locally once that version is released here.
        if (release.version === "Unreleased" && localVersions.has(latestVersion)) return false;
        return true;
    });
    // Deduplicate both sides by version to guard against duplicate entries in either source.
    const dedup = (list: ReleaseInfo[]): ReleaseInfo[] => {
        const seen = new Set<string>();
        return list.filter((r) => {
            if (seen.has(r.version)) return false;
            seen.add(r.version);
            return true;
        });
    };
    return [...dedup(remoteOnly), ...dedup(local)].sort((a, b) => compareReleaseVersions(a.version, b.version));
}

export function useVersionCheck() {
    const { t } = useTranslation();
    const currentVersion = APP_VERSION;
    const { message } = App.useApp();
    const localReleases = useMemo(readLocalReleases, []);
    const [latestVersion, setLatestVersion] = useState(currentVersion);
    const [releases, setReleases] = useState<ReleaseInfo[]>(localReleases);
    const [checking, setChecking] = useState(false);
    const [open, setOpen] = useState(false);
    const hasNewVersion = isNewerVersion(latestVersion, currentVersion);

    const checkLatestVersion = useCallback(async () => {
        try {
            const response = await fetch(latestVersionUrl);
            if (!response.ok) return false;
            const version = await response.text();
            setLatestVersion(version.trim() || currentVersion);
            return true;
        } catch {
            return false;
        }
    }, [currentVersion]);

    const checkLatestRelease = useCallback(
        async (showMessage = false) => {
            setChecking(true);
            try {
                const [versionResponse, changelogResponse] = await Promise.all([fetch(latestVersionUrl), fetch(latestChangelogUrl)]);
                if (!versionResponse.ok) throw new Error(t("version.readFailed"));
                if (!changelogResponse.ok) throw new Error(t("version.changelogFailed"));
                const [version, changelog] = await Promise.all([versionResponse.text(), changelogResponse.text()]);
                const nextVersion = version.trim() || currentVersion;
                setLatestVersion(nextVersion);
                if (changelog.trim()) setReleases(mergeReleases(localReleases, parseChangelog(changelog), nextVersion));
                if (showMessage) message.success(t("version.updated"));
                return true;
            } catch {
                setLatestVersion(currentVersion);
                setReleases(localReleases);
                if (showMessage) message.error(t("version.updateFailed"));
                return false;
            } finally {
                setChecking(false);
            }
        },
        [currentVersion, localReleases, message, t],
    );

    useEffect(() => {
        void checkLatestVersion();
    }, [checkLatestVersion]);

    const openReleaseModal = useCallback(() => {
        setOpen(true);
        void checkLatestRelease();
    }, [checkLatestRelease]);

    return {
        open,
        setOpen,
        openReleaseModal,
        latestVersion,
        releases,
        checking,
        hasNewVersion,
        checkLatestRelease,
    };
}

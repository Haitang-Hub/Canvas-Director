import { Modal, Button, Input, Select, Spin, Tag } from "antd";
import { AlertTriangle, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { createPromptSource, type PromptSource, type PromptSourceMediaType } from "@/services/api/prompt-source-presets";
import { FALLBACK_GITHUB_PROMPT_REPOS, GITHUB_PROMPT_ORG, fetchGithubPromptRepos, githubReadmeUrl, githubRepoUrl, type GithubPromptRepo } from "@/services/api/github-prompt-sources";
import i18n from "@/i18n";

type MediaFilter = "all" | PromptSourceMediaType;

type Props = {
    open: boolean;
    existingHomepages: Set<string>;
    onAdd: (sources: PromptSource[]) => void;
    onClose: () => void;
};

export function PromptGithubPickerModal({ open, existingHomepages, onAdd, onClose }: Props) {
    const { t } = useTranslation();
    const [org, setOrg] = useState(GITHUB_PROMPT_ORG);
    const [repos, setRepos] = useState<GithubPromptRepo[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [fallbackUsed, setFallbackUsed] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!open) return;
        setOrg(GITHUB_PROMPT_ORG);
        setKeyword("");
        setMediaFilter("all");
        setSelected(new Set());
        void loadRepos(GITHUB_PROMPT_ORG);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const loadRepos = async (targetOrg: string) => {
        setLoading(true);
        setSelected(new Set());
        try {
            const list = await fetchGithubPromptRepos(targetOrg);
            setRepos(list);
            setFallbackUsed(false);
        } catch {
            setRepos(targetOrg.trim().toLowerCase() === GITHUB_PROMPT_ORG.toLowerCase() ? FALLBACK_GITHUB_PROMPT_REPOS : []);
            setFallbackUsed(true);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return (repos || []).filter((repo) => (mediaFilter === "all" || repo.mediaType === mediaFilter) && (!query || [repo.name, repo.description, ...repo.topics].join(" ").toLowerCase().includes(query)));
    }, [repos, keyword, mediaFilter]);

    const toggleSelected = (repo: GithubPromptRepo) => {
        if (isAdded(repo)) return;
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(repo.name) ? next.delete(repo.name) : next.add(repo.name);
            return next;
        });
    };

    const isAdded = (repo: GithubPromptRepo) => existingHomepages.has(githubRepoUrl(org.trim() || GITHUB_PROMPT_ORG, repo.name).toLowerCase());

    const confirm = () => {
        const chosenOrg = org.trim() || GITHUB_PROMPT_ORG;
        const sources = (repos || []).filter((repo) => selected.has(repo.name)).map((repo) => createPromptSource({ name: repo.name, url: githubReadmeUrl(chosenOrg, repo.name, i18n.resolvedLanguage || "zh-CN"), homepage: githubRepoUrl(chosenOrg, repo.name), mediaType: repo.mediaType }));
        if (sources.length) onAdd(sources);
    };

    const mediaOptions: { value: MediaFilter; label: string }[] = [
        { value: "all", label: t("config.promptSources.github.filterAll") },
        { value: "image", label: t("config.promptSources.media.image") },
        { value: "video", label: t("config.promptSources.media.video") },
    ];

    return (
        <Modal open={open} onCancel={onClose} width={880} title={t("config.promptSources.github.title")}
            footer={
                <div>
                    <div className="mb-3 text-xs text-stone-400">{t("config.promptSources.github.hint")}</div>
                    <div className="flex justify-end gap-2">
                        <Button onClick={onClose}>{t("common.cancel")}</Button>
                        <Button type="primary" disabled={!selected.size} onClick={confirm}>{t("config.promptSources.github.confirm")}</Button>
                    </div>
                </div>
            }
        >
            <div className="flex items-center gap-3">
                <Input className="flex-1" addonBefore={t("config.promptSources.github.org")} value={org} onChange={(event) => setOrg(event.target.value)} onPressEnter={() => void loadRepos(org)} />
                <Button className="shrink-0" loading={loading} onClick={() => void loadRepos(org)}>{t("config.promptSources.github.load")}</Button>
            </div>
            <div className="mt-3 flex items-center gap-3">
                <Input className="flex-1" allowClear prefix={<Search className="size-3.5 text-stone-400" />} placeholder={t("config.promptSources.github.search")} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                <Select className="w-28 shrink-0" value={mediaFilter} options={mediaOptions} onChange={(value) => setMediaFilter(value)} />
                <Button className="shrink-0" loading={loading} onClick={() => void loadRepos(org)}>{t("config.promptSources.github.refresh")}</Button>
            </div>
            {fallbackUsed ? <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="size-3.5 shrink-0" />{t("config.promptSources.github.loadFailed")}</div> : null}
            <div className="mt-3 max-h-[46vh] min-h-40 space-y-2 overflow-y-auto pr-1">
                {loading && !repos ? (
                    <div className="flex justify-center py-10"><Spin /></div>
                ) : filtered.length ? (
                    filtered.map((repo) => <RepoCard key={repo.name} repo={repo} added={isAdded(repo)} selected={selected.has(repo.name)} onToggle={() => toggleSelected(repo)} />)
                ) : (
                    <div className="py-10 text-center text-sm text-stone-400">{t("config.promptSources.github.empty")}</div>
                )}
            </div>
        </Modal>
    );
}

function RepoCard({ repo, added, selected, onToggle }: { repo: GithubPromptRepo; added: boolean; selected: boolean; onToggle: () => void }) {
    const { t } = useTranslation();
    return (
        <button type="button" onClick={onToggle} disabled={added}
            className={`block w-full rounded-lg border px-4 py-3 text-left transition ${selected ? "border-stone-400 bg-stone-100 dark:border-stone-400 dark:bg-stone-800" : "border-stone-200 hover:border-stone-400 dark:border-stone-700 dark:hover:border-stone-500"} ${added ? "cursor-default opacity-60" : "cursor-pointer"}`}
        >
            <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{repo.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-stone-500"><Star className="size-3.5" />{repo.stars.toLocaleString()}</span>
                <Tag className="m-0 shrink-0 text-[10px]">{t(`config.promptSources.media.${repo.mediaType}`)}</Tag>
                {added ? <Tag className="m-0 shrink-0 text-[10px]">{t("config.promptSources.github.added")}</Tag> : null}
            </div>
            {repo.description ? <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{repo.description}</div> : null}
            {repo.topics.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {repo.topics.slice(0, 5).map((topic) => <Tag key={topic} className="m-0 text-[10px]">{topic}</Tag>)}
                </div>
            ) : null}
        </button>
    );
}

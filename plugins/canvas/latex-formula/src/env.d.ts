// 重依赖从 CDN 动态加载,不打进 bundle;此处声明以便 TS 提示
declare module "https://esm.sh/katex@0.16" {
    const katex: { render: (tex: string, el: HTMLElement, opts?: Record<string, unknown>) => void };
    export default katex;
}

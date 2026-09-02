interface Window {
  electronAPI?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onWindowMaximized: (cb: (val: boolean) => void) => () => void;
    fetchCredits: () => Promise<number>;
    onCreditsUpdate: (cb: (value: number) => void) => () => void;
    creditsConsumed: (delta: number) => void;
    onDeepLink: (cb: (url: string) => void) => () => void;
  };
}

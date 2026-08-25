export type CdpEventParams = Record<string, unknown>;
export type CdpRequestParams = Record<string, unknown>;

export type CdpRemoteObject = {
  className?: string;
  description?: string;
  objectId?: string;
  subtype?: string;
  type: string;
  unserializableValue?: string;
  value?: unknown;
};

export type CdpExceptionDetails = {
  exception?: { description?: string };
  text?: string;
};

export type CdpCallResult = {
  exceptionDetails?: CdpExceptionDetails;
  result: CdpRemoteObject;
};

export type CdpPropertyDescriptor = {
  name: string;
  value?: CdpRemoteObject;
};

export type CdpTargetInfo = {
  targetId: string;
  title?: string;
  type: string;
  url?: string;
};

export type CdpEventListener = (params: CdpEventParams | undefined, sessionId?: string) => void;

export type CdpClient = {
  close: () => Promise<void>;
  off: (method: string, listener: CdpEventListener) => void;
  on: (method: string, listener: CdpEventListener) => void;
  send: <R>(method: string, params?: CdpRequestParams, sessionId?: string) => Promise<R>;
};

export type CdpPageFunction<Arg, R> = string | ((arg: Arg) => R | Promise<R>);
export type CdpHandleFunction<El, Arg, R> = string | ((el: El, arg: Arg) => R | Promise<R>);

export type CdpScreenshotClip = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type CdpScreenshotOptions = {
  animations?: 'allow' | 'disabled';
  caret?: 'hide' | 'initial';
  clip?: CdpScreenshotClip;
  fullPage?: boolean;
  style?: string;
  timeout?: number;
};

export type CdpClickOptions = { timeout?: number };
export type CdpGotoOptions = { waitUntil?: 'domcontentloaded' | 'load' };
export type CdpScrollOptions = { timeout?: number };

export type CdpHandle = {
  asElement: () => CdpHandle | null;
  click: (options?: CdpClickOptions) => Promise<void>;
  dispose: () => Promise<void>;
  evaluate: <El, Arg, R>(fn: CdpHandleFunction<El, Arg, R>, arg?: Arg) => Promise<R>;
  evaluateHandle: <El, Arg>(fn: CdpHandleFunction<El, Arg, unknown>, arg?: Arg) => Promise<CdpHandle>;
  getProperties: () => Promise<Map<string, CdpHandle>>;
  screenshot: (options?: CdpScreenshotOptions) => Promise<Uint8Array>;
  scrollIntoViewIfNeeded: (options?: CdpScrollOptions) => Promise<void>;
};

export type CdpLocator = {
  click: (options?: CdpClickOptions) => Promise<void>;
  count: () => Promise<number>;
  elementHandles: () => Promise<CdpHandle[]>;
  evaluate: <El, Arg, R>(fn: CdpHandleFunction<El, Arg, R>, arg?: Arg) => Promise<R>;
  evaluateHandle: <El, Arg>(fn: CdpHandleFunction<El, Arg, unknown>, arg?: Arg) => Promise<CdpHandle>;
  first: () => CdpLocator;
  locator: (selector: string) => CdpLocator;
  nth: (index: number) => CdpLocator;
  screenshot: (options?: CdpScreenshotOptions) => Promise<Uint8Array>;
};

export type CdpKeyboard = {
  press: (key: string) => Promise<void>;
};

export type CdpPage = {
  close: () => Promise<void>;
  content: () => Promise<string>;
  context: () => CdpBrowserContext;
  evaluate: <Arg, R>(fn: CdpPageFunction<Arg, R>, arg?: Arg) => Promise<R>;
  evaluateHandle: <Arg>(fn: CdpPageFunction<Arg, unknown>, arg?: Arg) => Promise<CdpHandle>;
  goto: (url: string, options?: CdpGotoOptions) => Promise<void>;
  keyboard: CdpKeyboard;
  locator: (selector: string) => CdpLocator;
  screenshot: (options?: CdpScreenshotOptions) => Promise<Uint8Array>;
  url: () => string;
  waitForTimeout: (ms: number) => Promise<void>;
};

export type CdpBrowserContext = {
  newPage: () => Promise<CdpPage>;
};

export type CdpBrowser = {
  close: () => Promise<void>;
};

export type CdpBrowserSession = {
  browser: CdpBrowser;
  browserContext: CdpBrowserContext;
  page: CdpPage;
};

export type VisibilityQuote = {
  flagged: number;
  percent: number;
  total: number;
  visible: number;
};

export type VisibilityTracker = {
  flag: (id: string) => void;
  flaggedIds: () => string[];
  quote: () => VisibilityQuote;
  record: (id: string, visible: boolean) => void;
};

export type EvidenceLog = {
  append: (entry: Record<string, unknown>) => Promise<void>;
  dir: string;
  runId: string;
  writeManifest: () => Promise<string>;
};

export type CdpScrollOffset = { x: number; y: number };

export type CdpPageDeps = {
  client: CdpClient;
  sessionId: string;
  targetId: string;
};

export type CdpHandleInfo = {
  className?: string;
  objectId?: string;
  subtype?: string;
};

export type CdpKeyDefinition = {
  code: string;
  key: string;
  windowsVirtualKeyCode: number;
};

export type CdpVersionInfo = { webSocketDebuggerUrl: string };
export type CdpHttpTarget = { id?: string; type: string; url?: string };
export type CdpAttachResult = { sessionId: string };
export type CdpCreateTargetResult = { targetId: string };
export type CdpErrorBody = { message: string };
export type CdpGetPropertiesResult = { result: CdpPropertyDescriptor[] };
export type CdpSelectorQuery = { index: number; selector: string };
export type CdpFrameInfo = { parentId?: string; url?: string };
export type CdpLayoutMetrics = { cssContentSize: { height: number; width: number } };
export type CdpCaptureResult = { data: string };
export type CdpWindowHandleResult = { result: CdpHandleInfo };

export type CdpHashedFile = {
  path: string;
  sha256: string;
  size: number;
};

export type CdpDirEntry = {
  isDirectory: () => boolean;
  name: string;
};

export type CdpPendingEntry = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
};

export type CdpElementBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

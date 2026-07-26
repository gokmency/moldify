export type SettingsPanelId = "setup" | "features" | "export";
export type MobilePanelId = "model" | "view" | "setup" | "export";
export type CameraCommandType = "fit" | "reset" | "iso" | "top" | "front";
export type CameraCommand = { type: CameraCommandType; id: number };

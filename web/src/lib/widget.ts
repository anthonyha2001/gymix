"use client";

import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "@/lib/native";

// The native home-screen widget's bridge (WidgetPlugin.java / GymixWidgetPlugin
// in SceneDelegate.swift).
type WidgetBridge = {
  connect(o: { url: string; token: string }): Promise<void>;
  disconnect(): Promise<void>;
};
const GymixWidget = registerPlugin<WidgetBridge>("GymixWidget");

export async function connectWidget(connection: { url: string; token: string }) {
  if (!isNativeApp()) return;
  await GymixWidget.connect(connection).catch(() => {});
}

export async function disconnectWidget() {
  if (!isNativeApp()) return;
  await GymixWidget.disconnect().catch(() => {});
}

import {
  ArrowLeftRightIcon,
  AstroidIcon,
  BarChart3Icon,
  CogIcon,
  DatabaseIcon,
  HeartHandshakeIcon,
  KeyRoundIcon,
  LibraryIcon,
  type LucideIcon,
  Settings2Icon,
  TagsIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { type ComponentType } from "react";
import AccessTokenSection from "@/components/Settings/AccessTokenSection";
import AISection from "@/components/Settings/AISection";
import InstanceSection from "@/components/Settings/InstanceSection";
import MemberSection from "@/components/Settings/MemberSection";
import MemoExportSection from "@/components/Settings/MemoExportSection";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import MyAccountSection from "@/components/Settings/MyAccountSection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import ResourceStatsSection from "@/components/Settings/ResourceStatsSection";
import SpacesSection from "@/components/Settings/SpacesSection";
import StorageSection from "@/components/Settings/StorageSection";
import TagsSection from "@/components/Settings/TagsSection";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";

export type SettingSectionKey =
  | "my-account"
  | "memo-export"
  | "spaces"
  | "access-token"
  | "preference"
  | "member"
  | "system"
  | "memo"
  | "storage"
  | "tags"
  | "ai"
  | "resource-stats";

type SettingSectionScope = "basic" | "admin";

export interface SettingSectionDefinition {
  key: SettingSectionKey;
  scope: SettingSectionScope;
  labelKey: `setting.${SettingSectionKey}.label`;
  icon: LucideIcon;
  component: ComponentType;
  preloadSettingKeys?: InstanceSetting_Key[];
}

export const SETTINGS_SECTIONS: SettingSectionDefinition[] = [
  {
    key: "my-account",
    scope: "basic",
    labelKey: "setting.my-account.label",
    icon: UserIcon,
    component: MyAccountSection,
  },
  {
    key: "spaces",
    scope: "basic",
    labelKey: "setting.spaces.label",
    icon: AstroidIcon,
    component: SpacesSection,
  },
  {
    key: "access-token",
    scope: "basic",
    labelKey: "setting.access-token.label",
    icon: KeyRoundIcon,
    component: AccessTokenSection,
  },
  {
    key: "preference",
    scope: "basic",
    labelKey: "setting.preference.label",
    icon: CogIcon,
    component: PreferencesSection,
  },
  {
    key: "member",
    scope: "admin",
    labelKey: "setting.member.label",
    icon: UsersIcon,
    component: MemberSection,
  },
  {
    key: "system",
    scope: "admin",
    labelKey: "setting.system.label",
    icon: Settings2Icon,
    component: InstanceSection,
  },
  {
    key: "memo",
    scope: "admin",
    labelKey: "setting.memo.label",
    icon: LibraryIcon,
    component: MemoRelatedSettings,
  },
  {
    key: "tags",
    scope: "basic",
    labelKey: "setting.tags.label",
    icon: TagsIcon,
    component: TagsSection,
  },
  {
    key: "memo-export",
    scope: "basic",
    labelKey: "setting.memo-export.label",
    icon: ArrowLeftRightIcon,
    component: MemoExportSection,
  },
  {
    key: "storage",
    scope: "admin",
    labelKey: "setting.storage.label",
    icon: DatabaseIcon,
    component: StorageSection,
    preloadSettingKeys: [InstanceSetting_Key.STORAGE],
  },
  {
    key: "ai",
    scope: "admin",
    labelKey: "setting.ai.label",
    icon: HeartHandshakeIcon,
    component: AISection,
    preloadSettingKeys: [InstanceSetting_Key.AI],
  },
  {
    key: "resource-stats",
    scope: "admin",
    labelKey: "setting.resource-stats.label",
    icon: BarChart3Icon,
    component: ResourceStatsSection,
  },
];

export const DEFAULT_SETTING_SECTION: SettingSectionKey = "my-account";

export const isSettingSectionKey = (value: string): value is SettingSectionKey => {
  return SETTINGS_SECTIONS.some((section) => section.key === value);
};

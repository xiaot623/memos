import { create } from "@bufbuild/protobuf";
import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { useUpdateUserGeneralSetting } from "@/hooks/useUserQueries";
import {
  UserSetting_GeneralSetting,
  UserSetting_GeneralSettingSchema,
  UserSetting_SemanticIndexState,
} from "@/types/proto/api/v1/user_service_pb";
import { loadLocale, useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, DEFAULT_VISIBILITY_OPTIONS } from "@/utils/memo";
import { loadTheme } from "@/utils/theme";
import LocaleSelect from "../LocaleSelect";
import ThemeSelect from "../ThemeSelect";
import VisibilityIcon from "../VisibilityIcon";
import SettingGroup from "./SettingGroup";
import { SettingList, SettingListItem } from "./SettingList";
import SettingSection from "./SettingSection";

const PreferencesSection = () => {
  const t = useTranslate();
  const { profile } = useInstance();
  const { currentUser, userGeneralSetting: generalSetting, refetchSettings } = useAuth();
  const { mutate: updateUserGeneralSetting, isPending: isUpdatingGeneralSetting } = useUpdateUserGeneralSetting(currentUser?.name);

  const handleLocaleSelectChange = (locale: Locale) => {
    // Apply locale immediately for instant UI feedback and persist to localStorage
    loadLocale(locale);
    // Persist to user settings
    updateUserGeneralSetting(
      { generalSetting: { locale }, updateMask: ["locale"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const visibilityOptions = useMemo(
    () => DEFAULT_VISIBILITY_OPTIONS.map((option) => ({ value: option.name, label: t(option.labelKey) })),
    [t],
  );

  const handleDefaultMemoVisibilityChanged = (value: string) => {
    updateUserGeneralSetting(
      { generalSetting: { memoVisibility: value }, updateMask: ["memo_visibility"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const handleThemeChange = (theme: string) => {
    // Apply theme immediately for instant UI feedback
    loadTheme(theme);
    // Persist to user settings
    updateUserGeneralSetting(
      { generalSetting: { theme }, updateMask: ["theme"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const handleSaveMediaMetadataChange = (saveMediaMetadata: boolean) => {
    updateUserGeneralSetting(
      { generalSetting: { saveMediaMetadata }, updateMask: ["save_media_metadata"] },
      {
        onSuccess: async () => {
          await refetchSettings();
        },
      },
    );
  };

  const semanticState = generalSetting?.semanticIndexState ?? UserSetting_SemanticIndexState.OFF;
  const semanticEnabled =
    semanticState === UserSetting_SemanticIndexState.INITIALIZING || semanticState === UserSetting_SemanticIndexState.READY;
  const savedThreshold = generalSetting?.semanticScoreThreshold ?? 0.5;
  const [threshold, setThreshold] = useState(savedThreshold);

  useEffect(() => {
    setThreshold(savedThreshold);
  }, [savedThreshold]);

  useEffect(() => {
    if (semanticState !== UserSetting_SemanticIndexState.INITIALIZING) return;
    const timer = window.setInterval(() => {
      void refetchSettings();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refetchSettings, semanticState]);

  const handleSemanticIndexChange = (enabled: boolean) => {
    updateUserGeneralSetting(
      {
        generalSetting: {
          semanticIndexState: enabled ? UserSetting_SemanticIndexState.INITIALIZING : UserSetting_SemanticIndexState.OFF,
        },
        updateMask: ["semantic_index_state"],
      },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const commitThreshold = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    if (rounded === savedThreshold) return;
    updateUserGeneralSetting(
      { generalSetting: { semanticScoreThreshold: rounded }, updateMask: ["semantic_score_threshold"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const semanticDescription =
    semanticState === UserSetting_SemanticIndexState.READY
      ? t("setting.preference.semantic-index-ready")
      : semanticState === UserSetting_SemanticIndexState.INITIALIZING
        ? t("setting.preference.semantic-index-initializing")
        : t("setting.preference.semantic-index-description");

  // Provide default values if setting is not loaded yet
  const setting: UserSetting_GeneralSetting =
    generalSetting ||
    create(UserSetting_GeneralSettingSchema, {
      locale: "en",
      memoVisibility: "PRIVATE",
      theme: "system",
      saveMediaMetadata: false,
    });

  return (
    <SettingSection title={t("setting.preference.label")}>
      <SettingGroup title={t("setting.preference.appearance-title")} description={t("setting.preference.appearance-description")}>
        <SettingList>
          <SettingListItem label={t("common.language")} description={t("setting.preference.language-description")}>
            <LocaleSelect value={setting.locale} onChange={handleLocaleSelectChange} />
          </SettingListItem>

          <SettingListItem label={t("setting.preference.theme")} description={t("setting.preference.theme-description")}>
            <ThemeSelect value={setting.theme} onValueChange={handleThemeChange} />
          </SettingListItem>
        </SettingList>
      </SettingGroup>

      <SettingGroup
        title={t("setting.preference.memo-defaults-title")}
        description={t("setting.preference.memo-defaults-description")}
        showSeparator
      >
        <SettingList>
          <SettingListItem
            label={t("setting.preference.default-memo-visibility")}
            description={t("setting.preference.default-memo-visibility-description")}
          >
            <Select
              value={setting.memoVisibility || "PRIVATE"}
              items={visibilityOptions}
              onValueChange={handleDefaultMemoVisibilityChanged}
            >
              <SelectTrigger className="min-w-fit">
                <div className="flex items-center gap-2">
                  <VisibilityIcon visibility={convertVisibilityFromString(setting.memoVisibility)} />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="whitespace-nowrap">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingListItem>
        </SettingList>
      </SettingGroup>

      <SettingGroup
        title={t("setting.preference.uploads-privacy-title")}
        description={t("setting.preference.uploads-privacy-description")}
        showSeparator
      >
        <SettingList>
          <SettingListItem
            label={t("setting.preference.save-media-metadata")}
            description={t("setting.preference.save-media-metadata-description")}
          >
            <Switch
              aria-label={t("setting.preference.save-media-metadata")}
              checked={setting.saveMediaMetadata}
              disabled={isUpdatingGeneralSetting}
              onCheckedChange={handleSaveMediaMetadataChange}
            />
          </SettingListItem>
        </SettingList>
      </SettingGroup>

      {profile.semanticSearchAvailable && (
        <SettingGroup title={t("setting.preference.search-title")} description={t("setting.preference.search-description")} showSeparator>
          <SettingList>
            <SettingListItem label={t("setting.preference.semantic-index")} description={semanticDescription}>
              <Switch
                aria-label={t("setting.preference.semantic-index")}
                checked={semanticEnabled}
                disabled={isUpdatingGeneralSetting}
                onCheckedChange={handleSemanticIndexChange}
              />
            </SettingListItem>
            <SettingListItem
              label={t("setting.preference.semantic-score-threshold")}
              description={t("setting.preference.semantic-score-threshold-description")}
            >
              <div className="flex w-44 items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={threshold}
                  aria-label={t("setting.preference.semantic-score-threshold")}
                  disabled={isUpdatingGeneralSetting}
                  className="h-1 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) => setThreshold(Number(event.target.value))}
                  onPointerUp={(event) => commitThreshold(Number(event.currentTarget.value))}
                  onKeyUp={(event) => commitThreshold(Number(event.currentTarget.value))}
                />
                <span className="w-8 text-right font-mono text-xs tabular-nums">{threshold.toFixed(2)}</span>
              </div>
            </SettingListItem>
          </SettingList>
        </SettingGroup>
      )}
    </SettingSection>
  );
};

export default PreferencesSection;
